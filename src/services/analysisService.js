const { client, OPENAI_MODEL, OPENAI_MAX_TOKENS, OPENAI_TEMPERATURE, OPENAI_TIMEOUT, SYSTEM_PROMPT } = require("../config/openai");
const RED_FLAGS = require("../config/redFlags");

// Sends listing data + pre-evaluated rule flags to OpenAI for subjective analysis.
//
// The rule engine (ruleEngine.js) handles deterministic checks first.
// This service focuses on what only AI can do:
//   - Subjective red flags (price_too_low, vague_description, etc.)
//   - Cognitive bias detection
//   - Overall risk scoring (factoring in both rule flags and AI findings)
//   - Human-readable risk narrative and reflection prompts
//
// Input:
//   listingData — expanded scraper output (see docs/scam-detecting-plan.md §6)
//   preFlags    — array of { id, severity, evidence } from the rule engine
//   userContext — optional string with user-provided context (or null)
//
// Output: { risk, findings, reflection_prompts } (validated)
// Throws on: OpenAI errors, validation failures

const AI_FLAGS = RED_FLAGS.filter((f) => f.engine === "ai");

// ── Formatting helpers ────────────────────────────────────────────

function formatPrice(price) {
  if (!price) return "Not available";
  if (typeof price === "string") return price;
  let str = `$${price.amount} ${price.currency || "CAD"}`;
  if (price.originalAmount) {
    const dropPct = Math.round(((price.originalAmount - price.amount) / price.originalAmount) * 100);
    str += ` (original: $${price.originalAmount}, ${dropPct}% drop)`;
  }
  return str;
}

function formatLocation(location) {
  if (!location) return "Not available";
  if (typeof location === "string") return location;
  return [location.name, location.address].filter(Boolean).join(", ") || "Not available";
}

function formatSeller(seller) {
  if (!seller) return "Not available";
  const parts = [];
  if (seller.name) parts.push(`Name: ${seller.name}`);
  parts.push(`Verified: ${seller.verified ? "Yes" : "No"}`);
  if (seller.type) parts.push(`Type: ${seller.type}`);
  if (seller.numberOfListings != null) parts.push(`Active listings: ${seller.numberOfListings}`);
  parts.push(`Profile photo: ${seller.hasProfilePhoto ? "Yes" : "No"}`);
  return parts.join(", ");
}

function formatListingMeta(listing) {
  if (!listing) return "Not available";
  const parts = [];
  if (listing.activationDate) parts.push(`Posted: ${listing.activationDate}`);
  if (listing.views != null) parts.push(`Views: ${listing.views}`);
  if (listing.topAd) parts.push("Promoted (Top Ad)");
  return parts.join(", ") || "Not available";
}

function formatPayment(payment) {
  if (!payment) return "Not available";
  const parts = [];
  parts.push(`Cash accepted: ${payment.cashAccepted ? "Yes" : "No"}`);
  parts.push(`Cashless: ${payment.cashless ? "Yes" : "No"}`);
  parts.push(`Shipping: ${payment.shipping ? "Yes" : "No"}`);
  return parts.join(", ");
}

// ── Core functions ────────────────────────────────────────────────

function buildUserMessage(listingData, preFlags, userContext) {
  const sections = [];

  // Section 1: Listing data
  sections.push(`=== LISTING DATA ===
Title: ${listingData.title || "Not available"}
Description: ${listingData.description || "Not available"}
Price: ${formatPrice(listingData.price)}
Category: ${listingData.category ? listingData.category.join(" > ") : "Not available"}
Condition: ${listingData.condition || "Not available"}
Location: ${formatLocation(listingData.location)}
Images: ${listingData.images ? `${listingData.images.count} photo(s)` : "0 photos"}
Seller: ${formatSeller(listingData.seller)}
Listing metadata: ${formatListingMeta(listingData.listing)}
Payment: ${formatPayment(listingData.payment)}`);

  // Section 2: Pre-flagged findings
  if (preFlags.length === 0) {
    sections.push(`=== PRE-FLAGGED FINDINGS (confirmed by rule engine — do not re-evaluate) ===
None.`);
  } else {
    const flagLines = preFlags.map((f) => `- [${f.severity.toUpperCase()}] ${f.id}: ${f.evidence}`);
    sections.push(`=== PRE-FLAGGED FINDINGS (confirmed by rule engine — do not re-evaluate) ===
${flagLines.join("\n")}`);
  }

  // Section 3: AI flag definitions
  const aiLines = AI_FLAGS.map((f) => `- ${f.id} (${f.severity}): ${f.description}`);
  sections.push(`=== AI FLAGS TO EVALUATE ===
Evaluate the listing against each of these flags. Only include a flag in your findings if you find genuine evidence for it:
${aiLines.join("\n")}`);

  // Section 4: User context (conditional)
  if (userContext) {
    sections.push(`=== USER CONTEXT ===
The user said: "${userContext}"`);
  }

  return sections.join("\n\n");
}

