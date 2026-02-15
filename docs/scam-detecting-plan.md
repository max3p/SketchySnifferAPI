# Scam Detection Plan

Research-backed plan for identifying scam patterns in Kijiji marketplace listings.
Informs the implementation of `src/config/redFlags.js` and the AI prompt in `src/services/analysisService.js`.

---

## 1. Relevant Listing Data to Capture

Every field the scraper can extract, mapped to its scam-detection value.

### Core Listing Fields

| Field | Source | Scam-Detection Use |
|---|---|---|
| `title` | JSON-LD `name`, Apollo `title` | Vagueness detection, keyword analysis, mismatch with description |
| `description` | JSON-LD `description`, Apollo `description` | Urgency language, off-platform contact requests, vagueness, length analysis |
| `price.amount` | Apollo `price.amount` (cents), JSON-LD `offers.price` | Price anomaly detection vs category norms |
| `price.originalAmount` | Apollo `price.originalAmount` | Anchoring bias detection, suspicious price drop magnitude |
| `price.type` | Apollo `price.type` (FIXED/NEGOTIABLE) | Context for price analysis |
| `priceDrop` | Apollo `flags.priceDrop` | Anchoring/urgency manipulation signal |
| `category` | Apollo `categoryId` + category hierarchy | Market price context, category-specific scam patterns |
| `imageUrls[]` | Apollo `imageUrls` | Image count, stock photo risk |
| `imageCount` | Derived from `imageUrls.length` | Low image count = higher risk |

### Location Fields

| Field | Source | Scam-Detection Use |
|---|---|---|
| `location.name` | Apollo `location.name` | Geographic context |
| `location.address` | Apollo `location.address` | Specificity check (vague vs exact) |
| `location.coordinates` | Apollo `location.coordinates` | Cross-reference with address, detect geographic inconsistencies |

### Seller Profile Fields

| Field | Source | Scam-Detection Use |
|---|---|---|
| `posterInfo.posterId` | Apollo `posterInfo.posterId` | Seller identification |
| `posterInfo.sellerType` | Apollo `posterInfo.sellerType` (FSBO/DEALER) | Context for expectations |
| `posterInfo.verified` | Apollo `posterInfo.verified` | **Key trust signal** — unverified = higher risk |
| `profile.name` | Apollo `StandardProfileV2.name` | Generic/suspicious name detection |
| `profile.numberOfListings` | Apollo `StandardProfileV2.numberOfListings` | **Key trust signal** — very few listings = higher risk |
| `profile.imageUrl` | Apollo `StandardProfileV2.imageUrl` | No profile photo = higher risk |
| `profile.userType` | Apollo `StandardProfileV2.userType` | FSBO vs dealer context |

### Listing Metadata

| Field | Source | Scam-Detection Use |
|---|---|---|
| `activationDate` | Apollo `activationDate` | Listing age, freshness |
| `sortingDate` | Apollo `sortingDate` | Detect re-listing / bump behaviour |
| `endDate` | Apollo `endDate` | Listing duration (short = urgency tactic) |
| `adSource` | Apollo `adSource` (ORGANIC/PROMOTED) | Context for boosted listings |
| `topAd` | Apollo `flags.topAd` | Paid promotion on suspiciously cheap items is a red flag |
| `views` | Apollo `metrics.views` | Engagement context |
| `status` | Apollo `status` | Active/inactive verification |

### Listing Attributes

| Field | Source | Scam-Detection Use |
|---|---|---|
| `condition` | Apollo attribute `condition` | Claimed condition vs price mismatch |
| `payment` | Apollo attribute `payment` | Payment method demands (red flag if unusual) |
| `cashless` | Apollo attribute `cashless` | Off-platform payment pressure |
| `shipping` | Apollo attribute `shipping` | Shipping-only = can't inspect in person |
| `fulfillment` | Apollo attribute `fulfillment` | Delivery-only context |
| `forsaleby` | Apollo attribute `forsaleby` | Owner vs dealer distinction |

---

## 2. Scam Patterns & Red Flags

### Category A: Price Anomalies

