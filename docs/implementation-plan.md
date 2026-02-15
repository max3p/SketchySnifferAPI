# Implementation Plan

Phased implementation plan for SketchySniffer MVP.

---

## Current Status

### Complete

| Component | File | Notes |
|---|---|---|
| Server & Express app | `src/server.js`, `src/app.js` | Boots, CORS, routes, error handler |
| Route | `src/routes/analyses.js` | POST / wired to validation + controller |
| Input validation | `src/middleware/validateAnalysis.js` | URL format, Kijiji domain, `/v-` path check |
| Error handler | `src/middleware/errorHandler.js` | Consistent `{ error: { code, message } }` shape |
| Cache | `src/config/cache.js` | In-memory TTL (1 hour), lazy eviction |
| Red flags config | `src/config/redFlags.js` | 14 rule + 6 AI flags with engine/severity |
| Scraper service | `src/services/scraperService.js` | 3-tier extraction, full expanded output |
| OpenAI client config | `src/config/openai.js` | Client singleton, model/temp/token constants |

### Skeleton (empty stubs)

| Component | File | Functions to implement |
|---|---|---|
| Rule engine | `src/services/ruleEngine.js` | 14 check functions + `evaluateRules()` orchestrator |
| AI analysis service | `src/services/analysisService.js` | `buildUserMessage()`, `callOpenAI()`, `validateAnalysisResponse()`, `analyzeListing()` |
| System prompt | `src/config/openai.js` | `SYSTEM_PROMPT` is empty string |

### Partial

| Component | File | What's left |
|---|---|---|
| Controller | `src/controllers/analysisController.js` | Steps 2-4 placeholder: call rule engine, call AI, merge results |

---

## Phase 1: Rule Engine

**Goal:** Implement all 14 deterministic checks so they run instantly on scraped data.

**File:** `src/services/ruleEngine.js`

### 1A. Data checks (10 functions)

Each function receives `listingData` and returns `null` (not triggered) or `{ id, severity, evidence }`.

| Function | Logic | Evidence example |
|---|---|---|
| `checkPriceDropExtreme` | `price.originalAmount` exists and `(orig - amount) / orig > 0.6` | `"Price dropped 53% ($850 → $400)"` |
| `checkFreeOrNearFree` | `price.amount <= 10` | `"Listed at $0"` |
| `checkSellerUnverified` | `seller.verified === false` | `"Seller account is not verified"` |
| `checkSellerNoPhoto` | `seller.hasProfilePhoto === false` | `"Seller has no profile photo"` |
| `checkSellerFewListings` | `seller.numberOfListings <= 2` | `"Seller has only 1 active listing"` |
| `checkNoImages` | `images.count === 0` or `images` is undefined | `"No photos provided"` |
| `checkSingleImage` | `images.count === 1` | `"Only 1 photo provided"` |
| `checkNoCashAccepted` | `payment.cashless === true && payment.cashAccepted === false` | `"Cash not accepted"` |
| `checkShortListingDuration` | `endDate - activationDate < 7 days` | `"Listing expires in 3 days"` |
| `checkPromotedCheapItem` | `listing.topAd === true && price.amount < 50` | `"Top Ad on a $15 item"` |

### 1B. Keyword/regex checks (4 functions)

Scan `listingData.description` (and optionally `title`) for patterns. Return matched phrases as evidence.

| Function | Patterns |
|---|---|
| `checkUrgencyLanguage` | Case-insensitive match: `must sell today`, `first come first served`, `won't last`, `act fast`, `moving sale`, `need gone`, `today only`, `serious buyers only`, `don't miss out`, `selling fast` |
| `checkContactOffPlatform` | Regex: email (`\S+@\S+\.\S+`), phone (`\d{3}[-.\s]?\d{3}[-.\s]?\d{4}`), plus keywords: `whatsapp`, `telegram`, `text me`, `call me`, `email me`, `dm me`, `instagram`, `signal` |
| `checkRequestDeposit` | Keywords: `deposit`, `e-transfer before`, `etransfer to hold`, `send payment`, `pay first`, `payment before`, `hold the item` |
| `checkUnusualPaymentMethod` | Keywords: `gift card`, `giftcard`, `crypto`, `bitcoin`, `btc`, `wire transfer`, `western union`, `moneygram`, `zelle`, `venmo`, `cashapp` |

