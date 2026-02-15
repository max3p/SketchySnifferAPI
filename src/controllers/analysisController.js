const crypto = require("crypto");
const cache = require("../config/cache");
const scraperService = require("../services/scraperService");
const ruleEngine = require("../services/ruleEngine");
const RED_FLAGS = require("../config/redFlags");
const analysisService = require("../services/analysisService");
const { buildQuizQuestions } = require("../config/quizBank");

// Severity weights for rule-only fallback scoring (matches docs/scam-detecting-plan.md).
const SEVERITY_WEIGHTS = { high: 18, medium: 8, low: 3 };

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
    console.log(`[step 1/5] Scraped listing in ${Date.now() - scrapeStart}ms, title: "${listingData.title || "N/A"}"`);

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
    console.log(`[step 2/5] Rule engine in ${Date.now() - ruleStart}ms, ${preFlags.length} flag(s): ${preFlags.map((f) => f.id).join(", ") || "none"}`);

    const findings = preFlags.map((preFlag) => {
      const flagDef = RED_FLAGS.find((f) => f.id === preFlag.id);
      return {
        id: preFlag.id,
        type: "red_flag",
        header: flagDef?.label || preFlag.id,
        summary: preFlag.evidence,
        explanation: flagDef?.description || preFlag.evidence,
        severity: preFlag.severity,
      };
    });

    // Step 3: AI analysis (subjective), with graceful fallback
    let aiResult = null;
    try {
      console.log("[step 3/5] Calling OpenAI...");
      const aiStart = Date.now();
      aiResult = await analysisService.analyzeListing(listingData, preFlags, userContext);
      console.log(`[step 3/5] AI analysis in ${Date.now() - aiStart}ms, ${aiResult.findings.length} finding(s), risk score: ${aiResult.risk.score}`);
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
    // Strip internal-only fields (evidence) and sort by severity (high → medium → low)
    const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
    const clientFindings = mergedFindings
      .map(({ evidence, ...rest }) => rest)
      .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));
    console.log(`[step 4/5] Merged findings: ${clientFindings.length} total`);

    const quizQuestions = buildQuizQuestions(mergedFindings);

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
      risk,
      findings: clientFindings,
      reflection_prompts: reflectionPrompts,
      quiz: { questions: quizQuestions },
    };

    cache.set(url, response);
    console.log(`[step 5/5] Done in ${Date.now() - startTime}ms, risk: ${risk.level} (${risk.score}/100)\n`);
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
