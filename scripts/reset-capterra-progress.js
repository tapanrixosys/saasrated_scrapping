const mongoose = require('mongoose');
const CapterraProgress = require('../models/CapterraProgress');
const connectDB = require('../config/db');

async function resetCapterraProgress() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');
    
    // Delete all Capterra progress records
    await CapterraProgress.deleteMany({});
    console.log('Capterra scraping progress reset successfully');
    
    // Create a fresh Capterra progress record
    await CapterraProgress.create({});
    console.log('New Capterra progress record created');
    
  } catch (error) {
    console.error('Error resetting Capterra progress:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

resetCapterraProgress(); 