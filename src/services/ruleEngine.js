const RED_FLAGS = require("../config/redFlags");

// Deterministic rule engine for scam detection.
// Evaluates listing data against all "rule" engine flags — no AI needed.
//
// Two kinds of checks:
//   1. Data checks — boolean/numeric conditions on structured fields
//   2. Keyword/regex checks — pattern matching on description text
//
// Input:  listingData (expanded scraper output — see docs/scam-detecting-plan.md §6)
// Output: preFlags[] — array of { id, severity, evidence } for each triggered flag
//
// These preFlags are passed to the AI so it can factor them into its risk score
// without re-evaluating objective facts.

const RULE_FLAGS = RED_FLAGS.filter((f) => f.engine === "rule");

// ── Data checks ───────────────────────────────────────────────────

// TODO: Implement — check price.originalAmount vs price.amount, trigger if drop > 60%
function checkPriceDropExtreme(listingData) {}

// TODO: Implement — check price.amount <= 10
function checkFreeOrNearFree(listingData) {}

// TODO: Implement — check seller.verified === false
function checkSellerUnverified(listingData) {}

// TODO: Implement — check seller.hasProfilePhoto === false
function checkSellerNoPhoto(listingData) {}

// TODO: Implement — check seller.numberOfListings <= 2
function checkSellerFewListings(listingData) {}

// TODO: Implement — check images.count === 0
function checkNoImages(listingData) {}

// TODO: Implement — check images.count === 1
function checkSingleImage(listingData) {}

// TODO: Implement — check payment.cashAccepted === false && payment.cashless === true
function checkNoCashAccepted(listingData) {}

// TODO: Implement — check listing.endDate - listing.activationDate < 7 days
function checkShortListingDuration(listingData) {}

// TODO: Implement — check listing.topAd === true && price.amount < 50
function checkPromotedCheapItem(listingData) {}

// ── Keyword/regex checks ──────────────────────────────────────────

// TODO: Implement — scan description for urgency phrases
// Keywords: "must sell today", "first come first served", "won't last",
//           "act fast", "moving sale", "need gone ASAP", "today only",
//           "serious buyers only"
function checkUrgencyLanguage(listingData) {}

// TODO: Implement — scan description for off-platform contact patterns
// Patterns: email addresses (regex), phone numbers (regex),
//           "text me", "WhatsApp", "call me", "email me",
//           "DM on Instagram", "Telegram"
function checkContactOffPlatform(listingData) {}

// TODO: Implement — scan description for deposit/advance payment language
// Keywords: "deposit required", "e-transfer before", "send payment",
//           "pay first", "etransfer to hold"
function checkRequestDeposit(listingData) {}

// TODO: Implement — scan description for unusual payment methods
// Keywords: "gift card", "crypto", "bitcoin", "wire transfer",
//           "Western Union", "MoneyGram", "Zelle"
function checkUnusualPaymentMethod(listingData) {}

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

// TODO: Implement — run all rule checks against listingData.
// For each RULE_FLAGS entry, call the corresponding check function.
// Each check function should return either:
//   - null (flag not triggered)
//   - { id, severity, evidence } (flag triggered, with supporting evidence string)
//
// Returns: preFlags[] — array of triggered flags (nulls filtered out)
function evaluateRules(listingData) {}

module.exports = { evaluateRules };
