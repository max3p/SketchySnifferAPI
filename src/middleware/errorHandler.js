// Catch-all Express error handler.
// Returns the standard error response shape:
// { "error": { "code": "STRING", "message": "STRING" } }
//
// Handles:
// - err.type === "entity.parse.failed"  --> 400 INVALID_REQUEST (malformed JSON body)
// - Errors with a custom .statusCode and .code property --> use those
// - Everything else                     --> 500 INTERNAL_ERROR (never leak stack traces)

// TODO: Implement error handler
function errorHandler(err, req, res, next) {}

module.exports = errorHandler;
