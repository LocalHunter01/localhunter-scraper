// scrapers/offerup.js
//
// Scrapes OfferUp listings using their internal GraphQL API.
// OfferUp does support location-based filtering via zip code.
//
// Note: OfferUp's GraphQL API is undocumented and may require header updates
// if they rotate their API keys. The endpoint and headers below were valid
// as of early 2026 — update if results stop returning.

const axios = require('axios');

const HEADERS = {
  'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':       'application/json',
  'Content-Type': 'application/json',
  'Origin':       'https://offerup.com',
  'Referer':      'https://offerup.com/'
};

// OfferUp search URL (HTML page scrape approach — more stable than GraphQL)
async function scrapeOfferUp(keywords, zip, radius = 25) {
  console.log(`[offerup] Searching for: "${keywords}" near ${zip}`);

  // Convert radius miles to meters for OfferUp's API
  const radiusMeters = Math.round(radius * 1609.34);

  const url = `https://offerup.com/search/?q=${encodeURIComponent(keywords)}&radius=${radius}&zip=${zip}`;

  try {
    const response = await axios.get(url, {
      headers: HEADERS,
      timeout: 15000
    });

    // OfferUp injects data into a window.__INITIAL_STATE__ or similar JS variable
    const stateMatch = response.data.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);

    if (stateMatch) {
      const state    = JSON.parse(stateMatch[1]);
      const items    = state?.listingsSearch?.listings?.edges || [];

      const listings = items.map(({ node: item }) => ({
        title:       item.title || 'Untitled',
        price:       item.price?.amount ? parseFloat(item.price.amount) : null,
        description: item.description || '',
        image_url:   item.photos?.[0]?.url || null,
        listing_url: `https://offerup.com/item/detail/${item.id}/`,
        source:      'offerup',
        found_at:    new Date().toISOString()
      }));

      console.log(`[offerup] Found ${listings.length} listings via page state.`);
      return listings;
    }

    // Fallback: try to find next.js data
    const nextMatch = response.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextMatch) {
      const nextData = JSON.parse(nextMatch[1]);
      const edges    = nextData?.props?.pageProps?.listings?.edges || [];

      const listings = edges.map(({ node: item }) => ({
        title:       item.title || 'Untitled',
        price:       item.price?.amount ? parseFloat(item.price.amount) : null,
        description: item.description || '',
        image_url:   item.photos?.[0]?.url || null,
        listing_url: `https://offerup.com/item/detail/${item.id}/`,
        source:      'offerup',
        found_at:    new Date().toISOString()
      }));

      console.log(`[offerup] Found ${listings.length} listings via __NEXT_DATA__.`);
      return listings;
    }

    // If neither data source was found, OfferUp may be blocking or has
    // changed their page structure. Log and return empty.
    console.warn('[offerup] Could not extract listings from page. OfferUp may have updated their site structure.');
    return [];

  } catch (err) {
    console.error('[offerup] Request failed:', err.message);
    throw err;
  }
}

module.exports = scrapeOfferUp;
