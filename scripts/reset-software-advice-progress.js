const mongoose = require('mongoose');
require('dotenv').config();
const SoftwareAdviceProgress = require('../models/SoftwareAdviceProgress');

async function resetSoftwareAdviceProgress() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected...');

    // Reset progress
    await SoftwareAdviceProgress.deleteMany({});
    console.log('SoftwareAdvice progress reset successfully');

    // Create a new progress document
    const newProgress = new SoftwareAdviceProgress({
      lastScrapedCategory: null,
      lastScrapedPage: 0,
      isCompleted: false,
      lastUpdated: new Date()
    });
    await newProgress.save();
    console.log('New SoftwareAdvice progress document created');

  } catch (error) {
    console.error('Error resetting SoftwareAdvice progress:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the reset
resetSoftwareAdviceProgress(); 