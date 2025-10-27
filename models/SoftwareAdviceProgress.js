const mongoose = require('mongoose');

const softwareAdviceProgressSchema = new mongoose.Schema({
  lastScrapedCategory: String,
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
});

module.exports = mongoose.model('SoftwareAdviceProgress', softwareAdviceProgressSchema); 