const mongoose = require('mongoose');
const SoftwareAdviceProduct = require('../models/SoftwareAdviceProduct');
const SoftwareAdviceCategory = require('../models/SoftwareAdviceCategory');
const SoftwareAdviceProgress = require('../models/SoftwareAdviceProgress');
const connectDB = require('../config/db');

async function checkSoftwareAdviceScraping() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');
    
    // Get SoftwareAdvice scraping progress
    const progress = await SoftwareAdviceProgress.findOne();
    console.log('\n=== SOFTWAREADVICE SCRAPING PROGRESS ===');
    console.log('Progress:', progress ? {
      lastScrapedCategory: progress.lastScrapedCategory,
      lastScrapedPage: progress.lastScrapedPage,
      totalPagesInCategory: progress.totalPagesInCategory,
      categoryCompleted: progress.categoryCompleted,
      isCompleted: progress.isCompleted,
      lastUpdated: progress.lastUpdated
    } : 'No progress found');
    
    // Get total SoftwareAdvice categories
    const totalCategories = await SoftwareAdviceCategory.countDocuments();
    console.log(`\nTotal SoftwareAdvice categories in database: ${totalCategories}`);
    
    // Get total SoftwareAdvice products
    const totalProducts = await SoftwareAdviceProduct.countDocuments();
    console.log(`Total SoftwareAdvice products in database: ${totalProducts}`);
    
    // Get products by category
    const productsByCategory = await SoftwareAdviceProduct.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    console.log('\n=== SOFTWAREADVICE PRODUCTS BY CATEGORY ===');
    productsByCategory.slice(0, 10).forEach(cat => {
      console.log(`${cat._id}: ${cat.count} products`);
    });
    
    // Check for duplicates
    const duplicates = await SoftwareAdviceProduct.aggregate([
      {
        $group: {
          _id: { name: '$name', category: '$category' },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);
    
    if (duplicates.length > 0) {
      console.log('\n=== DUPLICATE SOFTWAREADVICE PRODUCTS FOUND ===');
      duplicates.forEach(dup => {
        console.log(`${dup._id.name} in ${dup._id.category}: ${dup.count} copies`);
      });
    } else {
      console.log('\n✅ No duplicate SoftwareAdvice products found');
    }
    
    // Check recent products
    const recentProducts = await SoftwareAdviceProduct.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name category createdAt rating reviewCount');
    
    console.log('\n=== RECENT SOFTWAREADVICE PRODUCTS ===');
    recentProducts.forEach(product => {
      console.log(`${product.name} (${product.category}) - Rating: ${product.rating}, Reviews: ${product.reviewCount} - ${product.createdAt}`);
    });
    
    // Check current category progress
    if (progress && progress.lastScrapedCategory) {
      const currentCategoryProducts = await SoftwareAdviceProduct.countDocuments({
        category: progress.lastScrapedCategory
      });
      console.log(`\n=== CURRENT CATEGORY PROGRESS ===`);
      console.log(`Category: ${progress.lastScrapedCategory}`);
      console.log(`Page: ${progress.lastScrapedPage}/${progress.totalPagesInCategory}`);
      console.log(`Products scraped in this category: ${currentCategoryProducts}`);
    }
    
  } catch (error) {
    console.error('Error checking SoftwareAdvice scraping:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
}

checkSoftwareAdviceScraping(); 