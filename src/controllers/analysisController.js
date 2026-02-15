const cache = require("../config/cache");
const scraperService = require("../services/scraperService");

// POST /api/analyses handler
// Simplified for scraper milestone: scrape listing, log to console, return JSON.
// AI analysis skipped for now.

async function analyzeListing(req, res, next) {
  const { url } = req.body;

  const cached = cache.get(url);
  if (cached) {
    return res.status(200).json(cached);
  }

  try {
    const listingData = await scraperService.scrapeListing(url);

    if (!listingData.title && !listingData.description && !listingData.price) {
      return res.status(422).json({
        error: {
          code: "UNSUPPORTED_URL",
          message: "Could not extract listing data from the provided URL.",
        },
      });
    }

    console.log("\n=== Scraped Listing Data ===");
    console.log("URL:", url);
    console.log("Title:", listingData.title || "(not found)");
    console.log("Price:", listingData.price || "(not found)");
    console.log("Location:", listingData.location || "(not found)");
    console.log(
      "Description:",
      listingData.description
        ? listingData.description.substring(0, 200) +
            (listingData.description.length > 200 ? "..." : "")
        : "(not found)"
    );
    console.log("===========================\n");

    const response = {
      source: {
        platform: "kijiji",
        url,
      },
      listing: listingData,
    };

    cache.set(url, response);
    return res.status(200).json(response);
  } catch (err) {
    if (err.statusCode && err.code) {
      return next(err);
    }

    console.error("Analysis error:", err.stack || err);
    const unexpectedError = new Error("An unexpected error occurred during analysis.");
    unexpectedError.statusCode = 500;
    unexpectedError.code = "INTERNAL_ERROR";
    return next(unexpectedError);
  }
}

module.exports = { analyzeListing };
