const express = require('express');
const app = express();
app.use(express.json());

const scrapeCraigslist = require('./scrapers/craigslist');
const scrapeMercari    = require('./scrapers/mercari');
const scrapeOfferUp    = require('./scrapers/offerup');
const scrape5miles     = require('./scrapers/fivemiles');

const PORT = process.env.PORT || 3000;

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'LocalHunter Scraper API is running',
    version: '1.0.0',
    endpoints: {
      search: 'POST /search',
      health: 'GET /'
    }
  });
});

// ─── Main search endpoint ─────────────────────────────────────────────────────
//
// Body parameters:
//   keywords  (string, required) — e.g. "trek mountain bike"
//   zip       (string, required) — 5-digit US zip code
//   radius    (number, optional) — miles, default 25
//   sources   (array,  optional) — any of: "craigslist","offerup","mercari","5miles"
//                                   defaults to all four
//
// Example request body:
//   {
//     "keywords": "nintendo switch",
//     "zip": "40220",
//     "radius": 25,
//     "sources": ["craigslist", "offerup", "mercari", "5miles"]
//   }
//
// Response:
//   {
//     "listings": [ ...normalized listing objects... ],
//     "errors":   [ ...any platforms that failed... ],
//     "count":    12
//   }
//
// Each listing object:
//   {
//     "title":       "Nintendo Switch OLED",
//     "price":       280,
//     "description": "Barely used...",
//     "image_url":   "https://...",
//     "listing_url": "https://...",
//     "source":      "craigslist",
//     "found_at":    "2026-03-29T14:00:00.000Z"
//   }

app.post('/search', async (req, res) => {
  const {
    keywords,
    zip,
    radius  = 25,
    sources = ['craigslist', 'offerup', 'mercari', '5miles']
  } = req.body;

  // ── Validate required fields ──────────────────────────────────────────────
  if (!keywords || !zip) {
    return res.status(400).json({
      error: 'Both "keywords" and "zip" are required in the request body.'
    });
  }

  // ── Map source name → scraper function ────────────────────────────────────
  const scraperMap = {
    craigslist: scrapeCraigslist,
    offerup:    scrapeOfferUp,
    mercari:    scrapeMercari,
    '5miles':   scrape5miles
  };

  const listings = [];
  const errors   = [];

  // ── Run all requested scrapers in parallel ────────────────────────────────
  const tasks = sources.map(async (source) => {
    const fn = scraperMap[source];
    if (!fn) return; // unknown source — skip silently

    try {
      const results = await fn(keywords, zip, radius);
      listings.push(...results);
    } catch (err) {
      console.error(`[${source}] scrape error:`, err.message);
      errors.push({ source, error: err.message });
    }
  });

  await Promise.allSettled(tasks);

  // ── Sort by most recently found ───────────────────────────────────────────
  listings.sort((a, b) => new Date(b.found_at) - new Date(a.found_at));

  return res.json({
    listings,
    errors,
    count: listings.length
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`LocalHunter Scraper API listening on port ${PORT}`);
});
