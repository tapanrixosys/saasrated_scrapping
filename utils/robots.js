const axios = require('axios');
const RobotsParser = require('robots-parser');

const checkRobotsTxt = async (baseUrl, targetUrl) => {
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).href;
    const response = await axios.get(robotsUrl, {
      headers: {
        'User-Agent': '*'
      }
    });
    
    const robots = RobotsParser(robotsUrl, response.data);
    const isAllowed = robots.isAllowed(targetUrl, 'ProductScraper/1.0');
    
    return isAllowed !== false; // Return true if allowed or undefined
  } catch (error) {
    // If robots.txt doesn't exist or can't be fetched, assume scraping is allowed
    console.log(`Could not fetch robots.txt for ${baseUrl}, proceeding with scrape`);
    return true;
  }
};

module.exports = {
  checkRobotsTxt
}; 