| ID | Engine | Red Flag | Detection Strategy | Severity |
|---|---|---|---|---|
| `price_too_low` | AI | Price significantly below market value for the item category | AI compares price against category norms and item description. Items priced 50%+ below expected value are suspicious. | high |
| `price_drop_extreme` | Rule | Unrealistically large price drop (e.g. $850 → $400) | Calculate `(originalAmount - amount) / originalAmount`. Drops > 60% are suspicious. | medium |
| `free_or_near_free` | Rule | High-value item listed for free or near-free | `price.amount <= 10`. Items listed at $0-$10 are almost always scams. | high |

**Note:** `price_anchoring` (original price shown to create false sense of savings) is handled as a cognitive bias rather than a red flag — see section 3.

### Category B: Description Red Flags

| ID | Engine | Red Flag | Detection Strategy | Severity |
|---|---|---|---|---|
| `urgency_language` | Rule | Pressure language pushing quick action | Keyword/phrase matching: "must sell today", "first come first served", "won't last", "act fast", "moving sale", "need gone ASAP", "today only", "serious buyers only". | medium |
| `contact_off_platform` | Rule | Requests to communicate outside the platform | Regex matching: email addresses, phone numbers, "text me at", "WhatsApp", "call me", "email me", "DM on Instagram", "Telegram". | high |
| `request_deposit` | Rule | Seller asks for deposit or payment before meeting | Keyword matching: "deposit required", "e-transfer before", "send payment", "pay first", "etransfer to hold". | high |
| `unusual_payment_method` | Rule | Requests for gift cards, crypto, wire transfer | Keyword matching: "gift card", "crypto", "bitcoin", "wire transfer", "Western Union", "MoneyGram", "Zelle". Gift card requests are the #1 scam signal (92% recognition rate). | high |
| `vague_description` | AI | Description lacks specific details about condition, history, or features | AI evaluates description depth and informativeness. Descriptions that simply repeat the title or lack substance. | medium |
| `description_mismatch` | AI | Title and description don't align | AI semantic comparison between title, description, and category. A listing titled "iPhone 15" with a description about shipping procedures is suspicious. | high |
| `excessive_shipping_language` | AI | Over-emphasis on shipping/delivery instead of item details | AI detects when shipping/delivery language dominates over product details. Research shows scammers disproportionately discuss shipping logistics. | medium |

### Category C: Seller Profile Red Flags

| ID | Engine | Red Flag | Detection Strategy | Severity |
|---|---|---|---|---|
| `seller_unverified` | Rule | Seller account is not verified | `posterInfo.verified === false`. | low |
| `seller_no_photo` | Rule | Seller has no profile photo | `profile.imageUrl === null`. | low |
| `seller_few_listings` | Rule | Seller has very few active listings (1-2) | `profile.numberOfListings <= 2`. Low listing count combined with a high-value item is suspicious. New accounts created to post a single scam listing are common. | medium |

### Category D: Image Red Flags

| ID | Engine | Red Flag | Detection Strategy | Severity |
|---|---|---|---|---|
| `no_images` | Rule | Listing has no photos | `imageUrls.length === 0`. Legitimate sellers almost always include photos. | high |
| `single_image` | Rule | Only one photo provided | `imageUrls.length === 1`. Multiple angles increase trust; a single image (especially for expensive items) is suspicious. | low |
| `stock_photos_suspected` | AI | Images appear to be manufacturer/stock photos rather than originals | AI analysis of image URLs and context. Stock photos lack the casual, real-world background of genuine listings. | medium |

### Category E: Payment & Metadata Red Flags

| ID | Engine | Red Flag | Detection Strategy | Severity |
|---|---|---|---|---|
| `no_cash_accepted` | Rule | Listing explicitly rejects cash | `cashless === true && cashAccepted === false`. Refusing cash for an in-person sale is unusual. | medium |
| `short_listing_duration` | Rule | Listing set to expire very quickly | `endDate - activationDate < 7 days`. May be creating artificial urgency. | low |
| `promoted_cheap_item` | Rule | Paid promotion (topAd) on a low-value item | `flags.topAd === true && price < 50`. Paying to promote a cheap item is unusual. | low |
| `too_good_to_be_true` | AI | Overall combination makes deal seem unrealistically favorable | AI composite judgment: low price + high-demand category + vague description + unverified seller. The "gut check" flag. | high |

---

## 3. Cognitive Biases to Flag

These aren't scam indicators per se, but psychological triggers that scammers exploit. The AI should flag these to help users think critically.

