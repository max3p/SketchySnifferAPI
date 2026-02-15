// Validates and normalizes the incoming request for POST /api/analyses.
//
// Checks:
// 1. req.body.url exists and is a non-empty string        --> 400 INVALID_REQUEST
// 2. URL parses successfully via new URL()                 --> 400 INVALID_REQUEST
// 3. Hostname includes "kijiji.ca"                         --> 422 UNSUPPORTED_URL
// 4. URL path contains "/v-" (listing pattern)             --> 422 UNSUPPORTED_URL
// 5. Normalize URL: trim, lowercase hostname, strip trailing slash
// 6. user_context: if present must be string, trim; default to null

function validateAnalysis(req, res, next) {
  const { url, user_context } = req.body;

  if (typeof url !== "string" || url.trim().length === 0) {
    return res.status(400).json({
      error: { code: "INVALID_REQUEST", message: "A non-empty 'url' string is required." },
    });
  }

  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return res.status(400).json({
      error: { code: "INVALID_REQUEST", message: "Invalid URL format." },
    });
  }

  if (!parsed.hostname.includes("kijiji.ca")) {
    return res.status(422).json({
      error: { code: "UNSUPPORTED_URL", message: "Only Kijiji URLs are supported." },
    });
  }

  if (!parsed.pathname.includes("/v-")) {
    return res.status(422).json({
      error: {
        code: "UNSUPPORTED_URL",
        message: "URL does not appear to be a Kijiji listing. Expected path containing '/v-'.",
      },
    });
  }

  parsed.hostname = parsed.hostname.toLowerCase();
  let normalizedUrl = parsed.toString();
  if (normalizedUrl.endsWith("/")) {
    normalizedUrl = normalizedUrl.slice(0, -1);
  }
  req.body.url = normalizedUrl;

  if (user_context !== undefined && user_context !== null) {
    if (typeof user_context !== "string") {
      return res.status(400).json({
        error: { code: "INVALID_REQUEST", message: "'user_context' must be a string if provided." },
      });
    }
    req.body.user_context = user_context.trim() || null;
  } else {
    req.body.user_context = null;
  }

  next();
}

module.exports = validateAnalysis;
