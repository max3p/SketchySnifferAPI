const { v4: uuidv4 } = require("uuid");
const cache = require("../config/cache");
const scraperService = require("../services/scraperService");
const ruleEngine = require("../services/ruleEngine");
const analysisService = require("../services/analysisService");

// POST /api/analyses handler
//
// Hybrid pipeline:
//   1. Scrape listing data (scraperService)
//   2. Run deterministic rule checks (ruleEngine) → preFlags[]
//   3. Send listing data + preFlags to AI analysis (analysisService)
//   4. Merge rule flags + AI findings into final response
//   5. Cache and return

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
    // TODO: Implement — call ruleEngine.evaluateRules(listingData)
    // Returns preFlags[] — array of { id, severity, evidence }
    const preFlags = [];

    // Step 3: AI analysis (subjective)
    // TODO: Implement — call analysisService.analyzeListing(listingData, preFlags, userContext)
    // Returns { risk, findings, reflection_prompts }
    const aiResult = {};

    // Step 4: Merge
    // TODO: Implement — combine preFlags into aiResult.findings[]
    // Each preFlag becomes a finding with type: "red_flag"
    // AI findings are already in aiResult.findings[]
    // Final findings = rule findings + AI findings

    // Step 5: Assemble response
    const analysisId = `an_${uuidv4().replace(/-/g, "").slice(0, 10)}`;

    const response = {
      analysis_id: analysisId,
      created_at: new Date().toISOString(),
      source: {
        platform: "kijiji",
        url,
      },
      // TODO: Populate from merged results
      risk: {},
      findings: [],
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
