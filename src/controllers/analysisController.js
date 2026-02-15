const crypto = require("crypto");
const cache = require("../config/cache");
const scraperService = require("../services/scraperService");
const ruleEngine = require("../services/ruleEngine");
const RED_FLAGS = require("../config/redFlags");
const analysisService = require("../services/analysisService");

// POST /api/analyses handler
//
// Hybrid pipeline:
//   1. Scrape listing data (scraperService)
//   2. Run deterministic rule checks (ruleEngine) → preFlags[]
//   3. Send listing data + preFlags to AI analysis (analysisService)
//   4. Merge rule flags + AI findings into final response
//   5. Cache and return
//
// All steps implemented.

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

    // Step 3: AI analysis (subjective)
    console.log("[step 3/5] Calling OpenAI...");
    const aiStart = Date.now();
    const aiResult = await analysisService.analyzeListing(listingData, preFlags, userContext);
    console.log(`[step 3/5] AI analysis in ${Date.now() - aiStart}ms — ${aiResult.findings.length} finding(s), risk score: ${aiResult.risk.score}`);

    // Step 4: Merge rule findings + AI findings
    const mergedFindings = [...findings, ...aiResult.findings];
    console.log(`[step 4/5] Merged findings: ${mergedFindings.length} total (${findings.length} rule + ${aiResult.findings.length} AI)`);

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
      risk: aiResult.risk,
      findings: mergedFindings,
      reflection_prompts: aiResult.reflection_prompts,
      quiz: { questions: [] },
    };

    cache.set(url, response);
    console.log(`[step 5/5] Done in ${Date.now() - startTime}ms — risk: ${aiResult.risk.level} (${aiResult.risk.score}/100)\n`);
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
