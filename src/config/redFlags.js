// Hardcoded red flag pattern definitions.
// Each entry is injected into the AI prompt so the model evaluates
// listings against a consistent baseline.
//
// TODO: Finalize this list after testing what data the scraper reliably extracts.

const RED_FLAGS = [
  { id: "price_too_low", description: "Price significantly below market value for the item category" },
  { id: "urgency_language", description: "Language pressuring quick action ('must sell today', 'first come first served')" },
  { id: "vague_description", description: "Description lacks specific details about the item's condition or history" },
  { id: "contact_off_platform", description: "Requests to communicate outside the platform (email, WhatsApp, text)" },
  { id: "too_good_to_be_true", description: "Offer seems unrealistically favorable" },
  { id: "request_deposit", description: "Seller asks for deposit, e-transfer, or payment before meeting" },
  // TODO: Add more patterns as needed
];

module.exports = RED_FLAGS;
