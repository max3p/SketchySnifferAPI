**Base URL:** `https://sketchysnifferapi-production.up.railway.app/api/`

**Content-Type:** `application/json`

---

## POST `/analyses`

Analyze a marketplace listing URL and return risk assessment, combined findings (red flags + cognitive biases), reflection prompts, and a quiz.

### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | string | ✅ | Full listing URL |
| `user_context` | string | optional | Optional user note to tailor prompts |

### Example Request

```json
{
  "url": "https://www.kijiji.ca/v-ski/calgary/dps-wailer-pagoda-94-x-178/1732998393",
  "user_context": "The price feels like a steal and I don't want to miss it."
}
```

---

## 200 OK Response

### Response Body

| Field | Type | Description |
| --- | --- | --- |
| `analysis_id` | string | Unique ID for this analysis (for caching/traceability) |
| `created_at` | string (ISO 8601) | Timestamp of analysis |
| `source` | object | Source metadata |
| `source.platform` | string | `kijiji` | `facebook_marketplace` | `unknown` |
| `source.url` | string | Normalized URL analyzed |
| `risk` | object | Risk summary |
| `risk.score` | number | 0–100 (higher = riskier) |
| `risk.level` | string | `low` | `medium` | `high` |
| `risk.summary` | string | Plain-language summary |
| `findings` | array | Combined red flags + cognitive bias triggers |
| `reflection_prompts` | array | Reflection prompts |
| `quiz` | object | Quiz section |
| `quiz.questions` | array | Quiz questions |

### `findings[]` item

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Finding identifier |
| `type` | string | `red_flag` | `cognitive_bias` |
| `header` | string | Short title |
| `summary` | string | One-line summary |
| `explanation` | string | Longer explanation |
| `severity` | string | `low` | `medium` | `high` |
| `evidence` | array of strings | Supporting signals/phrases |

### `quiz.questions[]` item

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Question ID |
| `linked_finding_ids` | array of strings | Findings that triggered the question |
| `prompt` | string | Question text |
| `options` | array | Answer options |
| `options[].id` | string | Option ID |
| `options[].text` | string | Option text |
| `correct_option_id` | string | Correct option ID |
| `feedback` | object | Feedback content |
| `feedback.correct_title` | string | Title for correct |
| `feedback.correct_body` | string | Body for correct |
| `feedback.incorrect_title` | string | Title for incorrect |
| `feedback.incorrect_body` | string | Body for incorrect |

### Example Response

```json
{
  "analysis_id": "an_8f3b7c2a9d",
  "created_at": "2026-02-14T22:12:31Z",
  "source": {
    "platform": "kijiji",
    "url": "https://www.kijiji.ca/v-ski/calgary/dps-wailer-pagoda-94-x-178/1732998393"
  },
  "risk": {
    "score": 72,
    "level": "medium",
    "summary": "Multiple scam patterns and impulse triggers were detected. Verify before paying or meeting."
  },
  "findings": [
    {
      "id": "price_too_low",
      "type": "red_flag",
      "header": "Price is unusually low",
      "summary": "The price appears below typical market range.",
      "explanation": "Underpricing is commonly used to create urgency and reduce verification behavior.",
      "severity": "high",
      "evidence": ["Listed price far below comparable items"]
    },
    {
      "id": "urgency_bias",
      "type": "cognitive_bias",
      "header": "Urgency pressure detected",
      "summary": "Time pressure can reduce careful evaluation.",
      "explanation": "Urgency bias narrows attention and increases impulsive decisions.",
      "severity": "medium",
      "evidence": ["\"must sell today\"", "\"first come first served\""]
    }
  ],
  "reflection_prompts": [
    { "id": "rp_appeal", "prompt": "What about this deal excites you most?" },
    { "id": "rp_toogood", "prompt": "If this is too good to be true, what detail would explain why?" }
  ],
  "quiz": {
    "questions": [
      {
        "id": "q_deposit",
        "linked_finding_ids": ["urgency_bias"],
        "prompt": "The seller asks for a deposit to hold the item. What is the safest response?",
        "options": [
          { "id": "a", "text": "Send a small deposit to reserve it" },
          { "id": "b", "text": "Decline deposits and propose a public meetup with verification" },
          { "id": "c", "text": "Send the deposit but ask for a receipt" }
        ],
        "correct_option_id": "b",
        "feedback": {
          "correct_title": "Strong critical thinking",
          "correct_body": "Declining deposits reduces exposure to common prepayment scams.",
          "incorrect_title": "Pause and reconsider",
          "incorrect_body": "Deposits are a common scam path. Verify first."
        }
      }
    ]
  }
}
```

---

## Error Responses

All errors return:

```json
{ "error": { "code": "STRING", "message": "STRING", "details": {} } }
```

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Missing/invalid JSON or required fields |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `Content-Type` not `application/json` |
| 422 | `UNSUPPORTED_URL` | Unsupported domain/format or not a listing page |
| 408 | `TIMEOUT` | Fetch/analysis exceeded time limit |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 502 | `UPSTREAM_FETCH_FAILED` | Could not fetch listing content |
| 503 | `SERVICE_UNAVAILABLE` | Service temporarily unavailable |
| 500 | `INTERNAL_ERROR` | Unexpected server error |