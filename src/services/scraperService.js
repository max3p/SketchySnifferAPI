const cheerio = require("cheerio");

// Fetches a Kijiji listing page and extracts structured data.
// Uses a 3-tier fallback strategy (ported from Hackathon-Prep):
//
// Tier 1: JSON-LD structured data (<script type="application/ld+json">)
// Tier 2: Next.js __NEXT_DATA__ with Apollo state
// Tier 3: Meta tags (og:title, og:description) + DOM selectors
//
// Input: url (string)
// Output: { title, description, price, location } — any field may be undefined
// Throws on: network failures, non-2xx HTTP status, timeout

// TODO: Implement — fetch HTML with native fetch + AbortController (10s timeout)
async function fetchListingHtml(url) {}

// TODO: Implement — try to extract data from JSON-LD script tags
function extractFromJsonLd($) {}

// TODO: Implement — try to extract data from __NEXT_DATA__ / Apollo state
function extractFromNextData($) {}

// TODO: Implement — fallback to meta tags and DOM selectors
function extractFromMetaTags($) {}

// TODO: Implement — orchestrate the 3-tier extraction
// Call fetchListingHtml, load into cheerio, try each tier in order,
// merge results (earlier tiers take priority)
async function scrapeListing(url) {}

module.exports = { scrapeListing };
