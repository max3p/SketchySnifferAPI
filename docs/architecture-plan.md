# SketchySniffer - Architecture Plan

## Overview

SketchySniffer is an API that analyzes Kijiji marketplace listings for scam patterns and cognitive biases. A user submits a listing URL, the backend scrapes the listing, sends it to OpenAI for analysis, validates the result, and returns a structured risk assessment.

**MVP Scope:** Kijiji only. No quiz. No database. No frontend.

## Request Flow

```
POST /api/analyses { url, user_context? }
        |
   [ Validate Input ]  --- fail --> 400 / 422
        |
   [ Check Cache ]  --- hit --> return cached 200
        |
   [ Scrape Listing ]  --- fail --> 502 / 408
        |
   [ Analyze with OpenAI ]  --- fail --> 408 / 429 / 503
        |
   [ Validate AI Response ]  --- fail --> 503
        |
   [ Assemble Response + Cache ]
        |
   200 OK
```

## Project Structure

```
src/
├── app.js                        # Express app: cors, json, routes, errorHandler
├── server.js                     # Entry point (exists)
├── routes/
│   └── analyses.js               # POST / --> validateAnalysis --> controller
├── controllers/
│   └── analysisController.js     # Orchestrates scrape + analyze, cache, error mapping
├── services/
│   ├── scraperService.js         # Fetch Kijiji HTML, parse with cheerio (3-tier)
│   └── analysisService.js        # Build prompt, call OpenAI, validate response
├── middleware/
│   ├── validateAnalysis.js       # URL format, kijiji.ca domain, normalize
│   └── errorHandler.js           # Catch-all, maps errors to API error shape
└── config/
    ├── openai.js                 # OpenAI client singleton + system prompt template
    ├── redFlags.js               # Hardcoded red flag pattern definitions
    └── cache.js                  # In-memory TTL cache
```

## Component Responsibilities

### Route Layer (`routes/analyses.js`)

Wires `POST /` to validation middleware + controller. No logic.

### Validation Middleware (`middleware/validateAnalysis.js`)

- `url` exists, is non-empty string, parses as valid URL
- Hostname includes `kijiji.ca`
- URL path looks like a listing (contains `/v-`)
- Normalizes URL (trim, lowercase hostname, strip trailing slash)
- `user_context` if present must be string; defaults to `null`
- Returns 400 `INVALID_REQUEST` or 422 `UNSUPPORTED_URL` on failure

### Error Handler (`middleware/errorHandler.js`)

Catch-all Express error handler. Returns the standard error shape:

```json
{ "error": { "code": "STRING", "message": "STRING" } }
```

Handles malformed JSON bodies (`entity.parse.failed` --> 400). Everything else --> 500.

### Controller (`controllers/analysisController.js`)

The orchestrator. Only component that knows about HTTP status codes (besides middleware).

1. Check cache by normalized URL --> hit? return immediately
2. Call `scraperService.scrapeListing(url)` --> get listing data
3. Verify at least some data was extracted --> otherwise 422
4. Call `analysisService.analyzeListing(listingData, userContext)` --> get AI analysis
5. Generate `analysis_id` (`an_` + 10 hex chars from UUID)
6. Assemble full response matching API contract (quiz: `null` for MVP)
7. Cache the response, return 200

**Error mapping (try/catch):**

| Service Error                  | HTTP Status | Error Code             |
| ------------------------------ | ----------- | ---------------------- |
| Scraper network failure        | 502         | `UPSTREAM_FETCH_FAILED`|
| Scraper/AI timeout             | 408         | `TIMEOUT`              |
| No listing data extracted      | 422         | `UNSUPPORTED_URL`      |
| OpenAI AuthenticationError     | 500         | `INTERNAL_ERROR`       |
| OpenAI RateLimitError          | 429         | `RATE_LIMITED`         |
| OpenAI APIConnectionError      | 503         | `SERVICE_UNAVAILABLE`  |
| AI response validation failure | 503         | `SERVICE_UNAVAILABLE`  |

### Scraper Service (`services/scraperService.js`)

Ported from Hackathon-Prep (`Hackathon-Prep/src/services/scraperService.js`).

**Input:** URL string
**Output:** `{ title, description, price, location }` (any field may be undefined)
**Approach:** Native `fetch` + cheerio, 3-tier fallback:

1. JSON-LD structured data (`<script type="application/ld+json">`)
2. Next.js `__NEXT_DATA__` with Apollo state
3. Meta tags (`og:title`, `og:description`) + DOM selectors

Enhancement over Hackathon-Prep: `AbortController` with 10s timeout on fetch.

### Analysis Service (`services/analysisService.js`)

The core AI integration. Three responsibilities:

