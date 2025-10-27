const { 
  scrapeSoftwareAdviceCategories, 
  scrapeSoftwareAdviceProductPage, 
  scrapeSoftwareAdviceCategory,
  scrapeAllSoftwareAdviceProducts 
} = require('../services/softwareAdviceScraper');
const SoftwareAdviceProduct = require('../models/SoftwareAdviceProduct');
const SoftwareAdviceCategory = require('../models/SoftwareAdviceCategory');
const SoftwareAdviceProgress = require('../models/SoftwareAdviceProgress');

exports.scrapeSoftwareAdviceProduct = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const product = await scrapeSoftwareAdviceProductPage(url);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found or could not be scraped' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error in scrapeSoftwareAdviceProduct:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.scrapeSoftwareAdviceCategory = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const products = await scrapeSoftwareAdviceCategory(url);
    
    if (products.length === 0) {
      return res.status(404).json({ error: 'No products found or could not be scraped' });
    }

    res.json(products);
  } catch (error) {
    console.error('Error in scrapeSoftwareAdviceCategory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.scrapeSoftwareAdviceCategories = async (req, res) => {
  try {
    const categories = await scrapeSoftwareAdviceCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error in scrapeSoftwareAdviceCategories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getSoftwareAdviceProducts = async (req, res) => {
  try {
    const { category, minRating, limit } = req.query;
    
    const query = {};
    if (category) query.category = category;
    if (minRating) query.rating = { $gte: parseFloat(minRating) };
    
    const products = await SoftwareAdviceProduct.find(query)
      .sort({ rating: -1, reviewCount: -1 })
      .limit(parseInt(limit) || 10);
    
    res.json(products);
  } catch (error) {
    console.error('Error in getSoftwareAdviceProducts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.scrapeAllSoftwareAdviceProducts = async (req, res) => {
  try {
    await scrapeAllSoftwareAdviceProducts();
    res.json({ message: 'SoftwareAdvice scraping all products started.' });
  } catch (error) {
    console.error('Error in scrapeAllSoftwareAdviceProducts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getSoftwareAdviceProgress = async (req, res) => {
  try {
    const progress = await SoftwareAdviceProgress.findOne();
    const totalCategories = await SoftwareAdviceCategory.countDocuments();
    const totalProducts = await SoftwareAdviceProduct.countDocuments();
    
    res.json({
      progress: progress || {},
      totalCategories,
      totalProducts,
      isCompleted: progress ? progress.isCompleted : false
    });
  } catch (error) {
    console.error('Error in getSoftwareAdviceProgress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}; 