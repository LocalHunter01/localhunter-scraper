// scrapers/mercari.js
//
// Scrapes Mercari US listings using their internal search API.
// Mercari is a national marketplace — it does not filter by zip/radius.
// All results are shipped items, not local pickup. We include it anyway
// because users want it in their alert feed.
//
// Note: Mercari's internal API endpoint is undocumented and may change.
// If this stops working, we fall back to scraping their search HTML.

const axios = require('axios');

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin':          'https://www.mercari.com',
  'Referer':         'https://www.mercari.com/',
  'X-Platform':      'web',
  'DPoP':            'dummy' // required header — Mercari checks for this
};

async function scrapeMercari(keywords, zip, radius = 25) {
  // Mercari's search API endpoint
  const url = 'https://api.mercari.com/v2/cl/search';

  const body = {
    userId:     '',
    pageSize:   20,
    pageToken:  '',
    searchSessionId: Math.random().toString(36).substring(2),
    indexRouting: 'INDEX_ROUTING_UNSPECIFIED',
    thumbnailTypes: [],
    searchCondition: {
      keyword:     keywords,
      excludeKeyword: '',
      sort:        'SORT_CREATED_TIME',
      order:       'ORDER_DESC',
      status:      ['STATUS_ON_SALE'],
      categoryId:  [],
      brandId:     [],
      sellerId:    [],
      priceMin:    0,
      priceMax:    0,
      itemConditionId: [],
      shippingPayerId: [],
      shippingFromArea: [],
      shippingMethod:   [],
      colorId:     [],
      hasCoupon:   false,
      attributes:  [],
      itemTypes:   [],
      skuIds:      []
    },
    defaultDatasets: [],
    serviceFrom: 'suruga',
    withItemBrand: true,
    withItemSize:  false,
    withShopname:  false,
    useDynamicAttribute: false,
    withSuggest:   false
  };

  console.log(`[mercari] Searching for: "${keywords}"`);

  try {
    const response = await axios.post(url, body, {
      headers: HEADERS,
      timeout: 15000
    });

    const items = response.data?.items || [];

    const listings = items.map((item) => ({
      title:       item.name || 'Untitled',
      price:       item.price ? parseInt(item.price, 10) : null,
      description: item.description || '',
      image_url:   item.thumbnails?.[0] || null,
      listing_url: `https://www.mercari.com/us/item/${item.id}/`,
      source:      'mercari',
      found_at:    new Date().toISOString()
    }));

    console.log(`[mercari] Found ${listings.length} listings.`);
    return listings;

  } catch (err) {
    // If the API call fails, fall back to scraping the search page HTML
    console.warn('[mercari] API call failed, trying HTML fallback:', err.message);
    return await scrapeMercariHTML(keywords);
  }
}

// HTML fallback — parses Mercari search page directly
async function scrapeMercariHTML(keywords) {
  const url = `https://www.mercari.com/search/?keyword=${encodeURIComponent(keywords)}`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    timeout: 15000
  });

  // Mercari embeds results in a __NEXT_DATA__ JSON script tag
  const match = response.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    console.log('[mercari] Could not find __NEXT_DATA__ in page HTML.');
    return [];
  }

  try {
    const nextData = JSON.parse(match[1]);
    const items    = nextData?.props?.pageProps?.searchResult?.items || [];

    return items.map((item) => ({
      title:       item.name || 'Untitled',
      price:       item.price ? parseInt(item.price, 10) : null,
      description: item.description || '',
      image_url:   item.thumbnails?.[0] || null,
      listing_url: `https://www.mercari.com/us/item/${item.id}/`,
      source:      'mercari',
      found_at:    new Date().toISOString()
    }));
  } catch (parseErr) {
    console.error('[mercari] Failed to parse __NEXT_DATA__:', parseErr.message);
    return [];
  }
}

module.exports = scrapeMercari;
