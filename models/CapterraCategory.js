const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Create unique index for name to prevent duplicates
categorySchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('CapterraCategory', categorySchema); 