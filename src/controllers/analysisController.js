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
      quiz: { questions: [] },
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