### 1C. Orchestrator

`evaluateRules(listingData)` — iterate `RULE_FLAGS`, call `CHECK_MAP[flag.id]`, collect non-null results.

### 1D. Wire into controller

Update `analysisController.js` step 2: replace `const preFlags = []` with actual `ruleEngine.evaluateRules(listingData)` call. Convert each preFlag into a finding object matching the API response schema.

### Verification

- Start server, POST the sample ski listing URL
- Expect findings for: `seller_unverified`, `seller_no_photo`, `single_image`, `price_drop_extreme` (53% drop, under threshold — should NOT trigger since 53% < 60%)
- Manually test with crafted listing data containing urgency language, deposit requests, etc.

---

## Phase 2: System Prompt + AI Analysis Service

**Goal:** Implement the OpenAI integration so subjective red flags, cognitive biases, risk scoring, and reflection prompts are generated.

### 2A. System prompt

**File:** `src/config/openai.js` — write `SYSTEM_PROMPT`

The system prompt should define:
- Role: "You are a scam detection analyst for online marketplace listings"
- Task: Evaluate listings for subjective red flags and cognitive biases
- Input format: what the user message will contain (listing data, pre-flagged findings, AI flag definitions)
- Output JSON schema (must match `docs/api-docs.md` response contract):
  ```
  {
    risk: { score: 0-100, level, summary },
    findings: [{ id, type, header, summary, explanation, severity, evidence[] }],
    reflection_prompts: [{ id, prompt }]
  }
  ```
- Scoring rules:
  - Factor in pre-flagged rule engine findings when calculating score
  - High severity = 20-30 pts, Medium = 10-15 pts, Low = 3-7 pts
  - Risk levels: 0-33 low, 34-66 medium, 67-100 high
- Cognitive biases to detect: scarcity, urgency, anchoring, authority, social proof absence, loss aversion
- Instruction to NOT re-evaluate rule engine flags (they are confirmed facts)
- Instruction to generate 2-4 reflection prompts tailored to the specific listing

### 2B. Build user message

**File:** `src/services/analysisService.js` — implement `buildUserMessage(listingData, preFlags, userContext)`

Construct a structured text message containing:
1. **Listing data** — title, description, price (amount, original, drop%), category, condition, location, image count, seller profile
2. **Pre-flagged findings** — list of rule engine flags already triggered with evidence
3. **AI flag definitions** — the 6 `engine: "ai"` flags from `redFlags.js` for the model to evaluate
4. **User context** — if provided, include as "The user said: ..."

### 2C. OpenAI call

**File:** `src/services/analysisService.js` — implement `callOpenAI(userMessage)`

- Use the `client` from `config/openai.js`
- Model: `OPENAI_MODEL` (gpt-4o)
- Temperature: `OPENAI_TEMPERATURE` (0.4)
- Max tokens: `OPENAI_MAX_TOKENS` (2000)
- Response format: `{ type: "json_object" }` (JSON mode)
- Timeout: `OPENAI_TIMEOUT` (30s) via AbortController
- Error handling:
  - Timeout → throw with code `TIMEOUT`, statusCode 408
  - Rate limit (429) → throw with code `RATE_LIMITED`, statusCode 429
  - Other API errors → throw with code `SERVICE_UNAVAILABLE`, statusCode 503
- Parse response JSON and return

### 2D. Response validation

**File:** `src/services/analysisService.js` — implement `validateAnalysisResponse(parsed)`

Validate the AI response matches expected schema:
- `risk.score` is number 0-100
- `risk.level` is one of `low`, `medium`, `high`
- `risk.summary` is non-empty string
- `findings[]` each has required fields with correct types
- `reflection_prompts[]` each has `id` and `prompt`
- Consistency enforcement: if `risk.level` doesn't match score thresholds, override it
- Throw with code `SERVICE_UNAVAILABLE`, statusCode 503 on validation failure

### 2E. Orchestrator

**File:** `src/services/analysisService.js` — implement `analyzeListing(listingData, preFlags, userContext)`