| Bias | Trigger in Listing | Reflection Prompt |
|---|---|---|
| **Scarcity Bias** | "Only one left", "won't last", "rare find" | "Is this item truly rare, or is the seller creating artificial scarcity?" |
| **Urgency Bias** | "Must sell today", "moving tomorrow", "act fast" | "Why does this need to happen so quickly? Would a legitimate seller pressure you this way?" |
| **Anchoring Bias** | Price drop from $850 → $400 shown prominently | "Are you evaluating this price on its own merits, or does it just look good compared to the 'original' price? Is $400 actually a fair price for this item?" |
| **Authority Bias** | Overly professional language, brand name dropping | "Does professional-sounding language make you trust this seller more than you should?" |
| **Social Proof Absence** | No reviews, no profile history | "Would you trust a stranger on the street with this deal? What makes this different?" |
| **Loss Aversion** | "Someone else is interested", "don't miss out" | "What would you actually lose by waiting and verifying? Compare that to what you'd lose if this is a scam." |

---

## 4. Hybrid Detection Architecture

Not every red flag needs AI. Many checks are objective — a listing either has images or it doesn't. Running these deterministically is faster, cheaper, and more reliable than asking the AI to evaluate them.

### Pipeline: Rule Engine → AI Analysis

```
Scraped Listing Data
    │
    ▼
┌─────────────────────────────────────────────────┐
│  STEP 1: Rule Engine  (src/services/ruleEngine.js)  │
│  Deterministic checks — instant, no API cost        │
│                                                     │
│  Data checks:                                       │
│    imageUrls.length === 0        → no_images        │
│    imageUrls.length === 1        → single_image     │
│    verified === false            → seller_unverified │
│    imageUrl === null             → seller_no_photo   │
│    numberOfListings <= 2         → seller_few_listings│
│    (orig - curr) / orig > 0.6   → price_drop_extreme│
│    price <= 10                   → free_or_near_free │
│    endDate - activation < 7d     → short_listing_duration│
│    topAd && price < 50           → promoted_cheap_item│
│    cashless && !cashAccepted     → no_cash_accepted  │
│                                                     │
│  Keyword/regex checks:                              │
│    urgency phrases               → urgency_language  │
│    email/phone/WhatsApp/Telegram → contact_off_platform│
│    "deposit"/"pay first"/etc.    → request_deposit   │
│    "gift card"/"crypto"/etc.     → unusual_payment_method│
│                                                     │
│  Output: preFlags[] — { id, severity, evidence }    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  STEP 2: AI Analysis  (src/services/analysisService.js) │
│  Receives listing data + preFlags from Step 1       │
│  Focuses on subjective judgment only                │
│                                                     │
│  Subjective checks:                                 │
│    price vs category norms       → price_too_low    │
│    description quality/depth     → vague_description │
│    title ↔ description coherence → description_mismatch│
│    shipping language dominance   → excessive_shipping_language│
│    image context analysis        → stock_photos_suspected│
│    composite risk judgment       → too_good_to_be_true│
│                                                     │
│  Cognitive bias detection:                          │
│    anchoring, scarcity, urgency, authority, etc.    │
│                                                     │
│  Outputs:                                           │
│    - Additional AI-detected findings                │
│    - Overall risk score (0-100) factoring in preFlags│
│    - Risk narrative summary                         │
│    - Reflection prompts                             │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  STEP 3: Merge  (src/controllers/analysisController.js) │
│  Combine rule engine preFlags + AI findings         │
│  into a single response                             │
└─────────────────────────────────────────────────────┘
```

### Why This Split?

| | Rule Engine | AI Analysis |
|---|---|---|
| **Speed** | Instant (<1ms) | 2-5 seconds (API call) |
| **Cost** | Free | ~$0.01-0.03 per call |
| **Consistency** | Same input = same output, always | May vary slightly between calls |
| **Good at** | Binary facts, pattern matching | Subjective judgment, context, nuance |
| **Bad at** | "Is this price fair for skis?" | Wasting tokens on `imageUrls.length === 0` |

---

## 5. Updated Red Flags for `redFlags.js`

Each flag now has an `engine` field: `"rule"` (deterministic, handled by rule engine) or `"ai"` (subjective, handled by AI). Only `"ai"` flags are injected into the AI prompt — rule flags are pre-evaluated and passed as findings.

