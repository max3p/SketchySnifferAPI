// Validates and normalizes the incoming request for POST /api/analyses.
//
// Checks:
// 1. req.body.url exists and is a non-empty string        --> 400 INVALID_REQUEST
// 2. URL parses successfully via new URL()                 --> 400 INVALID_REQUEST
// 3. Hostname includes "kijiji.ca"                         --> 422 UNSUPPORTED_URL
// 4. URL path contains "/v-" (listing pattern)             --> 422 UNSUPPORTED_URL
// 5. Normalize URL: trim, lowercase hostname, strip trailing slash
// 6. user_context: if present must be string, trim; default to null

// TODO: Implement validation logic
function validateAnalysis(req, res, next) {}

module.exports = validateAnalysis;
