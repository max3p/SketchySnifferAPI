// Red flag pattern definitions.
// Each flag has an `engine` field:
//   "rule" — evaluated deterministically by the rule engine (instant, no API cost)
//   "ai"   — evaluated by GPT-4o (subjective judgment required)
//
// Rule flags are pre-evaluated and passed to the AI as context.
// AI flags are injected into the prompt so the model evaluates them.

const RED_FLAGS = [
  // ── Rule Engine: Price ──────────────────────────────────────────
  { id: "price_drop_extreme", engine: "rule", severity: "medium",
    label: "Extreme price drop",
    description: "Price drop exceeds 60% of original price" },
  { id: "free_or_near_free", engine: "rule", severity: "high",
    label: "Free or near-free item",
    description: "Item listed for $10 or less" },

  // ── Rule Engine: Description (keyword/regex) ────────────────────
  { id: "urgency_language", engine: "rule", severity: "medium",
    label: "Urgency pressure detected",
    description: "Pressure language detected: 'must sell today', 'first come first served', 'won't last', 'act fast', 'need gone ASAP', 'today only', 'serious buyers only'" },
  { id: "contact_off_platform", engine: "rule", severity: "high",
    label: "Off-platform contact requested",
    description: "Off-platform contact detected: email addresses, phone numbers, WhatsApp, Telegram, Instagram, 'text me', 'call me'" },
  { id: "request_deposit", engine: "rule", severity: "high",
    label: "Deposit or advance payment requested",
    description: "Deposit/advance payment language detected: 'deposit required', 'e-transfer before', 'send payment', 'pay first', 'etransfer to hold'" },
  { id: "unusual_payment_method", engine: "rule", severity: "high",
    label: "Unusual payment method detected",
    description: "Unusual payment method detected: gift card, crypto, bitcoin, wire transfer, Western Union, MoneyGram, Zelle" },

  // ── Rule Engine: Seller ─────────────────────────────────────────
  { id: "seller_unverified", engine: "rule", severity: "low",
    label: "Unverified seller account",
    description: "Seller account is not verified" },
  { id: "seller_no_photo", engine: "rule", severity: "low",
    label: "No seller profile photo",
    description: "Seller has no profile photo" },
  { id: "seller_few_listings", engine: "rule", severity: "medium",
    label: "Seller has few listings",
    description: "Seller has 2 or fewer active listings" },

  // ── Rule Engine: Images ─────────────────────────────────────────
  { id: "no_images", engine: "rule", severity: "high",
    label: "No photos provided",
    description: "Listing has no photos" },
  { id: "single_image", engine: "rule", severity: "low",
    label: "Only one photo provided",
    description: "Only one photo provided" },

  // ── Rule Engine: Payment & Metadata ─────────────────────────────
  { id: "no_cash_accepted", engine: "rule", severity: "medium",
    label: "Cash not accepted",
    description: "Listing rejects cash for an in-person sale" },
  { id: "short_listing_duration", engine: "rule", severity: "low",
    label: "Short listing duration",
    description: "Listing duration is under 7 days" },
  { id: "promoted_cheap_item", engine: "rule", severity: "low",
    label: "Promoted low-value item",
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

module.exports = RED_FLAGS;
