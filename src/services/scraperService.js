const cheerio = require("cheerio");

// Fetches a Kijiji listing page and extracts structured data.
// Uses a 3-tier fallback strategy:
//
// Tier 1: JSON-LD structured data (<script type="application/ld+json">)
// Tier 2: Next.js __NEXT_DATA__ with Apollo state
// Tier 3: Meta tags (og:title, og:description) + DOM selectors
//
// Input: url (string)
// Output: { title, description, price, location } — any field may be undefined
// Throws on: network failures, non-2xx HTTP status, timeout

async function fetchListingHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      const error = new Error(`Failed to fetch listing: ${response.status} ${response.statusText}`);
      error.statusCode = 502;
      error.code = "UPSTREAM_FETCH_FAILED";
      throw error;
    }

    return await response.text();
  } catch (err) {
    if (err.name === "AbortError") {
      const error = new Error("Listing fetch timed out after 10 seconds.");
      error.statusCode = 408;
      error.code = "TIMEOUT";
      throw error;
    }
    if (err.statusCode) throw err;
    const error = new Error(`Network error fetching listing: ${err.message}`);
    error.statusCode = 502;
    error.code = "UPSTREAM_FETCH_FAILED";
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractFromJsonLd($) {
  const result = {};

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (item["@type"] === "Product" || item["@type"] === "Offer") {
          result.title = result.title || item.name;
          result.description = result.description || item.description;

          if (item.offers?.price) {
            result.price = result.price || `$${item.offers.price}`;
          } else if (item.price) {
            result.price = result.price || `$${item.price}`;
          }

          if (item.offers?.availableAtOrFrom?.address?.addressLocality) {
            result.location = result.location || item.offers.availableAtOrFrom.address.addressLocality;
          }
        }
      }
    } catch {
      // Malformed JSON-LD block; skip
    }
  });

  return result;
}

function extractFromNextData($) {
  const result = {};

  const nextDataScript = $("#__NEXT_DATA__").html();
  if (!nextDataScript) return result;

  try {
    const nextData = JSON.parse(nextDataScript);

    const apolloState =
      nextData?.props?.pageProps?.initialApolloState ||
      nextData?.props?.pageProps?.__APOLLO_STATE__;

    if (!apolloState) return result;

    for (const key of Object.keys(apolloState)) {
      const node = apolloState[key];

      if (node?.title && node?.__typename?.includes("Listing")) {
        result.title = result.title || node.title;
        result.description = result.description || node.description;

        if (node.price?.amount) {
          result.price = result.price || `$${node.price.amount}`;
        }

        if (node.location?.name) {
          result.location = result.location || node.location.name;
        }

        break;
      }
    }
  } catch {
    // Malformed __NEXT_DATA__; skip
  }

  return result;
}

function extractFromMetaTags($) {
  const result = {};

  result.title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().split("|")[0]?.trim() ||
    undefined;

  result.description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    undefined;

  const priceText =
    $('[class*="price"]').first().text().trim() ||
    $('[data-testid*="price"]').first().text().trim();
  if (priceText) result.price = priceText;

  const locationText =
    $('[class*="location"]').first().text().trim() ||
    $('meta[property="og:locality"]').attr("content");
  if (locationText) result.location = locationText;

  // Clean up falsy values
  for (const key of Object.keys(result)) {
    if (!result[key]) delete result[key];
  }

  return result;
}

async function scrapeListing(url) {
  const html = await fetchListingHtml(url);
  const $ = cheerio.load(html);

  const jsonLdData = extractFromJsonLd($);
  const nextData = extractFromNextData($);
  const metaData = extractFromMetaTags($);

  // Merge: spread order gives JSON-LD highest priority
  const merged = {
    ...metaData,
    ...nextData,
    ...jsonLdData,
  };

  return {
    title: merged.title,
    description: merged.description,
    price: merged.price,
    location: merged.location,
  };
}

module.exports = { scrapeListing };
