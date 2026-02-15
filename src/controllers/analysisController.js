const crypto = require("crypto");
const cache = require("../config/cache");
const scraperService = require("../services/scraperService");
const ruleEngine = require("../services/ruleEngine");
const RED_FLAGS = require("../config/redFlags");

// POST /api/analyses handler
//
// Hybrid pipeline:
//   1. Scrape listing data (scraperService)
//   2. Run deterministic rule checks (ruleEngine) → preFlags[]
//   3. Send listing data + preFlags to AI analysis (analysisService)
//   4. Merge rule flags + AI findings into final response
//   5. Cache and return
//
// Steps 2-4 return placeholder data for now.

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
    return res.status(200).json(cached);
  }

  try {
    // Step 1: Scrape
    const listingData = await scraperService.scrapeListing(url);

    if (!listingData.title && !listingData.description && !listingData.price) {
      return res.status(422).json({
        error: {
          code: "UNSUPPORTED_URL",
          message: "Could not extract listing data from the provided URL.",
        },
      });
    }

    // Step 2: Rule engine (deterministic)
    const preFlags = ruleEngine.evaluateRules(listingData);

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

    // Step 3: AI analysis (subjective)
    // TODO: call analysisService.analyzeListing(listingData, preFlags, userContext)

    // Step 4: Merge
    // TODO: combine preFlags + AI findings

    // Step 5: Assemble response (matches docs/api-docs.md contract)
    const analysisId = `an_${crypto.randomBytes(5).toString("hex")}`;

    // Compute risk score from rule engine findings using severity weights
    const SEVERITY_SCORES = { high: 25, medium: 12, low: 5 };
    const riskScore = Math.min(100, findings.reduce((sum, f) => sum + (SEVERITY_SCORES[f.severity] || 0), 0));
    const riskLevel = riskScore <= 33 ? "low" : riskScore <= 66 ? "medium" : "high";

    const RISK_SUMMARIES = {
      low: "No major red flags detected. Proceed with normal caution.",
      medium: "Some concerning signals were detected. Verify details before committing.",
      high: "Multiple red flags detected. Strong recommendation to verify or walk away.",
    };

    // Generate reflection prompts based on detected findings
    const reflectionPrompts = [];
    const flagIds = new Set(findings.map((f) => f.id));

    if (flagIds.has("price_drop_extreme") || flagIds.has("free_or_near_free")) {
      reflectionPrompts.push({ id: "rp_price", prompt: "Are you evaluating this price on its own merits, or does it just look good compared to the 'original' price?" });
    }
    if (flagIds.has("urgency_language")) {
      reflectionPrompts.push({ id: "rp_urgency", prompt: "Why does this need to happen so quickly? Would a legitimate seller pressure you this way?" });
    }
    if (flagIds.has("seller_unverified") || flagIds.has("seller_no_photo") || flagIds.has("seller_few_listings")) {
      reflectionPrompts.push({ id: "rp_trust", prompt: "What makes you trust this seller? Would you trust a stranger on the street with this same deal?" });
    }
    if (flagIds.has("contact_off_platform") || flagIds.has("request_deposit") || flagIds.has("unusual_payment_method")) {
      reflectionPrompts.push({ id: "rp_payment", prompt: "Why would a legitimate seller need you to pay or communicate outside the platform?" });
    }
    if (reflectionPrompts.length === 0 && findings.length > 0) {
      reflectionPrompts.push({ id: "rp_general", prompt: "If this deal seems too good to be true, what detail would explain why?" });
    }

    // Generate quiz questions based on detected findings (up to 3)
    const quizQuestions = buildQuizQuestions(findings);

    const response = {
      analysis_id: analysisId,
      created_at: new Date().toISOString(),
      source: {
        platform: "kijiji",
        url,
      },
      listing: listingData,
      risk: {
        score: riskScore,
        level: riskLevel,
        summary: RISK_SUMMARIES[riskLevel],
      },
      findings,
      reflection_prompts: reflectionPrompts,
      quiz: { questions: quizQuestions },
    };

    cache.set(url, response);
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
