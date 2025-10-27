require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const scrapeRoutes = require('./routes/scrapeRoutes');
const softwareAdviceRoutes = require('./routes/softwareAdviceRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const { startScrapingJob, startCategoryScrapingJob, isScrapingRunning, isInitialScrapingComplete, setInitialScrapingStatus, startSoftwareAdviceScrapingJob, startSoftwareAdviceCategoryJob, startScrapingSession } = require('./services/scheduler');
const { scrapeAllCategoryProducts } = require('./services/scraper');
const CapterraProgress = require('./models/CapterraProgress');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
connectDB();

// Scraping Routes
app.use('/api/scrape', scrapeRoutes);
app.use('/api/software-advice', softwareAdviceRoutes);
app.use('/api/session', sessionRoutes);

// Basic route for health check
app.get('/', (req, res) => {
  res.send('Capterra & SoftwareAdvice Scraper API is running');
});

// Route to check if scraping is running
app.get('/api/status', (req, res) => {
  res.json({ 
    scrapingInProgress: isScrapingRunning(),
    initialScrapingComplete: isInitialScrapingComplete(),
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'capterra-scrapper',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Start initial 1-hour scraping session
console.log('Starting initial 1-hour scraping session...');
startScrapingSession();

if (!process.env.PORT) {
  console.error('Error: PORT is not defined in .env file');
  process.exit(1);
}

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log('Server is ready to accept requests');
});

module.exports = app; 