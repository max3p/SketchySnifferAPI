const express = require("express");
const router = express.Router();

// POST /api/analyses
router.post("/", (req, res) => {
  // TODO: implement analysis logic
  res.status(501).json({ error: { code: "NOT_IMPLEMENTED", message: "Not yet implemented" } });
});

module.exports = router;
