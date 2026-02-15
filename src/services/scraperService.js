const cheerio = require("cheerio");

// Fetches a Kijiji listing page and extracts structured data.
// Uses a 3-tier fallback strategy:
//
// Tier 1: JSON-LD structured data (<script type="application/ld+json">)
// Tier 2: Next.js __NEXT_DATA__ with Apollo state
// Tier 3: Meta tags (og:title, og:description) + DOM selectors
//
// Input: url (string)
// Output: expanded listing data object (see docs/scam-detecting-plan.md §6)
//   { title, description, price, location, category, condition,
//     images, seller, listing, payment }
//   — any field may be undefined
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

    let listingNode = null;
    let profileNode = null;

    for (const key of Object.keys(apolloState)) {
      const node = apolloState[key];

      if (node?.title && node?.__typename?.includes("Listing")) {
        listingNode = node;
      }

      if (node?.__typename === "StandardProfileV2") {
        profileNode = node;
      }
    }

    if (!listingNode) return result;

    // Core fields (existing)
    result.title = listingNode.title;
    result.description = listingNode.description;

    // Price — expanded to include originalAmount and priceDrop
    if (listingNode.price?.amount != null) {
      result.price = {
        amount: listingNode.price.amount / 100,
        currency: listingNode.price.currency || "CAD",
        originalAmount: listingNode.price.originalAmount
          ? listingNode.price.originalAmount / 100
          : undefined,
        priceDrop: listingNode.flags?.priceDrop || false,
      };
    }

    // Location — expanded to include address and coordinates
    if (listingNode.location) {
      result.location = {
        name: listingNode.location.name,
        address: listingNode.location.address,
        coordinates: listingNode.location.coordinates
          ? {
              latitude: listingNode.location.coordinates.latitude,
              longitude: listingNode.location.coordinates.longitude,
            }
          : undefined,
      };
    }

    // Category — resolve hierarchy from Apollo Category refs
    // The listing's category node has categoryPaths: [{ __ref: "Category:10" }, ...]
    // Each ref points to a Category node with a localizedName key
    const categoryNode = apolloState[`Category:${listingNode.categoryId}`];
    if (categoryNode?.categoryPaths) {
      result.category = categoryNode.categoryPaths
        .map((ref) => {
          const catNode = apolloState[ref.__ref];
          if (!catNode) return undefined;
          // localizedName key is dynamic, e.g. localizedName({"locale":"en-CA"})
          const nameKey = Object.keys(catNode).find((k) => k.startsWith("localizedName"));
          return nameKey ? catNode[nameKey] : undefined;
        })
        .filter(Boolean);
    }

    // Attributes — extract condition and payment info from attributes.all[]
    const attributes = listingNode.attributes?.all || [];

    function getAttr(canonicalName) {
      return attributes.find((a) => a.canonicalName === canonicalName);
    }

    // Condition
    const conditionAttr = getAttr("condition");
    if (conditionAttr?.values?.[0]) {
      result.condition = conditionAttr.values[0];
    }

    // Images
    if (listingNode.imageUrls) {
      result.images = {
        urls: listingNode.imageUrls,
        count: listingNode.imageUrls.length,
      };
    }

    // Seller profile
    result.seller = {
      id: listingNode.posterInfo?.posterId,
      verified: listingNode.posterInfo?.verified || false,
      type: listingNode.posterInfo?.sellerType,
      name: profileNode?.name,
      numberOfListings: profileNode?.numberOfListings,
      hasProfilePhoto: profileNode?.imageUrl != null,
    };

    // Listing metadata
    result.listing = {
      id: listingNode.id,
      activationDate: listingNode.activationDate,
      endDate: listingNode.endDate,
      views: listingNode.metrics?.views,
      topAd: listingNode.flags?.topAd || false,
      adSource: listingNode.adSource,
    };

    // Payment attributes — canonicalValues are "true"/"false" strings
    const cashAccepted = getAttr("cashaccepted");
    const cashless = getAttr("cashless");
    const shipping = getAttr("shipping");

    result.payment = {
      cashAccepted: cashAccepted?.canonicalValues?.[0] === "true",
      cashless: cashless?.canonicalValues?.[0] === "true",
      shipping: shipping?.canonicalValues?.[0] === "true",
    };
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

  // NextData (Apollo state) is the richest source — it has seller, images, metadata.
  // JSON-LD and meta tags provide fallbacks for core text fields only.
  // For title/description: JSON-LD > NextData > MetaTags
  // For everything else: NextData is the sole source.

  return {
    title: jsonLdData.title || nextData.title || metaData.title,
    description: jsonLdData.description || nextData.description || metaData.description,
    price: nextData.price || jsonLdData.price || metaData.price,
    location: nextData.location || jsonLdData.location || metaData.location,
    category: nextData.category,
    condition: nextData.condition,
    images: nextData.images,
    seller: nextData.seller,
    listing: nextData.listing,
    payment: nextData.payment,
  };
}

module.exports = { scrapeListing };
