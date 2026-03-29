// scrapers/craigslist.js
//
// Scrapes Craigslist "for sale" listings using their public RSS feed.
// The RSS format is stable and doesn't require a headless browser.
//
// Craigslist RSS URL format:
//   https://www.craigslist.org/search/sss?format=rss&query={keywords}&postal={zip}&search_distance={radius}

const axios   = require('axios');
const xml2js  = require('xml2js');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':     'application/rss+xml, application/xml, text/xml, */*'
};

async function scrapeCraigslist(keywords, zip, radius = 25) {
  const url = `https://www.craigslist.org/search/sss?format=rss`
    + `&query=${encodeURIComponent(keywords)}`
    + `&postal=${zip}`
    + `&search_distance=${radius}`;

  console.log(`[craigslist] Fetching: ${url}`);

  const response = await axios.get(url, {
    headers: HEADERS,
    timeout: 15000
  });

  // Parse XML response
  const parsed = await xml2js.parseStringPromise(response.data, {
    explicitArray: false,
    trim: true
  });

  const channel = parsed?.rss?.channel;
  if (!channel || !channel.item) {
    console.log('[craigslist] No items found in RSS feed.');
    return [];
  }

  // xml2js returns a single object if only 1 result, or an array for multiple
  const items = Array.isArray(channel.item) ? channel.item : [channel.item];

  const listings = items.map((item) => {
    // Extract price — Craigslist puts it in the title like "$250 Trek bike"
    const rawTitle   = item.title || '';
    const priceMatch = rawTitle.match(/\$([\d,]+)/);
    const price      = priceMatch
      ? parseFloat(priceMatch[1].replace(/,/g, ''))
      : null;

    // Clean price from title for a cleaner display title
    const title = rawTitle.replace(/\$[\d,]+\s*[-–]?\s*/g, '').trim() || rawTitle;

    // Extract image from enclosure tag if present
    const imageUrl = item.enclosure?.['$']?.url || null;

    // Craigslist description is plain text wrapped in HTML
    const description = item.description
      ? item.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    return {
      title,
      price,
      description,
      image_url:   imageUrl,
      listing_url: item.link || '',
      source:      'craigslist',
      found_at:    new Date().toISOString()
    };
  });

  // Filter out any listings with no URL
  const valid = listings.filter((l) => l.listing_url);
  console.log(`[craigslist] Found ${valid.length} listings.`);
  return valid;
}

module.exports = scrapeCraigslist;
