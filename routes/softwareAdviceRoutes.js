const express = require('express');
const softwareAdviceController = require('../controllers/softwareAdviceController');

const router = express.Router();

// SoftwareAdvice API endpoints
router.post('/scrape-product', softwareAdviceController.scrapeSoftwareAdviceProduct);
router.post('/scrape-category', softwareAdviceController.scrapeSoftwareAdviceCategory);
router.post('/scrape-categories', softwareAdviceController.scrapeSoftwareAdviceCategories);
router.get('/products', softwareAdviceController.getSoftwareAdviceProducts);
router.post('/scrape-all-products', softwareAdviceController.scrapeAllSoftwareAdviceProducts);
router.get('/progress', softwareAdviceController.getSoftwareAdviceProgress);

module.exports = router; 