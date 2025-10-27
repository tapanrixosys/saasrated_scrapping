const mongoose = require('mongoose');

const softwareAdviceProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  pricing: {
    startingPrice: {
      type: String,
      trim: true
    },
    plans: [{
      name: {
        type: String,
        trim: true
      },
      price: {
        type: String,
        trim: true
      }
    }]
  },
  features: [{
    type: String,
    trim: true
  }],
  logo: {
    type: String,
    trim: true
  },
  vendor: {
    name: {
      type: String,
      trim: true
    },
    website: {
      type: String,
      trim: true
    }
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  scrapedAt: {
    type: Date,
    default: Date.now
  },
  category: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Prevent duplicate entries
softwareAdviceProductSchema.index({ name: 1, 'vendor.name': 1, category: 1 }, { unique: true });

module.exports = mongoose.model('SoftwareAdviceProduct', softwareAdviceProductSchema); 