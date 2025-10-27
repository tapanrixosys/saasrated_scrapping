const express = require('express');
const scrapeController = require('../controllers/scrapeController');

const router = express.Router();

// API endpoints
router.post('/scrape-product', scrapeController.scrapeProduct);
router.post('/scrape-category', scrapeController.scrapeCategory);
router.post('/scrape-categories', scrapeController.scrapeCategories);
router.get('/products', scrapeController.getProducts);
router.post('/scrape-all-category-products', scrapeController.scrapeAllCategoryProducts);
router.get('/progress', scrapeController.getScrapingProgress);

module.exports = router; 