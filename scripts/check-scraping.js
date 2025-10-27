const mongoose = require('mongoose');
const CapterraProduct = require('../models/CapterraProduct');
const CapterraCategory = require('../models/CapterraCategory');
const CapterraProgress = require('../models/CapterraProgress');
const connectDB = require('../config/db');

async function checkScraping() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');
    
    // Get scraping progress
    const progress = await CapterraProgress.findOne();
    console.log('\n=== CAPTERRA SCRAPING PROGRESS ===');
    console.log('Progress:', progress ? {
      lastScrapedCategory: progress.lastScrapedCategory,
      lastScrapedPage: progress.lastScrapedPage,
      totalPagesInCategory: progress.totalPagesInCategory,
      isCompleted: progress.isCompleted,
      lastUpdated: progress.lastUpdated
    } : 'No progress found');
    
    // Get total categories
    const totalCategories = await CapterraCategory.countDocuments();
    console.log(`\nTotal Capterra categories in database: ${totalCategories}`);
    
    // Get total products
    const totalProducts = await CapterraProduct.countDocuments();
    console.log(`Total Capterra products in database: ${totalProducts}`);
    
    // Get products by category
    const productsByCategory = await CapterraProduct.aggregate([
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
    
    console.log('\n=== CAPTERRA PRODUCTS BY CATEGORY ===');
    productsByCategory.slice(0, 10).forEach(cat => {
      console.log(`${cat._id}: ${cat.count} products`);
    });
    
    // Check for duplicates
    const duplicates = await CapterraProduct.aggregate([
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
      console.log('\n=== DUPLICATE CAPTERRA PRODUCTS FOUND ===');
      duplicates.forEach(dup => {
        console.log(`${dup._id.name} in ${dup._id.category}: ${dup.count} copies`);
      });
    } else {
      console.log('\n✅ No duplicate Capterra products found');
    }
    
    // Check recent products
    const recentProducts = await CapterraProduct.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name category createdAt');
    
    console.log('\n=== RECENT CAPTERRA PRODUCTS ===');
    recentProducts.forEach(product => {
      console.log(`${product.name} (${product.category}) - ${product.createdAt}`);
    });
    
  } catch (error) {
    console.error('Error checking scraping:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
}

checkScraping(); 