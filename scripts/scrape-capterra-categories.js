const mongoose = require('mongoose');
const { scrapeCategories } = require('../services/scraper');
const connectDB = require('../config/db');

async function main() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('Connected to MongoDB');

    // Scrape categories
    console.log('Starting Capterra category scraping...');
    const categories = await scrapeCategories();
    
    console.log('\n=== CAPTERRA CATEGORY SCRAPING COMPLETED ===');
    console.log(`Total categories extracted: ${categories.length}`);
    
    // Display first 10 categories as sample
    console.log('\nSample Capterra categories:');
    categories.slice(0, 10).forEach((cat, index) => {
      console.log(`${index + 1}. ${cat.name} - ${cat.url}`);
    });

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