1. **Prompt construction** - builds user message from listing data + red flags list + user context
2. **OpenAI call** - GPT-4o, JSON mode, temperature 0.4, max_tokens 2000, 30s timeout
3. **Response validation** - validates AI JSON matches expected schema before returning

**Input:** listing data object + userContext (string or null)
**Output:** `{ risk, findings, reflection_prompts }` (validated)

### OpenAI Config (`config/openai.js`)

- OpenAI client singleton (validates `OPENAI_API_KEY` at import time)
- Model selection: `gpt-4o`
- System prompt template (see Prompt Engineering section)

### Red Flags Config (`config/redFlags.js`)

Hardcoded array of red flag pattern definitions. Each entry has an `id` and `description`. Injected into every AI prompt so the model evaluates listings against a consistent baseline.

Example entries:

- `price_too_low`: Price significantly below market value
- `urgency_language`: Pressure language ("must sell today", "first come first served")
- `vague_description`: Lacks specific details about condition or history
- `contact_off_platform`: Requests to communicate outside the platform
- `too_good_to_be_true`: Offer seems unrealistically favorable
- `request_deposit`: Asks for payment before meeting

Full list to be determined after testing what data the scraper reliably extracts.

### Cache (`config/cache.js`)

In-memory `Map` with lazy TTL eviction.

- **Key:** normalized URL
- **Value:** `{ data: <full response object>, createdAt: <timestamp> }`
- **TTL:** 1 hour (3,600,000 ms)
- **Eviction:** lazy (check on read; if expired, delete and return undefined)
- **Exports:** `get(key)`, `set(key, data)`, `has(key)`

Cache stores the complete response object, so a cache hit requires zero computation.

## Prompt Engineering

Two-message structure: static **system message** (from config) + dynamic **user message** (per-request).

### System Message

Establishes:

- Role: marketplace listing scam analyst
- Exact JSON output schema (field by field)
- Severity definitions (high/medium/low)
- Risk level thresholds (0-33 low, 34-66 medium, 67-100 high)
- Rules: 2-6 findings, cite evidence, 2-3 reflection prompts, no invented info, raw JSON only

### User Message

Contains:

- Listing data (title, description, price, location -- "Not available" if missing)
- Formatted red flags list from `redFlags.js` (one per line)
- User context (if provided)

### Why This Split

- System message benefits from OpenAI prefix caching (static across requests)
- System = _how to behave_; User = _what to analyze_
- JSON mode (`response_format: { type: 'json_object' }`) + explicit schema in system prompt = double enforcement

## Response Validation

After OpenAI returns JSON, validate before sending to client.

**Structural checks (fail fast):**

- `risk` exists with `score` (number 0-100), `level` (low/medium/high), `summary` (string)
- `findings` is array with 1+ items, each with: `id`, `type` (red_flag|cognitive_bias), `header`, `summary`, `explanation`, `severity`, `evidence[]`
- `reflection_prompts` is array with 1+ items, each with: `id`, `prompt`

**Consistency enforcement (fix, don't reject):**

- If `risk.level` doesn't match `risk.score`, override level based on score thresholds. Score is source of truth.

**On failure:** throw error --> controller returns 503.

## Dependencies

### Add

| Package   | Purpose                  |
| --------- | ------------------------ |
| `cheerio` | HTML parsing for scraping|
| `openai`  | OpenAI SDK               |
| `uuid`    | Generate analysis IDs    |

### Keep (already installed)

express, cors, dotenv

### Not Adding (and why)

- `node-cache` / `lru-cache` -- cache is ~20 lines of code
- `zod` / `joi` -- manual validation sufficient for single fixed shape
- `axios` -- native fetch works, already proven in Hackathon-Prep
- `helmet` / `rate-limiter` -- add when deploying to production

## Environment Variables

```
PORT=3000
OPENAI_API_KEY=sk-...
```

`OPENAI_API_KEY` validated at import time in `config/openai.js`. Server won't start without it.

## Key Decisions Summary

| Decision                                          | Rationale                                            |
| ------------------------------------------------- | ---------------------------------------------------- |
| Services have no Express awareness                | Testable in isolation, clear boundaries              |
| Controller owns error-to-HTTP mapping             | Single place for all status code decisions           |
| Red flags hardcoded, not AI-generated             | Consistency, reduced hallucination, tunable          |
| Cache stores full response object                 | Cache hit = zero computation                         |
| System prompt owns schema, user prompt owns data  | Clean separation + OpenAI prefix caching             |
| Lazy cache eviction, no timers                    | Simplest correct approach for MVP                    |
| `risk.score` overrides `risk.level`               | AI sometimes contradicts itself; deterministic fix   |
| `quiz: null` in every MVP response                | API contract stable from day one                     |
| Port scraper from Hackathon-Prep                  | Proven code, 3-tier fallback already works           |
