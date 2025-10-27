const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  reviewCount: {
    type: Number,
    default: 0
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
  features: [{
    type: String,
    trim: true
  }],
  pricing: {
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
  logo: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Create compound index for name and category to prevent duplicates
productSchema.index({ name: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('CapterraProduct', productSchema); 