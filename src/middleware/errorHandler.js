// Catch-all Express error handler.
// Returns the standard error response shape:
// { "error": { "code": "STRING", "message": "STRING" } }
//
// Handles:
// - err.type === "entity.parse.failed"  --> 400 INVALID_REQUEST (malformed JSON body)
// - Errors with a custom .statusCode and .code property --> use those
// - Everything else                     --> 500 INTERNAL_ERROR (never leak stack traces)

function errorHandler(err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: { code: "INVALID_REQUEST", message: "Malformed JSON in request body.", details: {} },
    });
  }

  if (err.statusCode && err.code) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details || {} },
    });
  }

  console.error("Unhandled error:", err.stack || err);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", details: {} },
  });
}

module.exports = errorHandler;
