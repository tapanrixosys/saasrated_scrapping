const express = require('express');
const router = express.Router();
const { startScrapingSession, stopAllScraping, getSessionStatus } = require('../services/scheduler');

// Get current session status
router.get('/status', (req, res) => {
  const status = getSessionStatus();
  res.json(status);
});

// Start a new 1-hour scraping session
router.post('/start', async (req, res) => {
  try {
    const result = await startScrapingSession();
    if (!result.success) {
      res.status(409).json(result); // 409 Conflict - session already running
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Error starting scraping session:', error);
    res.status(500).json({ error: 'Failed to start scraping session' });
  }
});

// Stop current scraping session
router.post('/stop', async (req, res) => {
  try {
    await stopAllScraping();
    res.json({ 
      success: true,
      message: 'Scraping session stopped successfully',
      ...getSessionStatus()
    });
  } catch (error) {
    console.error('Error stopping scraping session:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to stop scraping session' 
    });
  }
});

module.exports = router; 