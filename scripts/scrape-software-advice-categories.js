const mongoose = require('mongoose');
const { scrapeSoftwareAdviceCategories } = require('../services/softwareAdviceScraper');
const connectDB = require('../config/db');

async function main() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('Connected to MongoDB');

    // Scrape SoftwareAdvice categories
    console.log('Starting SoftwareAdvice category scraping...');
    const categories = await scrapeSoftwareAdviceCategories();
    
    console.log('\n=== SOFTWAREADVICE CATEGORY SCRAPING COMPLETED ===');
    console.log(`Total categories extracted: ${categories.length}`);
    
    // Display first 10 categories as sample
    console.log('\nSample SoftwareAdvice categories:');
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