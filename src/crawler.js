const { chromium } = require("playwright"); // Use require for CommonJS

/**
 * Normalizes a URL string by removing the hash and trailing slash.
 * @param {string} urlString The URL string to normalize.
 * @param {string} [baseUrl] Optional base URL for resolving relative URLs.
 * @returns {string} The normalized URL string, or the original string if normalization fails.
 */
function normalizeUrl(urlString, baseUrl) {
  try {
    const url = new URL(urlString, baseUrl); // Use baseUrl if provided for relative URLs
    url.hash = "";
    let normalized = url.toString();
    if (normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch (error) {
    // console.warn(`Failed to normalize URL: ${urlString}`, error);
    return urlString; // Return original on error
  }
}

/**
 * Crawls a website starting from a given URL and collects all unique sub-path URLs
 * along with their body HTML content, up to a specified limit.
 *
 * @param {string} startUrl The URL to start crawling from.
 * @param {number} [limit=Infinity] The maximum number of URLs to collect data for.
 * @returns {Promise<Map<string, string | null>>} A Promise that resolves to a Map where keys are
 *   normalized URLs and values are the body HTML string or null if fetching failed.
 */
async function crawlWebsite(startUrl, limit = Infinity) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  /** @type {Map<string, string | null>} */
  const collectedData = new Map();

  const normalizedStartUrl = normalizeUrl(startUrl);
  /** @type {Set<string>} */
  const queue = new Set([normalizedStartUrl]);
  const originUrl = new URL(normalizedStartUrl);
  const siteOrigin = originUrl.origin;
  const basePath = originUrl.pathname;

  console.log(`Starting crawl from: ${normalizedStartUrl}`);
  console.log(`Base path for filtering: ${basePath}`);

  while (queue.size > 0 && collectedData.size < limit) {
    const currentUrlFromQueue = queue.values().next().value;
    queue.delete(currentUrlFromQueue);

    const currentNormalizedUrl = currentUrlFromQueue;

    if (collectedData.has(currentNormalizedUrl)) {
      continue;
    }

    console.log(
      `Crawling: ${currentNormalizedUrl} (${collectedData.size + 1}/${
        limit === Infinity ? "Infinity" : limit
      })`
    );
    let bodyHTML = null;

    try {
      await page.goto(currentNormalizedUrl, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      bodyHTML = await page.evaluate(() => document.body?.innerHTML ?? "");

      // --- Link extraction logic ---
      // Only extract links if we haven't hit the limit yet
      // (avoids unnecessary work on the last page visited)
      if (collectedData.size + 1 < limit) {
        // Check limit before link extraction
        const links = await page.evaluate(() =>
          Array.from(
            document.querySelectorAll("a[href]"),
            (a) => /** @type {HTMLAnchorElement} */ (a).href
          )
        );

        for (const link of links) {
          const discoveredNormalizedUrl = normalizeUrl(
            link,
            currentNormalizedUrl
          );
          try {
            const discoveredUrlObject = new URL(discoveredNormalizedUrl);
            if (
              discoveredUrlObject.origin === siteOrigin &&
              discoveredUrlObject.pathname.startsWith(basePath) &&
              !collectedData.has(discoveredNormalizedUrl) &&
              !queue.has(discoveredNormalizedUrl) &&
              queue.size + collectedData.size + 1 < limit + 10 // Optional: prevent queue from growing excessively large past the limit
            ) {
              queue.add(discoveredNormalizedUrl);
            }
          } catch (urlError) {
            // Ignore invalid URLs formed after normalization
          }
        }
      } else {
        console.log(
          "[INFO] Limit reached, skipping link extraction for this page."
        );
      }
      // --- Link extraction logic ends ---
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Navigation timeout")) {
        console.warn(`Timeout visiting ${currentNormalizedUrl}. Skipping.`);
      } else if (errorMessage.includes("net::ERR_")) {
        console.warn(
          `Network error visiting ${currentNormalizedUrl}: ${errorMessage}. Skipping.`
        );
      } else {
        console.error(
          `Error crawling ${currentNormalizedUrl}: ${errorMessage}`
        );
      }
    }

    collectedData.set(currentNormalizedUrl, bodyHTML);
  }

  if (collectedData.size >= limit) {
    console.log(`\nReached limit of ${limit} URLs.`);
  }

  await browser.close();
  console.log(
    `Crawling finished. Collected data for ${collectedData.size} unique URLs.`
  );
  return collectedData;
}

// Use module.exports for CommonJS
module.exports = { crawlWebsite };
