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

    const response = {
      analysis_id: analysisId,
      created_at: new Date().toISOString(),
      source: {
        platform: "kijiji",
        url,
      },
      listing: listingData,
      risk: {
        score: 0,
        level: "low",
        summary: "Rule-based checks completed. AI analysis not yet implemented.",
      },
      findings,
      reflection_prompts: [],
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
