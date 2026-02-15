const RED_FLAGS = require("../config/redFlags");

// Deterministic rule engine for scam detection.
// Evaluates listing data against all "rule" engine flags. No AI needed.
//
// Two kinds of checks:
//   1. Data checks: boolean/numeric conditions on structured fields
//   2. Keyword/regex checks: pattern matching on description text
//
// Input:  listingData (expanded scraper output, see docs/scam-detecting-plan.md §6)
// Output: preFlags[], an array of { id, severity, evidence } for each triggered flag
//
// These preFlags are passed to the AI so it can factor them into its risk score
// without re-evaluating objective facts.

const RULE_FLAGS = RED_FLAGS.filter((f) => f.engine === "rule");

function getFlag(id) {
  return RULE_FLAGS.find((f) => f.id === id);
}

function buildSearchText(listingData) {
  const parts = [];
  if (listingData.title) parts.push(listingData.title);
  if (listingData.description) parts.push(listingData.description);
  if (parts.length === 0) return null;
  return parts.join(" ").replace(/[\u2018\u2019\u2032]/g, "'");
}

// ── Data checks ───────────────────────────────────────────────────

function checkPriceDropExtreme(listingData) {
  const price = listingData.price;
  if (!price || typeof price === "string") return null;
  if (price.originalAmount == null || price.amount == null) return null;
  if (price.originalAmount <= 0) return null;

  const dropPercent = (price.originalAmount - price.amount) / price.originalAmount;
  if (dropPercent <= 0.6) return null;

  const flag = getFlag("price_drop_extreme");
  const pct = Math.round(dropPercent * 100);
  return {
    id: flag.id,
    severity: flag.severity,
    evidence: `Price dropped ${pct}% ($${price.originalAmount} \u2192 $${price.amount})`,
  };
}

function checkFreeOrNearFree(listingData) {
  const price = listingData.price;
  if (!price || typeof price === "string") return null;
  if (price.amount == null) return null;
  if (price.amount > 10) return null;

  const flag = getFlag("free_or_near_free");
  return {
    id: flag.id,
    severity: flag.severity,
    evidence: `Listed at $${price.amount}`,
  };
}

function checkSellerUnverified(listingData) {
  if (!listingData.seller) return null;
  if (listingData.seller.verified !== false) return null;

  const flag = getFlag("seller_unverified");
  return {
    id: flag.id,
    severity: flag.severity,
    evidence: "Seller account is not verified",
  };
}

function checkSellerNoPhoto(listingData) {
  if (!listingData.seller) return null;
  if (listingData.seller.hasProfilePhoto !== false) return null;

  const flag = getFlag("seller_no_photo");
  return {
    id: flag.id,
    severity: flag.severity,
    evidence: "Seller has no profile photo",
  };
}

function checkSellerFewListings(listingData) {
  if (!listingData.seller) return null;
  if (listingData.seller.numberOfListings == null) return null;
  if (listingData.seller.numberOfListings > 2) return null;

  const flag = getFlag("seller_few_listings");
  return {
    id: flag.id,
    severity: flag.severity,
    evidence: `Seller has only ${listingData.seller.numberOfListings} active listing(s)`,
  };
}

function checkNoImages(listingData) {
  if (!listingData.images || listingData.images.count === 0) {
    const flag = getFlag("no_images");
    return {
      id: flag.id,
      severity: flag.severity,
      evidence: "No photos provided",
    };
  }
  return null;
}

function checkSingleImage(listingData) {
  if (!listingData.images) return null;
  if (listingData.images.count !== 1) return null;

  const flag = getFlag("single_image");
  return {
    id: flag.id,
    severity: flag.severity,
    evidence: "Only 1 photo provided",
  };
}

function checkNoCashAccepted(listingData) {
  if (!listingData.payment) return null;
  if (listingData.payment.cashless !== true || listingData.payment.cashAccepted !== false) return null;

  const flag = getFlag("no_cash_accepted");
  return {
    id: flag.id,
    severity: flag.severity,
    evidence: "Cash not accepted",
  };
}

function checkShortListingDuration(listingData) {
  if (!listingData.listing) return null;
  if (!listingData.listing.activationDate || !listingData.listing.endDate) return null;

  const start = new Date(listingData.listing.activationDate);
  const end = new Date(listingData.listing.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  const diffMs = end - start;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0 || diffDays >= 7) return null;

  const flag = getFlag("short_listing_duration");
  return {
    id: flag.id,
    severity: flag.severity,
    evidence: `Listing expires in ${Math.round(diffDays)} days`,
  };
}

