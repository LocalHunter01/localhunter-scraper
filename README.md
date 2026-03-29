# LocalHunter Scraper API

A free Node.js API that scrapes local marketplace listings from Craigslist, OfferUp, Mercari, and 5miles. Designed to be deployed to Render.com's free tier and called by the LocalHunter Base44 app every 2 hours.

---

## 🚀 Deployment Instructions (Step by Step)

### Step 1 — Create a GitHub Account (if you don't have one)
Go to https://github.com and sign up for a free account.

### Step 2 — Create a New GitHub Repository
1. Log into GitHub
2. Click the **"+"** icon in the top right → **"New repository"**
3. Name it: `localhunter-scraper`
4. Set it to **Public**
5. Do NOT check "Add a README" — we already have one
6. Click **"Create repository"**

### Step 3 — Upload the Files
On the new empty repository page, click **"uploading an existing file"** link.
Drag and drop ALL of these files into the upload area:
- `package.json`
- `server.js`
- `render.yaml`
- `.gitignore`
- `README.md`
- The entire `scrapers/` folder (upload each file inside it):
  - `scrapers/craigslist.js`
  - `scrapers/mercari.js`
  - `scrapers/offerup.js`
  - `scrapers/fivemiles.js`

Click **"Commit changes"**.

### Step 4 — Create a Render.com Account
Go to https://render.com and sign up for a free account.
When prompted, connect your GitHub account to Render.

### Step 5 — Deploy to Render
1. In Render, click **"New +"** → **"Web Service"**
2. Connect your GitHub account if not already connected
3. Find and select your `localhunter-scraper` repository
4. Render will auto-detect the settings from `render.yaml`. Confirm:
   - **Name:** localhunter-scraper
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Click **"Create Web Service"**
6. Wait 2–3 minutes for the build to complete
7. Once deployed, Render gives you a URL like: `https://localhunter-scraper.onrender.com`

**Copy that URL — you'll need it for Base44.**

### Step 6 — Test Your API
Open a new browser tab and go to:
```
https://localhunter-scraper.onrender.com/
```
You should see:
```json
{
  "status": "LocalHunter Scraper API is running",
  "version": "1.0.0"
}
```

To test an actual search, use a tool like Postman or the curl command below:
```
curl -X POST https://localhunter-scraper.onrender.com/search \
  -H "Content-Type: application/json" \
  -d '{"keywords":"mountain bike","zip":"40220","radius":25,"sources":["craigslist"]}'
```

---

## 📡 API Reference

### GET /
Health check. Returns API status.

### POST /search

**Request Body:**
```json
{
  "keywords": "nintendo switch",
  "zip": "40220",
  "radius": 25,
  "sources": ["craigslist", "offerup", "mercari", "5miles"]
}
```

| Field    | Type   | Required | Description |
|----------|--------|----------|-------------|
| keywords | string | ✅ Yes   | Search terms |
| zip      | string | ✅ Yes   | 5-digit US zip code |
| radius   | number | No       | Miles from zip. Default: 25 |
| sources  | array  | No       | Platforms to search. Default: all four |

**Response:**
```json
{
  "listings": [
    {
      "title": "Trek Marlin Mountain Bike",
      "price": 350,
      "description": "Great condition, barely used...",
      "image_url": "https://...",
      "listing_url": "https://craigslist.org/...",
      "source": "craigslist",
      "found_at": "2026-03-29T14:00:00.000Z"
    }
  ],
  "errors": [],
  "count": 1
}
```

---

## ⚠️ Platform Notes

| Platform   | Location Filter | Reliability | Notes |
|------------|----------------|-------------|-------|
| Craigslist | ✅ Yes (zip)   | High        | Uses stable RSS feed |
| OfferUp    | ✅ Yes (zip)   | Medium      | May need header updates |
| Mercari    | ❌ National    | Medium      | Ships only, no local filter |
| 5miles     | ✅ Yes (zip)   | Medium      | Custom API + HTML fallback |

---

## 🔄 How It Connects to Base44

In Base44, you will create a Scheduled Action that runs every 2 hours.
That action calls `POST /search` for each active WatchItem, compares results
against existing FoundListings (to avoid duplicates), saves new ones,
and triggers push notifications.

Your Render URL will be the base URL for all those calls.
