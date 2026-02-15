const { client, OPENAI_MODEL, OPENAI_MAX_TOKENS, OPENAI_TEMPERATURE, OPENAI_TIMEOUT, SYSTEM_PROMPT } = require("../config/openai");
const RED_FLAGS = require("../config/redFlags");

// Sends listing data to OpenAI and returns a validated analysis result.
//
// Three responsibilities:
// 1. Prompt construction — build user message from listing data + red flags + user context
// 2. OpenAI call — GPT-4o, JSON mode, temperature 0.4, max_tokens 2000, 30s timeout
// 3. Response validation — verify AI JSON matches expected schema
//
// Input: listingData ({ title, description, price, location }), userContext (string or null)
// Output: { risk, findings, reflection_prompts } (validated)
// Throws on: OpenAI errors, validation failures

// TODO: Implement — build the user message string from listing data, RED_FLAGS, and userContext
function buildUserMessage(listingData, userContext) {}

// TODO: Implement — call OpenAI with system + user messages, JSON mode enabled
// Returns parsed JSON object from the AI response
async function callOpenAI(userMessage) {}

// TODO: Implement — validate the parsed AI response:
// - risk: score (0-100), level (low/medium/high), summary (string)
// - findings[]: id, type, header, summary, explanation, severity, evidence[]
// - reflection_prompts[]: id, prompt
// - Consistency: override risk.level if it doesn't match risk.score thresholds
// Throws on validation failure
function validateAnalysisResponse(parsed) {}

// TODO: Implement — orchestrate: build prompt, call OpenAI, validate, return
async function analyzeListing(listingData, userContext) {}

module.exports = { analyzeListing };