function checkPromotedCheapItem(listingData) {
  if (!listingData.listing) return null;
  if (listingData.listing.topAd !== true) return null;

  const price = listingData.price;
  if (!price || typeof price === "string") return null;
  if (price.amount == null || price.amount >= 50) return null;

  const flag = getFlag("promoted_cheap_item");
  return {
    id: flag.id,
    severity: flag.severity,
    evidence: `Top Ad on a $${price.amount} item`,
  };
}

// ── Keyword/regex checks ──────────────────────────────────────────

function checkUrgencyLanguage(listingData) {
  const text = buildSearchText(listingData);
  if (!text) return null;

  const phrases = [
    "must sell today",
    "first come first served",
    "won't last",
    "act fast",
    "moving sale",
    "need gone",
    "today only",
    "serious buyers only",
    "don't miss out",
    "selling fast",
  ];

  const lower = text.toLowerCase();
  const matched = phrases.filter((p) => lower.includes(p));
  if (matched.length === 0) return null;

  const flag = getFlag("urgency_language");
  return {
    id: flag.id,
    severity: flag.severity,
    evidence: `Urgency language detected: "${matched.join('", "')}"`,
  };
}

function checkContactOffPlatform(listingData) {
  const text = buildSearchText(listingData);
  if (!text) return null;

  const lower = text.toLowerCase();
  const found = [];

  const emailRegex = /\S+@\S+\.\S+/;
  if (emailRegex.test(text)) found.push("email address");

  const phoneRegex = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/;
  if (phoneRegex.test(text)) found.push("phone number");

  const keywords = [
    "whatsapp", "telegram", "text me", "call me",
    "email me", "dm me", "instagram", "signal",
  ];
  for (const kw of keywords) {
    if (lower.includes(kw)) found.push(kw);
  }

  if (found.length === 0) return null;

  const flag = getFlag("contact_off_platform");
  return {
    id: flag.id,
    severity: flag.severity,
    evidence: `Off-platform contact detected: ${found.join(", ")}`,
  };
}

function checkRequestDeposit(listingData) {
  const text = buildSearchText(listingData);
  if (!text) return null;

  const lower = text.toLowerCase();
  const keywords = [
    "deposit",
    "e-transfer before",
    "etransfer to hold",
    "send payment",
    "pay first",
    "payment before",
    "hold the item",
  ];

  const matched = keywords.filter((kw) => lower.includes(kw));
  if (matched.length === 0) return null;

  const flag = getFlag("request_deposit");
  return {
    id: flag.id,
    severity: flag.severity,
    evidence: `Deposit/advance payment language detected: "${matched.join('", "')}"`,
  };
}

function checkUnusualPaymentMethod(listingData) {
  const text = buildSearchText(listingData);
  if (!text) return null;

  const lower = text.toLowerCase();
  const keywords = [
    "gift card", "giftcard", "crypto", "bitcoin", "btc",
    "wire transfer", "western union", "moneygram",
    "zelle", "venmo", "cashapp",
  ];

  const matched = keywords.filter((kw) => lower.includes(kw));
  if (matched.length === 0) return null;

  const flag = getFlag("unusual_payment_method");
  return {
    id: flag.id,
    severity: flag.severity,
    evidence: `Unusual payment method detected: "${matched.join('", "')}"`,
  };
}

// ── Orchestrator ──────────────────────────────────────────────────

// Maps flag IDs to their check functions.
const CHECK_MAP = {
  price_drop_extreme: checkPriceDropExtreme,
  free_or_near_free: checkFreeOrNearFree,
  seller_unverified: checkSellerUnverified,
  seller_no_photo: checkSellerNoPhoto,
  seller_few_listings: checkSellerFewListings,
  no_images: checkNoImages,
  single_image: checkSingleImage,
  no_cash_accepted: checkNoCashAccepted,
  short_listing_duration: checkShortListingDuration,
  promoted_cheap_item: checkPromotedCheapItem,
  urgency_language: checkUrgencyLanguage,
  contact_off_platform: checkContactOffPlatform,
  request_deposit: checkRequestDeposit,
  unusual_payment_method: checkUnusualPaymentMethod,
};

function evaluateRules(listingData) {
  const results = [];

  for (const flag of RULE_FLAGS) {
    const checkFn = CHECK_MAP[flag.id];
    if (!checkFn) continue;

    const result = checkFn(listingData);
    if (result) results.push(result);
  }

  return results;
}

module.exports = { evaluateRules };