```js
const RED_FLAGS = [
  // ── Rule Engine: Price ──────────────────────────────────────────
  { id: "price_drop_extreme", engine: "rule", severity: "medium",
    description: "Price drop exceeds 60% of original price" },
  { id: "free_or_near_free", engine: "rule", severity: "high",
    description: "Item listed for $10 or less" },

  // ── Rule Engine: Description (keyword/regex) ────────────────────
  { id: "urgency_language", engine: "rule", severity: "medium",
    description: "Pressure language detected: 'must sell today', 'first come first served', 'won't last', 'act fast', 'need gone ASAP', 'today only', 'serious buyers only'" },
  { id: "contact_off_platform", engine: "rule", severity: "high",
    description: "Off-platform contact detected: email addresses, phone numbers, WhatsApp, Telegram, Instagram, 'text me', 'call me'" },
  { id: "request_deposit", engine: "rule", severity: "high",
    description: "Deposit/advance payment language detected: 'deposit required', 'e-transfer before', 'send payment', 'pay first', 'etransfer to hold'" },
  { id: "unusual_payment_method", engine: "rule", severity: "high",
    description: "Unusual payment method detected: gift card, crypto, bitcoin, wire transfer, Western Union, MoneyGram, Zelle" },

  // ── Rule Engine: Seller ─────────────────────────────────────────
  { id: "seller_unverified", engine: "rule", severity: "low",
    description: "Seller account is not verified" },
  { id: "seller_no_photo", engine: "rule", severity: "low",
    description: "Seller has no profile photo" },
  { id: "seller_few_listings", engine: "rule", severity: "medium",
    description: "Seller has 2 or fewer active listings" },

  // ── Rule Engine: Images ─────────────────────────────────────────
  { id: "no_images", engine: "rule", severity: "high",
    description: "Listing has no photos" },
  { id: "single_image", engine: "rule", severity: "low",
    description: "Only one photo provided" },

  // ── Rule Engine: Payment & Metadata ─────────────────────────────
  { id: "no_cash_accepted", engine: "rule", severity: "medium",
    description: "Listing rejects cash for an in-person sale" },
  { id: "short_listing_duration", engine: "rule", severity: "low",
    description: "Listing duration is under 7 days" },
  { id: "promoted_cheap_item", engine: "rule", severity: "low",
    description: "Paid promotion (Top Ad) on an item under $50" },

  // ── AI Analysis: Subjective ─────────────────────────────────────
  { id: "price_too_low", engine: "ai", severity: "high",
    description: "Price significantly below market value for the item category" },
  { id: "vague_description", engine: "ai", severity: "medium",
    description: "Description lacks specific details about condition, history, or features" },
  { id: "description_mismatch", engine: "ai", severity: "high",
    description: "Title and description don't align, or description appears to be for a different item" },
  { id: "excessive_shipping_language", engine: "ai", severity: "medium",
    description: "Description focuses on shipping/delivery logistics rather than item details" },
  { id: "stock_photos_suspected", engine: "ai", severity: "medium",
    description: "Images appear to be manufacturer or stock photos rather than original photos" },
  { id: "too_good_to_be_true", engine: "ai", severity: "high",
    description: "Overall combination of signals makes the deal seem unrealistically favorable" },
];
```

### Summary

| Engine | Count | Examples |
|---|---|---|
| `rule` (deterministic) | 14 flags | `no_images`, `seller_unverified`, `urgency_language`, `contact_off_platform` |
| `ai` (subjective) | 6 flags | `price_too_low`, `vague_description`, `description_mismatch`, `too_good_to_be_true` |

---

## 6. Scraper Enhancement Recommendations

The scraper currently extracts `{ title, description, price, location }` but the Apollo state contains much more. To enable the detection strategies above, the scraper output should be expanded:

### Must-Have Additions

| Field | Apollo Path | Why |
|---|---|---|
| `imageUrls` | `StandardListing.imageUrls` | Image count is a high-value signal |
| `imageCount` | Derived from above | Quick check without passing full URLs |
| `seller.verified` | `posterInfo.verified` | Key trust signal |
| `seller.numberOfListings` | `StandardProfileV2.numberOfListings` | Key trust signal |
| `seller.name` | `StandardProfileV2.name` | Profile completeness check |
| `seller.imageUrl` | `StandardProfileV2.imageUrl` | Profile completeness check |
| `category` | `Category` refs (name chain) | Price context (e.g. "Ski" vs "Electronics") |
| `price.originalAmount` | `StandardAmountPrice.originalAmount` | Price drop analysis |
| `priceDrop` | `StandardListingFlags.priceDrop` | Anchoring bias detection |
| `condition` | Attribute `condition` | Price vs condition mismatch |

