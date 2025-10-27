const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  lastScrapedCategory: {
    type: String,
    default: null
  },
  lastScrapedPage: {
    type: Number,
    default: 0
  },
  totalPagesInCategory: {
    type: Number,
    default: 0
  },
  categoryCompleted: {
    type: Boolean,
    default: false
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CapterraProgress', progressSchema); 