const { scrapeCategory, scrapeProductPage, scrapeCategories } = require('../services/scraper');
const CapterraProduct = require('../models/CapterraProduct');
const CapterraCategory = require('../models/CapterraCategory');
const CapterraProgress = require('../models/CapterraProgress');

exports.scrapeProduct = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const product = await scrapeProductPage(url);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found or could not be scraped' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error in scrapeProduct:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.scrapeCategory = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const products = await scrapeCategory(url);
    
    if (products.length === 0) {
      return res.status(404).json({ error: 'No products found or could not be scraped' });
    }

    res.json(products);
  } catch (error) {
    console.error('Error in scrapeCategory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.scrapeCategories = async (req, res) => {
  try {
    const categories = await scrapeCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error in scrapeCategories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const { category, minRating, limit } = req.query;
    
    const query = {};
    if (category) query.category = category;
    if (minRating) query.rating = { $gte: parseFloat(minRating) };
    
    const products = await CapterraProduct.find(query)
      .sort({ rating: -1, reviewCount: -1 })
      .limit(parseInt(limit) || 10);
    
    res.json(products);
  } catch (error) {
    console.error('Error in getProducts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.scrapeAllCategoryProducts = async (req, res) => {
  try {
    await require('../services/scraper').scrapeAllCategoryProducts();
    res.json({ message: 'Scraping all category products started.' });
  } catch (error) {
    console.error('Error in scrapeAllCategoryProducts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getScrapingProgress = async (req, res) => {
  try {
    const progress = await CapterraProgress.findOne();
    const totalCategories = await CapterraCategory.countDocuments();
    const totalProducts = await CapterraProduct.countDocuments();
    
    res.json({
      progress: progress || {},
      totalCategories,
      totalProducts,
      isCompleted: progress ? progress.isCompleted : false
    });
  } catch (error) {
    console.error('Error in getScrapingProgress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}; 