### Nice-to-Have Additions

| Field | Apollo Path | Why |
|---|---|---|
| `activationDate` | `StandardListing.activationDate` | Listing age |
| `endDate` | `StandardListing.endDate` | Listing duration / urgency |
| `views` | `ListingMetrics.views` | Engagement context |
| `topAd` | `StandardListingFlags.topAd` | Promoted cheap item check |
| `payment` | Attribute `payment` | Payment method context |
| `shipping` | Attribute `shipping` | Shipping-only flag |
| `adSource` | `StandardListing.adSource` | Organic vs promoted |

### Proposed Scraper Output Shape

```js
{
  title: "DPS Wailer Pagoda 94 x 178",
  description: "DPS Wailer Pagoda 94 x 178",
  price: {
    amount: 400,           // dollars (converted from cents)
    currency: "CAD",
    originalAmount: 850,   // if price drop exists
    priceDrop: true
  },
  location: {
    name: "Calgary",
    address: "Calgary, AB T2T 5R6",
    coordinates: { latitude: 51.04, longitude: -114.08 }
  },
  category: ["Buy & Sell", "Sporting Goods & Exercise", "Ski"],
  condition: "Used - Good",
  images: {
    urls: ["https://media.kijiji.ca/..."],
    count: 1
  },
  seller: {
    id: "1018566818",
    name: "keith hanna",
    verified: false,
    numberOfListings: 3,
    hasProfilePhoto: false,
    type: "FSBO"
  },
  listing: {
    id: "1732998393",
    activationDate: "2026-02-11T00:01:54.000Z",
    endDate: "2026-04-12T00:01:54.000Z",
    views: 210,
    topAd: true,
    adSource: "ORGANIC"
  },
  payment: {
    cashAccepted: true,
    cashless: false,
    shipping: false
  }
}
```

---

## 7. Common Kijiji/Marketplace Scam Types (Reference)

For the AI prompt's system context, these are the most common scam types the model should know about:

1. **Phantom Listings** — Item doesn't exist. Scammer collects payment/deposit then disappears. Signals: no original photos, vague description, request for payment before meeting.

2. **Overpayment Scam** — Buyer "accidentally" overpays, asks seller to refund difference. Original payment is fraudulent. (Buyer-side scam, less relevant for our tool.)

3. **Bait and Switch** — Listing advertises one item but seller delivers a different (inferior) item. Signals: stock photos, description mismatch, too-good price.

4. **Phishing / Data Harvesting** — Listing exists to collect personal information. Signals: requests for SSN, email, phone number in description; links to external sites.

5. **Fake Payment Proof** — Seller claims payment was sent (fake Zelle/e-transfer screenshot). Signals: pressure to release item before payment clears.

6. **Rental Scam** — Fake rental/property listing to collect deposits. Signals: below-market rent, request deposit before viewing, copied listing photos.

7. **Counterfeit Goods** — Brand-name items at suspiciously low prices. Signals: price too low for the brand, stock photos, vague condition details.

8. **Advance Fee Scam** — Seller asks for a deposit, shipping fee, or insurance payment upfront. Signals: any request for money before the buyer sees the item.

---

## 8. Risk Scoring Strategy

The AI should produce a risk score (0-100) based on weighted flag contributions:

| Severity | Weight | Example Contribution |
|---|---|---|
| High | 20-30 points each | `contact_off_platform`, `request_deposit`, `no_images` |
| Medium | 10-15 points each | `urgency_language`, `vague_description`, `seller_few_listings` |
| Low | 3-7 points each | `seller_unverified`, `single_image`, `seller_no_photo` |

**Risk Levels:**
- **0-33: Low** — No major red flags. Proceed with normal caution.
- **34-66: Medium** — Some concerning signals. Verify before committing.
- **67-100: High** — Multiple red flags. Strong recommendation to walk away or get further verification.

The score should cap at 100. Multiple high-severity flags compound quickly — which is correct, because a listing with no images + off-platform contact + deposit request is almost certainly a scam.
