# Capterra Scraper

Web scraper for Capterra.com and SoftwareAdvice.com.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with required environment variables:
```bash
MONGODB_URI=your_mongodb_connection_string
PORT=5000
```

3. Start the server:
```bash
npm start
```

## API Endpoints

### Capterra Scraping
- `POST /api/scrape/scrape-product` - Scrape a single product
- `POST /api/scrape/scrape-category` - Scrape a category
- `POST /api/scrape/scrape-categories` - Scrape all categories
- `POST /api/scrape/scrape-all-category-products` - Scrape all products from all categories
- `GET /api/scrape/products` - Get scraped products
- `GET /api/scrape/progress` - Get scraping progress

### SoftwareAdvice Scraping
- `POST /api/software-advice/scrape-product` - Scrape a single product
- `POST /api/software-advice/scrape-category` - Scrape a category
- `POST /api/software-advice/scrape-categories` - Scrape all categories
- `GET /api/software-advice/products` - Get scraped products
- `POST /api/software-advice/scrape-all-products` - Scrape all products
- `GET /api/software-advice/progress` - Get scraping progress

### Session Management
- `GET /api/session/status` - Get current session status
- `POST /api/session/start` - Start a new scraping session
- `POST /api/session/stop` - Stop current scraping session

## Scripts

- `npm run scrape-capterra-categories` - Scrape Capterra categories
- `npm run scrape-capterra-products` - Scrape Capterra products
- `npm run scrape-software-advice-categories` - Scrape SoftwareAdvice categories
- `npm run scrape-software-advice-products` - Scrape SoftwareAdvice products
- `npm run check-capterra-scraping` - Check Capterra scraping status
- `npm run check-software-advice-scraping` - Check SoftwareAdvice scraping status
- `npm run reset-capterra-progress` - Reset Capterra progress
- `npm run reset-software-advice-progress` - Reset SoftwareAdvice progress
- `npm run stop-scraping` - Stop all scraping

## Environment Variables

**Required** (must be set in `.env` file):
- `MONGODB_URI` - MongoDB connection string
- `PORT` - Server port (e.g., 5000)

Note: If any required environment variable is missing, the application will exit with an error.

## Note

This scraper connects to the same MongoDB database as the CRUD API application.