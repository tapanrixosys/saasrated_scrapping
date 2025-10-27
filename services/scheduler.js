const cron = require('node-cron');
const { scrapeAllCategoryProducts, scrapeCategories } = require('./scraper');
const CapterraProgress = require('../models/CapterraProgress');
const {
  scrapeAllSoftwareAdviceProducts,
  scrapeSoftwareAdviceCategories
} = require('./softwareAdviceScraper');

let isScrapingInProgress = false;
let lastScrapingStart = null;
let scrapingJobId = null;
let initialScrapingComplete = false;
let initialScrapingInProgress = false;
let scrapingTimeout = null;
let sessionStartTime = null;

// Function to stop all scraping jobs
const stopAllScraping = async () => {
  console.log('\n=== Stopping all scraping jobs ===');
  isScrapingInProgress = false;
  initialScrapingInProgress = false;
  lastScrapingStart = null;
  scrapingJobId = null;
  
  // Clear the timeout to prevent memory leaks
  if (scrapingTimeout) {
    clearTimeout(scrapingTimeout);
    scrapingTimeout = null;
  }
  sessionStartTime = null;
  
  console.log('All scraping jobs have been stopped.');
};

// Function to start immediate scraping
const startImmediateScraping = async () => {
  try {
    console.log('\n=== Starting immediate product scraping ===');
    
    // Start Capterra product scraping immediately
    console.log('Starting Capterra product scraping...');
    scrapeAllCategoryProducts().catch(error => {
      console.error('Error in Capterra immediate scraping:', error);
    });
    
    // Start SoftwareAdvice product scraping after 5 minutes
    console.log('SoftwareAdvice product scraping will start in 5 minutes...');
    setTimeout(() => {
      console.log('Starting SoftwareAdvice product scraping...');
      scrapeAllSoftwareAdviceProducts().catch(error => {
        console.error('Error in SoftwareAdvice immediate scraping:', error);
      });
    }, 5 * 60 * 1000); // 5 minutes delay
    
  } catch (error) {
    console.error('Error during immediate scraping setup:', error);
  }
};

// Function to start a new scraping session
const startScrapingSession = async () => {
  // Check if a session is already running
  const currentStatus = getSessionStatus();
  if (currentStatus.active) {
    return {
      success: false,
      message: 'A scraping session is already running',
      ...currentStatus
    };
  }

  console.log('\n=== Starting new 1-hour scraping session ===');
  sessionStartTime = Date.now();
  
  // Start immediate product scraping with 5-minute offset
  startImmediateScraping();
  
  // Start scheduled product scraping jobs
  startScrapingJob();
  startSoftwareAdviceScrapingJob();

  // Set timeout to stop all scraping after 1 hour
  scrapingTimeout = setTimeout(stopAllScraping, 60 * 60 * 1000); // 1 hour

  return {
    success: true,
    message: 'New 1-hour scraping session started successfully',
    ...getSessionStatus()
  };
};

// Function to get session status
const getSessionStatus = () => {
  if (!sessionStartTime || !scrapingTimeout) {
    return {
      active: false,
      timeRemaining: 0,
      sessionStartTime: null
    };
  }

  const timeElapsed = Date.now() - sessionStartTime;
  const timeRemaining = Math.max(0, 3600000 - timeElapsed); // 3600000 ms = 1 hour

  return {
    active: timeRemaining > 0,
    timeRemaining: Math.floor(timeRemaining / 1000), // Convert to seconds
    sessionStartTime: new Date(sessionStartTime).toISOString()
  };
};

const startScrapingJob = async () => {
  console.log('Capterra product scraping scheduler started. Will run every 10 minutes for 1 hour.');
  
  // Run Capterra scraping every 10 minutes starting at 0
  cron.schedule('*/10 * * * *', async () => {
    // Check if we should still be scraping
    if (!scrapingTimeout) {
      console.log('Scraping timeout reached. No more Capterra scraping will be performed.');
      return;
    }
    
    // Generate unique job ID for this run
    const currentJobId = Date.now().toString();
    
    if (isScrapingInProgress || initialScrapingInProgress) {
      console.log('Previous Capterra scraping job still in progress. Skipping this run.');
      return;
    }

    try {
      isScrapingInProgress = true;
      lastScrapingStart = Date.now();
      scrapingJobId = currentJobId;
      console.log('\n=== Starting scheduled Capterra product scraping job ===');
      console.log('Job ID:', currentJobId);
      console.log('Time:', new Date().toISOString());
      
      const progress = await CapterraProgress.findOne();
      if (!progress || !progress.isCompleted) {
        await scrapeAllCategoryProducts();
        initialScrapingComplete = true;
      } else {
        console.log('All Capterra products have been scraped. Skipping...');
        initialScrapingComplete = true;
      }
    } catch (error) {
      console.error('Error in Capterra scraping job:', error);
    } finally {
      // Only reset if this is still the current job
      if (scrapingJobId === currentJobId) {
        isScrapingInProgress = false;
        lastScrapingStart = null;
        scrapingJobId = null;
      }
    }
  });
};

// SoftwareAdvice product scraping job (every 10 min, offset by 5 min)
const startSoftwareAdviceScrapingJob = async () => {
  console.log('SoftwareAdvice product scraping scheduler started. Will run every 10 minutes for 1 hour, offset by 5 minutes.');

  // Run SoftwareAdvice scraping every 10 minutes starting at minute 5
  cron.schedule('5-59/10 * * * *', async () => {
    // Check if we should still be scraping
    if (!scrapingTimeout) {
      console.log('Scraping timeout reached. No more SoftwareAdvice scraping will be performed.');
      return;
    }
    
    console.log('\n=== Starting scheduled SoftwareAdvice product scraping job ===');
    console.log('Time:', new Date().toISOString());
    try {
      await scrapeAllSoftwareAdviceProducts();
    } catch (error) {
      console.error('Error in SoftwareAdvice scraping job:', error);
    }
  });
};

// Export function to check if scraping is in progress
const isScrapingRunning = () => {
  return isScrapingInProgress || initialScrapingInProgress;
};

// Export function to check if initial scraping is complete
const isInitialScrapingComplete = () => {
  return initialScrapingComplete;
};

// Function to set initial scraping status
const setInitialScrapingStatus = (status) => {
  initialScrapingInProgress = status;
};

module.exports = {
  startScrapingJob,
  startSoftwareAdviceScrapingJob,
  isScrapingRunning,
  isInitialScrapingComplete,
  setInitialScrapingStatus,
  startScrapingSession,
  stopAllScraping,
  getSessionStatus
}; 