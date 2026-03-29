// scrapers/fivemiles.js
//
// Scrapes 5miles listings using their search page.
// 5miles is a hyperlocal marketplace that supports zip-based search.
//
// Important: 5miles has weaker scraping protection than the other platforms,
// which makes it more accessible — but their site structure may change.
// Update the selectors below if results stop returning.

const axios   = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection':      'keep-alive'
};

async function scrape5miles(keywords, zip, radius = 25) {
  console.log(`[5miles] Searching for: "${keywords}" near ${zip}`);

  // Try their API endpoint first
  try {
    return await scrape5milesAPI(keywords, zip, radius);
  } catch (err) {
    console.warn('[5miles] API attempt failed, trying HTML fallback:', err.message);
    return await scrape5milesHTML(keywords, zip, radius);
  }
}

// 5miles has a JSON search endpoint used by their mobile app
async function scrape5milesAPI(keywords, zip, radius) {
  const url = `https://www.5milesapp.com/api/v3.5/post/search`
    + `?q=${encodeURIComponent(keywords)}`
    + `&zipcode=${zip}`
    + `&radius=${radius}`
    + `&page=1`
    + `&size=20`;

  const response = await axios.get(url, {
    headers: {
      ...HEADERS,
      'Accept': 'application/json'
    },
    timeout: 15000
  });

  const items = response.data?.data?.posts || response.data?.posts || [];

  const listings = items.map((item) => ({
    title:       item.title || item.name || 'Untitled',
    price:       item.price ? parseFloat(item.price) : null,
    description: item.description || item.desc || '',
    image_url:   item.coverImage || item.image_url || item.images?.[0] || null,
    listing_url: item.shareLink || item.url || `https://www.5milesapp.com/post/${item.id}`,
    source:      '5miles',
    found_at:    new Date().toISOString()
  }));

  console.log(`[5miles] Found ${listings.length} listings via API.`);
  return listings;
}

// HTML fallback — parse 5miles search results page
async function scrape5milesHTML(keywords, zip, radius) {
  const url = `https://www.5milesapp.com/search/${encodeURIComponent(keywords)}`
    + `?zipcode=${zip}&radius=${radius}`;

  const response = await axios.get(url, {
    headers: HEADERS,
    timeout: 15000
  });

  const $        = cheerio.load(response.data);
  const listings = [];

  // 5miles renders listing cards — adapt selectors if structure changes
  $('[class*="item-card"], [class*="listing-card"], [class*="post-item"]').each((i, el) => {
    const title     = $(el).find('[class*="title"], h2, h3').first().text().trim();
    const priceText = $(el).find('[class*="price"]').first().text().trim();
    const price     = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) : null;
    const imageUrl  = $(el).find('img').first().attr('src') || null;
    const href      = $(el).find('a').first().attr('href') || '';
    const link      = href.startsWith('http') ? href : `https://www.5milesapp.com${href}`;

    if (title && link) {
      listings.push({
        title,
        price:       isNaN(price) ? null : price,
        description: '',
        image_url:   imageUrl,
        listing_url: link,
        source:      '5miles',
        found_at:    new Date().toISOString()
      });
    }
  });

  // Try __NEXT_DATA__ if no cards found
  if (listings.length === 0) {
    const nextMatch = response.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextMatch) {
      try {
        const nextData = JSON.parse(nextMatch[1]);
        const posts    = nextData?.props?.pageProps?.posts
          || nextData?.props?.pageProps?.searchResult?.posts
          || [];

        posts.forEach((item) => {
          listings.push({
            title:       item.title || item.name || 'Untitled',
            price:       item.price ? parseFloat(item.price) : null,
            description: item.description || '',
            image_url:   item.coverImage || item.images?.[0] || null,
            listing_url: item.shareLink || `https://www.5milesapp.com/post/${item.id}`,
            source:      '5miles',
            found_at:    new Date().toISOString()
          });
        });
      } catch (e) {
        console.error('[5miles] Failed to parse __NEXT_DATA__:', e.message);
      }
    }
  }

  console.log(`[5miles] Found ${listings.length} listings via HTML.`);
  return listings;
}

module.exports = scrape5miles;
