const mongoose = require('mongoose');
const ScrapingProgress = require('../models/ScrapingProgress');
const connectDB = require('../config/db');

async function stopScraping() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');
    
    // Reset progress to stop current scraping
    await ScrapingProgress.deleteMany({});
    console.log('Scraping progress cleared');
    
    // Create a fresh progress record with isCompleted = false
    await ScrapingProgress.create({
      isCompleted: false,
      lastScrapedCategory: null,
      lastScrapedPage: 0
    });
    console.log('New progress record created with isCompleted = false');
    
    console.log('\n=== SCRAPING STOPPED ===');
    console.log('The scraper will resume from the beginning on the next scheduled run.');
    console.log('To restart immediately, the scheduler will handle it automatically.');
    
  } catch (error) {
    console.error('Error stopping scraping:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

stopScraping(); 