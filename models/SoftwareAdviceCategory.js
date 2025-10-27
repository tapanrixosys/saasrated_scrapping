const mongoose = require('mongoose');

const softwareAdviceCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    trim: true
  },
  scrapedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Prevent duplicate categories
softwareAdviceCategorySchema.index({ url: 1 }, { unique: true });

module.exports = mongoose.model('SoftwareAdviceCategory', softwareAdviceCategorySchema); 