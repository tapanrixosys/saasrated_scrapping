const mongoose = require('mongoose');
const { scrapeAllCategoryProducts } = require('../services/scraper');
const connectDB = require('../config/db');

async function main() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('Connected to MongoDB');

    console.log('Starting Capterra product scraping...');
    
    // Use the proper function with progress tracking
    const result = await scrapeAllCategoryProducts();
    
    console.log(`\n=== CAPTERRA SCRAPING COMPLETED ===`);
    console.log(`Total categories processed: ${result.categoriesProcessed}`);
    console.log(`Total Capterra products scraped: ${result.totalProducts}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

main(); 