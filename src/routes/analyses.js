const express = require("express");
const router = express.Router();
const validateAnalysis = require("../middleware/validateAnalysis");
const { analyzeListing } = require("../controllers/analysisController");

// POST /api/analyses
router.post("/", validateAnalysis, analyzeListing);

module.exports = router;
