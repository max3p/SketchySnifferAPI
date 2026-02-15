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

// TODO: Implement — build the user message from:
//   1. Listing data (title, description, price, category, seller, images, etc.)
//   2. Pre-evaluated rule flags (so the AI knows what's already been flagged)
//   3. AI-only flag definitions (so the AI knows what to look for)
//   4. User context (if provided)
//
// The prompt should instruct the AI to:
//   - NOT re-evaluate rule flags (they're already confirmed)
//   - Evaluate the AI_FLAGS list against the listing
//   - Detect cognitive biases (anchoring, scarcity, urgency, etc.)
//   - Produce an overall risk score (0-100) factoring in ALL flags (rule + AI)
//   - Generate a risk narrative and reflection prompts
function buildUserMessage(listingData, preFlags, userContext) {}

// TODO: Implement — call OpenAI with system + user messages, JSON mode enabled
// Returns parsed JSON object from the AI response
async function callOpenAI(userMessage) {}

// TODO: Implement — validate the parsed AI response:
// - risk: score (0-100), level (low/medium/high), summary (string)
// - findings[]: id, type, header, summary, explanation, severity, evidence[]
// - reflection_prompts[]: id, prompt
// - Consistency: override risk.level if it doesn't match risk.score thresholds
// Throws on validation failure
function validateAnalysisResponse(parsed) {}

// TODO: Implement — orchestrate: build prompt, call OpenAI, validate, return
async function analyzeListing(listingData, preFlags, userContext) {}

module.exports = { analyzeListing };
