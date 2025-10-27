const mongoose = require('mongoose');
require('dotenv').config();
const { scrapeAllSoftwareAdviceProducts } = require('../services/softwareAdviceScraper');

async function scrapeSoftwareAdviceProducts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected...');

    console.log('Starting SoftwareAdvice product scraping...');
    
    // Start scraping all products
    const result = await scrapeAllSoftwareAdviceProducts();
    
    console.log('\n=== SOFTWAREADVICE PRODUCT SCRAPING COMPLETED ===');
    console.log(`Total categories processed: ${result.categoriesProcessed}`);
    console.log(`Total products scraped: ${result.totalProducts}`);

  } catch (error) {
    console.error('Error during SoftwareAdvice product scraping:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the scraper
scrapeSoftwareAdviceProducts(); 