async function callOpenAI(userMessage) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT);

  try {
    const response = await client.chat.completions.create(
      {
        model: OPENAI_MODEL,
        temperature: OPENAI_TEMPERATURE,
        max_tokens: OPENAI_MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      },
      { signal: controller.signal },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      const error = new Error("OpenAI returned an empty response.");
      error.statusCode = 503;
      error.code = "SERVICE_UNAVAILABLE";
      throw error;
    }

    return JSON.parse(content);
  } catch (err) {
    if (err.statusCode && err.code) throw err;

    if (err.name === "AbortError") {
      const error = new Error("AI analysis timed out.");
      error.statusCode = 408;
      error.code = "TIMEOUT";
      throw error;
    }

    if (err.status === 429) {
      const error = new Error("AI service rate limit exceeded. Please try again later.");
      error.statusCode = 429;
      error.code = "RATE_LIMITED";
      throw error;
    }

    const error = new Error(`AI analysis failed: ${err.message}`);
    error.statusCode = 503;
    error.code = "SERVICE_UNAVAILABLE";
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function validateAnalysisResponse(parsed) {
  function fail(reason) {
    const error = new Error(`AI response validation failed: ${reason}`);
    error.statusCode = 503;
    error.code = "SERVICE_UNAVAILABLE";
    throw error;
  }

  if (!parsed || typeof parsed !== "object") fail("Response is not an object");

  // Validate risk
  if (!parsed.risk || typeof parsed.risk !== "object") fail("Missing risk object");
  if (typeof parsed.risk.score !== "number" || parsed.risk.score < 0 || parsed.risk.score > 100) fail("risk.score must be a number 0-100");
  if (typeof parsed.risk.summary !== "string" || parsed.risk.summary.trim().length === 0) fail("risk.summary must be a non-empty string");

  const VALID_LEVELS = ["low", "medium", "high"];
  if (!VALID_LEVELS.includes(parsed.risk.level)) fail("risk.level must be low, medium, or high");

  // Consistency enforcement: score is source of truth
  const correctLevel = parsed.risk.score <= 33 ? "low" : parsed.risk.score <= 66 ? "medium" : "high";
  if (parsed.risk.level !== correctLevel) {
    parsed.risk.level = correctLevel;
  }

  // Validate findings
  if (!Array.isArray(parsed.findings)) fail("findings must be an array");

  const VALID_TYPES = ["red_flag", "cognitive_bias"];
  const VALID_SEVERITIES = ["low", "medium", "high"];

  for (let i = 0; i < parsed.findings.length; i++) {
    const f = parsed.findings[i];
    if (!f || typeof f !== "object") fail(`findings[${i}] is not an object`);
    if (typeof f.id !== "string" || f.id.length === 0) fail(`findings[${i}].id must be a non-empty string`);
    if (!VALID_TYPES.includes(f.type)) fail(`findings[${i}].type must be red_flag or cognitive_bias`);
    if (typeof f.header !== "string" || f.header.length === 0) fail(`findings[${i}].header must be a non-empty string`);
    if (typeof f.summary !== "string" || f.summary.length === 0) fail(`findings[${i}].summary must be a non-empty string`);
    if (typeof f.explanation !== "string" || f.explanation.length === 0) fail(`findings[${i}].explanation must be a non-empty string`);
    if (!VALID_SEVERITIES.includes(f.severity)) fail(`findings[${i}].severity must be low, medium, or high`);
  }

  // Validate reflection_prompts
  if (!Array.isArray(parsed.reflection_prompts)) fail("reflection_prompts must be an array");

  for (let i = 0; i < parsed.reflection_prompts.length; i++) {
    const rp = parsed.reflection_prompts[i];
    if (!rp || typeof rp !== "object") fail(`reflection_prompts[${i}] is not an object`);
    if (typeof rp.id !== "string" || rp.id.length === 0) fail(`reflection_prompts[${i}].id must be a non-empty string`);
    if (typeof rp.prompt !== "string" || rp.prompt.length === 0) fail(`reflection_prompts[${i}].prompt must be a non-empty string`);
  }

  return parsed;
}

async function analyzeListing(listingData, preFlags, userContext) {
  const userMessage = buildUserMessage(listingData, preFlags, userContext);
  const parsed = await callOpenAI(userMessage);
  return validateAnalysisResponse(parsed);
}

module.exports = { analyzeListing };
