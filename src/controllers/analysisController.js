const crypto = require("crypto");
const cache = require("../config/cache");
const scraperService = require("../services/scraperService");
const ruleEngine = require("../services/ruleEngine");
const RED_FLAGS = require("../config/redFlags");
const analysisService = require("../services/analysisService");

// Severity weights for rule-only fallback scoring (matches docs/scam-detecting-plan.md).
const SEVERITY_WEIGHTS = { high: 25, medium: 12, low: 5 };

function calculateRuleOnlyScore(preFlags) {
  const raw = preFlags.reduce((sum, f) => sum + (SEVERITY_WEIGHTS[f.severity] || 0), 0);
  return Math.min(raw, 100);
}

// POST /api/analyses handler
//
// Hybrid pipeline:
//   1. Scrape listing data (scraperService)
//   2. Run deterministic rule checks (ruleEngine) → preFlags[]
//   3. Send listing data + preFlags to AI analysis (analysisService)
//   4. Merge rule flags + AI findings into final response
//   5. Cache and return
//
// If the AI call fails, falls back to rule-engine-only response (4A hardening).

// Quiz question bank — each entry maps to one or more finding IDs that trigger it.
const QUIZ_BANK = [
  {
    triggerIds: ["request_deposit", "unusual_payment_method"],
    question: {
      id: "q_deposit",
      prompt: "A seller asks you to send a deposit via e-transfer before meeting. What is the safest response?",
      options: [
        { id: "a", text: "Send a small deposit to reserve it" },
        { id: "b", text: "Decline and propose meeting in a public place to pay in person" },
        { id: "c", text: "Send the deposit but ask for a receipt" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Strong critical thinking",
        correct_body: "Declining deposits and meeting in person reduces exposure to common prepayment scams.",
        incorrect_title: "Pause and reconsider",
        incorrect_body: "Sending money before seeing the item is one of the most common scam tactics. A receipt from a scammer is worthless.",
      },
    },
  },
  {
    triggerIds: ["seller_unverified", "seller_no_photo", "seller_few_listings"],
    question: {
      id: "q_seller",
      prompt: "You find a great deal from a seller with no profile photo and no verification. What should you do?",
      options: [
        { id: "a", text: "It's probably fine — lots of people don't bother with profiles" },
        { id: "b", text: "Check their other listings and ask questions before committing" },
        { id: "c", text: "Ignore the profile and focus only on the item" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Good instinct",
        correct_body: "Verifying the seller's history and asking questions helps distinguish legitimate sellers from throwaway scam accounts.",
        incorrect_title: "Think again",
        incorrect_body: "Unverified accounts with no photo and few listings are a common pattern for disposable scam profiles.",
      },
    },
  },
  {
    triggerIds: ["urgency_language"],
    question: {
      id: "q_urgency",
      prompt: "A listing says \"Must sell today — first come first served!\" How should this affect your decision?",
      options: [
        { id: "a", text: "Act quickly before someone else gets it" },
        { id: "b", text: "Recognize this as a pressure tactic and take extra time to verify" },
        { id: "c", text: "It means the seller is motivated, so offer a lower price" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Well spotted",
        correct_body: "Urgency language is designed to short-circuit careful thinking. Legitimate deals don't usually vanish in minutes.",
        incorrect_title: "Be careful",
        incorrect_body: "Scammers use urgency to pressure you into acting before you can verify the deal. A real seller will wait for a serious buyer.",
      },
    },
  },
  {
    triggerIds: ["contact_off_platform"],
    question: {
      id: "q_offplatform",
      prompt: "A seller asks you to continue the conversation on WhatsApp instead of the platform. Why might this be risky?",
      options: [
        { id: "a", text: "It's not risky — WhatsApp is just easier to use" },
        { id: "b", text: "Moving off-platform removes the safety net of the marketplace's records and protections" },
        { id: "c", text: "It only matters if they also ask for payment" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Correct",
        correct_body: "Marketplaces log conversations for dispute resolution. Scammers move off-platform to eliminate that evidence trail.",
        incorrect_title: "Think about it",
        incorrect_body: "Off-platform communication removes your ability to report the conversation and makes disputes much harder to resolve.",
      },
    },
  },
  {
    triggerIds: ["price_drop_extreme", "free_or_near_free"],
    question: {
      id: "q_price",
      prompt: "An item normally worth $800 is listed for $200. What is the most important thing to consider?",
      options: [
        { id: "a", text: "Jump on it — this is a rare bargain" },
        { id: "b", text: "Ask why the price is so low and verify the item exists before paying" },
        { id: "c", text: "It's probably just someone who needs quick cash" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Smart approach",
        correct_body: "Extreme discounts are the #1 lure in marketplace scams. Always verify before committing money.",
        incorrect_title: "Slow down",
        incorrect_body: "Prices far below market value are the most common bait in online scams. If it seems too good to be true, it usually is.",
      },
    },
  },
  {
    triggerIds: ["no_images", "single_image"],
    question: {
      id: "q_images",
      prompt: "A high-value listing has only one photo (or none). What does this suggest?",
      options: [
        { id: "a", text: "The seller is just lazy about photos" },
        { id: "b", text: "Ask the seller for additional photos from different angles before proceeding" },
        { id: "c", text: "One photo is enough if the description is detailed" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Good thinking",
        correct_body: "Legitimate sellers of valuable items almost always provide multiple photos. Requesting more is a simple way to test authenticity.",
        incorrect_title: "Consider this",
        incorrect_body: "Scam listings often use a single stock photo or no images at all. Multiple original photos are a basic trust signal.",
      },
    },
  },
];

function buildQuizQuestions(findings) {
  const flagIds = new Set(findings.map((f) => f.id));
  const questions = [];

  for (const entry of QUIZ_BANK) {
    if (questions.length >= 3) break;
    const matchedIds = entry.triggerIds.filter((id) => flagIds.has(id));
    if (matchedIds.length === 0) continue;

    questions.push({
      ...entry.question,
      linked_finding_ids: matchedIds,
    });
  }

  return questions;
}

async function analyzeListing(req, res, next) {
  const { url, user_context: userContext } = req.body;

  const cached = cache.get(url);
  if (cached) {
    console.log(`[cache hit] ${url}`);
    return res.status(200).json(cached);
  }

  console.log(`\n[analysis] Starting analysis for: ${url}`);
  const startTime = Date.now();

  try {
    // Step 1: Scrape
    const scrapeStart = Date.now();
    const listingData = await scraperService.scrapeListing(url);
    console.log(`[step 1/5] Scraped listing in ${Date.now() - scrapeStart}ms — title: "${listingData.title || "N/A"}"`);

    if (!listingData.title && !listingData.description && !listingData.price) {
      console.log("[analysis] No data extracted, returning 422");
      return res.status(422).json({
        error: {
          code: "UNSUPPORTED_URL",
          message: "Could not extract listing data from the provided URL.",
          details: {},
        },
      });
    }

    // Step 2: Rule engine (deterministic)
    const ruleStart = Date.now();
    const preFlags = ruleEngine.evaluateRules(listingData);
    console.log(`[step 2/5] Rule engine in ${Date.now() - ruleStart}ms — ${preFlags.length} flag(s): ${preFlags.map((f) => f.id).join(", ") || "none"}`);

    const findings = preFlags.map((preFlag) => {
      const flagDef = RED_FLAGS.find((f) => f.id === preFlag.id);
      return {
        id: preFlag.id,
        type: "red_flag",
        header: flagDef ? flagDef.description : preFlag.id,
        summary: preFlag.evidence,
        explanation: flagDef ? flagDef.description : preFlag.evidence,
        severity: preFlag.severity,
        evidence: [preFlag.evidence],
      };
    });

    // Step 3: AI analysis (subjective) — with graceful fallback
    let aiResult = null;
    try {
      console.log("[step 3/5] Calling OpenAI...");
      const aiStart = Date.now();
      aiResult = await analysisService.analyzeListing(listingData, preFlags, userContext);
      console.log(`[step 3/5] AI analysis in ${Date.now() - aiStart}ms — ${aiResult.findings.length} finding(s), risk score: ${aiResult.risk.score}`);
    } catch (aiErr) {
      console.warn(`[step 3/5] AI analysis failed (${aiErr.code || "UNKNOWN"}): ${aiErr.message}`);
    }

    // Step 4: Merge rule findings + AI findings
    let mergedFindings;
    let risk;
    let reflectionPrompts;

    if (aiResult) {
      mergedFindings = [...findings, ...aiResult.findings];
      risk = aiResult.risk;
      reflectionPrompts = aiResult.reflection_prompts;
    } else {
      // Fallback: rule-engine-only response
      mergedFindings = findings;
      const score = calculateRuleOnlyScore(preFlags);
      risk = {
        score,
        level: score <= 33 ? "low" : score <= 66 ? "medium" : "high",
        summary: "AI analysis unavailable. Rule-based checks completed.",
      };
      reflectionPrompts = [];
    }
    console.log(`[step 4/5] Merged findings: ${mergedFindings.length} total`);

    // Step 5: Assemble response (matches docs/api-docs.md contract)
    const analysisId = `an_${crypto.randomBytes(5).toString("hex")}`;

    const response = {
      analysis_id: analysisId,
      created_at: new Date().toISOString(),
      source: {
        platform: "kijiji",
        url,
      },
      listing: listingData, // DEBUG: not in API contract — remove in Phase 5
      risk,
      findings: mergedFindings,
      reflection_prompts: reflectionPrompts,
      quiz: { questions: quizQuestions },
    };

    cache.set(url, response);
    console.log(`[step 5/5] Done in ${Date.now() - startTime}ms — risk: ${risk.level} (${risk.score}/100)\n`);
    return res.status(200).json(response);
  } catch (err) {
    if (err.statusCode && err.code) {
      return next(err);
    }

    console.error("Analysis error:", err.stack || err);
    const unexpectedError = new Error("An unexpected error occurred during analysis.");
    unexpectedError.statusCode = 500;
    unexpectedError.code = "INTERNAL_ERROR";
    return next(unexpectedError);
  }
}

module.exports = { analyzeListing };