1. Call `buildUserMessage()`
2. Call `callOpenAI()`
3. Call `validateAnalysisResponse()`
4. Return validated result

### Verification

- POST the sample ski listing → should return AI-generated findings, risk score, reflection prompts
- Verify risk score factors in rule engine preFlags
- Verify cognitive biases detected (anchoring from price drop)
- Verify response validates against `docs/api-docs.md` schema

---

## Phase 3: Controller Integration + Response Assembly

**Goal:** Wire everything together so the full pipeline runs end-to-end.

**File:** `src/controllers/analysisController.js`

### 3A. Wire the pipeline

Replace placeholder steps 2-4 with real calls:

```
Step 2: const preFlags = ruleEngine.evaluateRules(listingData);
Step 3: const aiResult = await analysisService.analyzeListing(listingData, preFlags, userContext);
Step 4: merge preFlags + aiResult.findings into final findings[]
```

### 3B. Merge logic

Convert each `preFlag` into a finding object:
```js
{
  id: preFlag.id,
  type: "red_flag",
  header: RED_FLAGS.find(f => f.id === preFlag.id).description,
  summary: preFlag.evidence,
  explanation: RED_FLAGS.find(f => f.id === preFlag.id).description,
  severity: preFlag.severity,
  evidence: [preFlag.evidence]
}
```

Concatenate with AI findings: `findings = [...ruleFlagFindings, ...aiResult.findings]`

### 3C. Assemble final response

```js
{
  analysis_id,
  created_at,
  source: { platform, url },
  listing: listingData,
  risk: aiResult.risk,
  findings: mergedFindings,
  reflection_prompts: aiResult.reflection_prompts,
  quiz: { questions: [] }   // MVP: empty
}
```

### Verification

- Full end-to-end test: POST real Kijiji listing URL
- Verify response contains both rule engine findings AND AI findings
- Verify risk score reflects all detected flags
- Verify response shape matches `docs/api-docs.md`
- Test error cases: invalid URL, non-Kijiji URL, unreachable URL

---

## Phase 4: Hardening + Edge Cases

**Goal:** Handle edge cases, add resilience, and prepare for deployment.

### 4A. Graceful AI failure

If the AI call fails (timeout, rate limit, API error), the controller should still return a useful response using only rule engine results:
- `risk.summary`: "AI analysis unavailable. Rule-based checks completed."
- `risk.score`: calculated from rule engine flags only (sum of severity weights)
- `findings`: rule engine findings only
- `reflection_prompts`: empty array

### 4B. Missing data handling

The rule engine should gracefully handle cases where scraper fields are missing:
- If `seller` is undefined → skip seller checks (don't crash)
- If `images` is undefined → treat as `no_images`
- If `price` is a string (Tier 1/3 fallback) → skip price math checks
- If `listing` metadata is undefined → skip duration/topAd checks

### 4C. Cache key normalization

Ensure the cache key is the normalized URL (already done in `validateAnalysis.js` middleware).

### 4D. Rate limiting

Add basic rate limiting to prevent abuse:
- Consider `express-rate-limit` middleware
- 10 requests per minute per IP

### Verification

- Test with a URL where Apollo state is missing (Tier 3 fallback only)
- Test with OpenAI API key revoked → verify graceful degradation
- Verify no crashes on missing fields

---

## Phase 5: Polish + Production

**Goal:** Final cleanup and deployment readiness.

### 5A. Logging

Replace `console.log` debugging with structured logging:
- Log scrape time, rule engine time, AI response time
- Log which flags were triggered
- Log errors with stack traces (server-side only, never in response)

### 5B. Security headers

Add `helmet` middleware for HTTP security headers.

### 5C. Environment validation

Validate all required env vars at startup (not just `OPENAI_API_KEY`).



---

## Dependency Notes

- `uuid` package is ESM-only on v13+ — currently using `crypto.randomBytes()` instead for ID generation. Consider removing `uuid` from `package.json` since it's unused.
- No new dependencies required for phases 1-3.
- Phase 4D (rate limiting) may require `express-rate-limit`.
- Phase 5B (security headers) may require `helmet`.
