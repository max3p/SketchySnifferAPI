const OpenAI = require("openai");

// Validate API key at import time — server won't start without it
if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const OPENAI_MODEL = "gpt-4o";
const OPENAI_MAX_TOKENS = 2000;
const OPENAI_TEMPERATURE = 0.4;
const OPENAI_TIMEOUT = 30000; // 30 seconds

// TODO: Write the full system prompt with:
// - Role definition (marketplace listing scam analyst)
// - Exact JSON output schema
// - Severity definitions (high/medium/low)
// - Risk level thresholds (0-33 low, 34-66 medium, 67-100 high)
// - Rules (2-6 findings, cite evidence, 2-3 reflection prompts, raw JSON only)
const SYSTEM_PROMPT = "";

module.exports = {
  client,
  OPENAI_MODEL,
  OPENAI_MAX_TOKENS,
  OPENAI_TEMPERATURE,
  OPENAI_TIMEOUT,
  SYSTEM_PROMPT,
};
