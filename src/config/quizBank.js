// Quiz question bank.
// Each entry maps one or more finding IDs (red flags or cognitive biases) to a
// multiple-choice question. When a finding is detected, the matching question is
// included in the response (up to 3 questions per analysis).

const QUIZ_BANK = [
  {
    triggerIds: ["request_deposit", "unusual_payment_method"],
    question: {
      id: "q_deposit",
      prompt: "A seller asks you to send a deposit via e-transfer before meeting. What is the safest response?",
      options: [
        { id: "a", text: "Send a small deposit to reserve it" },
        { id: "b", text: "Decline and propose meeting in a public place to pay in person" },
        { id: "c", text: "Send the deposit but ask for a receipt" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Strong critical thinking",
        correct_body: "Declining deposits and meeting in person reduces exposure to common prepayment scams.",
        incorrect_title: "Pause and reconsider",
        incorrect_body: "Sending money before seeing the item is one of the most common scam tactics. A receipt from a scammer is worthless.",
      },
    },
  },
  {
    triggerIds: ["seller_unverified", "seller_no_photo", "seller_few_listings", "social_proof_absence"],
    question: {
      id: "q_seller",
      prompt: "You find a great deal from a seller with no profile photo and no verification. What should you do?",
      options: [
        { id: "a", text: "It's probably fine, lots of people don't bother with profiles" },
        { id: "b", text: "Check their other listings and ask questions before committing" },
        { id: "c", text: "Ignore the profile and focus only on the item" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Good instinct",
        correct_body: "Verifying the seller's history and asking questions helps distinguish legitimate sellers from throwaway scam accounts.",
        incorrect_title: "Think again",
        incorrect_body: "Unverified accounts with no photo and few listings are a common pattern for disposable scam profiles.",
      },
    },
  },
  {
    triggerIds: ["urgency_language", "urgency_bias", "scarcity_bias", "loss_aversion"],
    question: {
      id: "q_urgency",
      prompt: "A listing says \"Must sell today, first come first served!\" How should this affect your decision?",
      options: [
        { id: "a", text: "Act quickly before someone else gets it" },
        { id: "b", text: "Recognize this as a pressure tactic and take extra time to verify" },
        { id: "c", text: "It means the seller is motivated, so offer a lower price" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Well spotted",
        correct_body: "Urgency language is designed to short-circuit careful thinking. Legitimate deals don't usually vanish in minutes.",
        incorrect_title: "Be careful",
        incorrect_body: "Scammers use urgency to pressure you into acting before you can verify the deal. A real seller will wait for a serious buyer.",
      },
    },
  },
  {
    triggerIds: ["contact_off_platform"],
    question: {
      id: "q_offplatform",
      prompt: "A seller asks you to continue the conversation on WhatsApp instead of the platform. Why might this be risky?",
      options: [
        { id: "a", text: "It's not risky, WhatsApp is just easier to use" },
        { id: "b", text: "Moving off-platform removes the safety net of the marketplace's records and protections" },
        { id: "c", text: "It only matters if they also ask for payment" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Correct",
        correct_body: "Marketplaces log conversations for dispute resolution. Scammers move off-platform to eliminate that evidence trail.",
        incorrect_title: "Think about it",
        incorrect_body: "Off-platform communication removes your ability to report the conversation and makes disputes much harder to resolve.",
      },
    },
  },
  {
    triggerIds: ["price_drop_extreme", "free_or_near_free", "price_too_low", "anchoring_bias"],
    question: {
      id: "q_price",
      prompt: "An item normally worth $800 is listed for $200. What is the most important thing to consider?",
      options: [
        { id: "a", text: "Jump on it, this is a rare bargain" },
        { id: "b", text: "Ask why the price is so low and verify the item exists before paying" },
        { id: "c", text: "It's probably just someone who needs quick cash" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Smart approach",
        correct_body: "Extreme discounts are the #1 lure in marketplace scams. Always verify before committing money.",
        incorrect_title: "Slow down",
        incorrect_body: "Prices far below market value are the most common bait in online scams. If it seems too good to be true, it usually is.",
      },
    },
  },
  {
    triggerIds: ["no_images", "single_image", "stock_photos_suspected"],
    question: {
      id: "q_images",
      prompt: "A high-value listing has only one photo (or none). What does this suggest?",
      options: [
        { id: "a", text: "The seller is just lazy about photos" },
        { id: "b", text: "Ask the seller for additional photos from different angles before proceeding" },
        { id: "c", text: "One photo is enough if the description is detailed" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Good thinking",
        correct_body: "Legitimate sellers of valuable items almost always provide multiple photos. Requesting more is a simple way to test authenticity.",
        incorrect_title: "Consider this",
        incorrect_body: "Scam listings often use a single stock photo or no images at all. Multiple original photos are a basic trust signal.",
      },
    },
  },
  {
    triggerIds: ["no_cash_accepted"],
    question: {
      id: "q_cashless",
      prompt: "A seller insists on cashless payment only for an in-person item. What should you consider?",
      options: [
        { id: "a", text: "Cashless is more convenient, just go ahead" },
        { id: "b", text: "Ask why cash isn't accepted and consider meeting at a safe location with a traceable payment method" },
        { id: "c", text: "It doesn't matter how you pay as long as you get the item" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Good awareness",
        correct_body: "Refusing cash for in-person sales can be a tactic to avoid traceable transactions or to use reversible payment methods.",
        incorrect_title: "Think twice",
        incorrect_body: "Sellers who refuse cash may be setting up payment fraud. Cash at a public meetup is often the safest option.",
      },
    },
  },
  {
    triggerIds: ["vague_description", "description_mismatch", "excessive_shipping_language"],
    question: {
      id: "q_description",
      prompt: "A listing has a vague description that doesn't mention the item's condition or history. How should you proceed?",
      options: [
        { id: "a", text: "The photos tell you everything you need to know" },
        { id: "b", text: "Ask the seller specific questions about condition, age, and reason for selling" },
        { id: "c", text: "A short description just means the seller is busy" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Smart move",
        correct_body: "Detailed questions help verify the seller actually has the item and knows its history. Scam listings often can't answer specifics.",
        incorrect_title: "Be cautious",
        incorrect_body: "Vague descriptions are a common tactic in scam listings. Legitimate sellers are usually happy to provide details.",
      },
    },
  },
  {
    triggerIds: ["too_good_to_be_true"],
    question: {
      id: "q_toogood",
      prompt: "A deal seems almost too good to be true, with a great price, popular item, and motivated seller. What's the smartest move?",
      options: [
        { id: "a", text: "Act fast before someone else grabs it" },
        { id: "b", text: "Slow down, verify the seller and item independently before committing" },
        { id: "c", text: "Trust your gut, if it feels like a deal it probably is" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Exactly right",
        correct_body: "Scammers engineer listings to feel irresistible. Pausing to verify is your strongest defense.",
        incorrect_title: "Hold on",
        incorrect_body: "When everything looks perfect, that's exactly when you should be most careful. Scams are designed to feel like great deals.",
      },
    },
  },
  {
    triggerIds: ["short_listing_duration", "promoted_cheap_item"],
    question: {
      id: "q_listing",
      prompt: "A listing was posted recently and expires in just a few days, with a paid promotion on a cheap item. What might this suggest?",
      options: [
        { id: "a", text: "The seller is just eager to sell quickly" },
        { id: "b", text: "Short durations and promotions on cheap items can be signs of a throwaway scam listing" },
        { id: "c", text: "Promoted listings are always more trustworthy" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Sharp observation",
        correct_body: "Scammers often create short-lived, promoted listings to maximize visibility before the listing is flagged or removed.",
        incorrect_title: "Look closer",
        incorrect_body: "Paying to promote a very cheap item is unusual for legitimate sellers. Combined with a short duration, this pattern is worth questioning.",
      },
    },
  },
  {
    triggerIds: ["authority_bias"],
    question: {
      id: "q_authority",
      prompt: "A listing uses very professional language, brand-name dropping, and impressive credentials. Should you trust it more?",
      options: [
        { id: "a", text: "Professional listings are always more reliable" },
        { id: "b", text: "Verify claims independently, as professional language can be used to build false trust" },
        { id: "c", text: "Only trust it if the seller is verified" },
      ],
      correct_option_id: "b",
      feedback: {
        correct_title: "Well reasoned",
        correct_body: "Authority bias makes us trust professional-sounding content. Scammers exploit this by mimicking legitimate business language.",
        incorrect_title: "Reconsider",
        incorrect_body: "Polished language doesn't guarantee legitimacy. Scammers often use professional templates to appear trustworthy.",
      },
    },
  },
];

// Selects up to 3 quiz questions whose trigger IDs match the detected findings.
function buildQuizQuestions(findings) {
  const flagIds = new Set(findings.map((f) => f.id));
  const questions = [];

  for (const entry of QUIZ_BANK) {
    if (questions.length >= 3) break;
    const matchedIds = entry.triggerIds.filter((id) => flagIds.has(id));
    if (matchedIds.length === 0) continue;

    questions.push({
      ...entry.question,
      linked_finding_ids: matchedIds,
    });
  }

  return questions;
}

module.exports = { buildQuizQuestions };
