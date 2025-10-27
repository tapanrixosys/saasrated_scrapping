const puppeteer = require('puppeteer');
const SoftwareAdviceCategory = require('../models/SoftwareAdviceCategory');
const SoftwareAdviceProduct = require('../models/SoftwareAdviceProduct');
const SoftwareAdviceProgress = require('../models/SoftwareAdviceProgress');
const { checkRobotsTxt } = require('../utils/robots');

const BASE_URL = 'https://www.softwareadvice.com';

const scrapeSoftwareAdviceCategories = async () => {
  console.log('Starting to scrape SoftwareAdvice categories...');
  
  try {
    const isAllowed = await checkRobotsTxt(BASE_URL, `${BASE_URL}/categories/`);
    if (!isAllowed) {
      console.log('Scraping disallowed by robots.txt for SoftwareAdvice categories');
      return [];
    }

    const browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    await page.goto(`${BASE_URL}/categories/`, { waitUntil: 'networkidle2', timeout: 60000 });

    // Extract categories from the page
    const categories = await page.evaluate((BASE_URL) => {
      const categoryLinks = Array.from(document.querySelectorAll('a[data-testid^="category-link-"]'));
      const extractedCategories = [];

      categoryLinks.forEach(link => {
        const href = link.getAttribute('href');
        const name = link.textContent.trim();
        
        if (href && name && !href.includes('#') && !name.includes('sr-only')) {
          const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
          const slug = href.replace(/^\//, '').replace(/\/$/, '');
          
          extractedCategories.push({
            name: name,
            url: fullUrl,
            slug: slug
          });
        }
      });

      return extractedCategories;
    }, BASE_URL);

    await browser.close();

    // Save categories to database
    const savedCategories = [];
    for (const category of categories) {
      try {
        const savedCategory = await SoftwareAdviceCategory.findOneAndUpdate(
          { url: category.url },
          category,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        savedCategories.push(savedCategory);
      } catch (error) {
        if (error.code !== 11000) { // Ignore duplicate key errors
          console.error(`Error saving category ${category.name}:`, error.message);
        }
      }
    }

    console.log(`Successfully scraped ${savedCategories.length} SoftwareAdvice categories`);
    return savedCategories;

  } catch (error) {
    console.error('Error scraping SoftwareAdvice categories:', error.message);
    return [];
  }
};

const scrapeSoftwareAdviceProductPage = async (url, categoryName = null) => {
  let browser;
  try {
    console.log(`Starting to scrape SoftwareAdvice product page: ${url}`);
    
    const isAllowed = await checkRobotsTxt(BASE_URL, url);
    if (!isAllowed) {
      console.log(`Scraping disallowed by robots.txt for URL: ${url}`);
      return null;
    }

    browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract product data
    const productData = await page.evaluate(() => {
      // Product name
      let name = '';
      const nameEl = document.querySelector('[data-testid="productTitle"]') ||
                    document.querySelector('h1') ||
                    document.querySelector('[data-testid="product-title"]');
      if (nameEl) {
        name = nameEl.textContent.trim();
      }

      // Description
      let description = '';
      const descEl = document.querySelector('[data-testid="productDescription"]') ||
                     document.querySelector('[data-testid="product-description"]') ||
                     document.querySelector('.product-description');
      if (descEl) {
        description = descEl.textContent.trim();
      }

      // Rating
      let rating = 0;
      const ratingEl = document.querySelector('[data-testid="product-rating"]') ||
                      document.querySelector('[data-testid="rating"]');
      if (ratingEl) {
        const ratingText = ratingEl.textContent.trim();
        const match = ratingText.match(/(\d+\.?\d*)/);
        if (match) rating = parseFloat(match[1]);
      }

      // Review count
      let reviewCount = 0;
      const reviewEl = document.querySelector('[data-testid="reviews-link"]') ||
                      document.querySelector('[data-testid="reviews-text"]');
      if (reviewEl) {
        const reviewText = reviewEl.textContent.trim();
        const match = reviewText.match(/(\d+)/);
        if (match) reviewCount = parseInt(match[1]);
      }

      // Pricing
      let pricing = {
        startingPrice: '',
        plans: []
      };
      
      // Get starting price
      const startingPriceEl = document.querySelector('[data-testid="starting-price"]');
      if (startingPriceEl) {
        const startingPriceText = startingPriceEl.textContent.trim();
        const match = startingPriceText.match(/\$[\d,]+\.?\d*/);
        if (match) {
          pricing.startingPrice = match[0];
        }
      }
      
      // Get pricing plans
      const pricingPlans = document.querySelectorAll('[data-testid="pricing-plans"]');
      if (pricingPlans.length > 0) {
        pricingPlans.forEach(plan => {
          const planName = plan.querySelector('p')?.textContent.trim();
          const planPrice = plan.querySelector('.text-4xl')?.textContent.trim();
          if (planName && planPrice) {
            pricing.plans.push({
              name: planName,
              price: planPrice
            });
          }
        });
      }
      
      // If no plans found, try to get from main pricing section
      if (pricing.plans.length === 0) {
        const pricingEl = document.querySelector('[data-testid="pricing"]') ||
                         document.querySelector('.pricing');
        if (pricingEl) {
          const pricingText = pricingEl.textContent.trim();
          if (pricingText) {
            pricing.startingPrice = pricingText;
          }
        }
      }

      // Logo
      let logoUrl = '';
      const logoEl = document.querySelector('[data-testid="productLogo"] img') ||
                    document.querySelector('[data-testid="product-logo"] img') ||
                    document.querySelector('img[alt*="logo"], img[alt*="Logo"]');
      if (logoEl) {
        logoUrl = logoEl.src;
      }

      // Features
      const features = [];
      // Look for features in the popular features and more features sections
      const popularFeatures = document.querySelectorAll('[data-testid="popularFeaturesContent"] span');
      const moreFeatures = document.querySelectorAll('[data-testid="moreFeaturesContent"] span');
      
      // Combine both feature sections
      const allFeatureEls = [...popularFeatures, ...moreFeatures];
      
      allFeatureEls.forEach(el => {
        const text = el.textContent.trim();
        if (text.length > 3 && !text.includes('See All') && !text.includes('StarComponent') && !text.includes('Popular features') && !text.includes('More features')) {
          features.push(text);
        }
      });

      // Vendor website
      let vendorWebsite = '';
      const websiteBtn = document.querySelector('[data-testid="headerVisitWebsiteBtn"]');
      if (websiteBtn) {
        vendorWebsite = websiteBtn.getAttribute('data-href') || '';
      }

      return {
        name,
        description,
        pricing,
        features,
        logo: logoUrl,
        vendor: {
          name: name, // SoftwareAdvice doesn't seem to have separate vendor names
          website: vendorWebsite
        },
        rating,
        reviewCount
      };
    });

    console.log('Extracted SoftwareAdvice product data:', {
      name: productData.name,
      rating: productData.rating,
      reviewCount: productData.reviewCount,
      featuresCount: productData.features.length,
      vendorWebsite: productData.vendor.website ? 'Found' : 'Not found',
      logo: productData.logo ? 'Found' : 'Not found'
    });

    // Add category to product data if provided
    if (categoryName) {
      productData.category = categoryName;
    }

    // Skip if no name found
    if (!productData.name) {
      console.log('No product name found, skipping...');
      await browser.close();
      return null;
    }

    // Skip error pages
    if (productData.name.toLowerCase().includes('oops') || productData.name.toLowerCase().includes('error')) {
      console.log('Skipping error page product:', productData.name);
      await browser.close();
      return null;
    }

    // Check if product already exists
    const existingProduct = await SoftwareAdviceProduct.findOne({ 
      name: { 
        $regex: new RegExp('^' + productData.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') 
      },
      category: categoryName 
    });

    if (existingProduct) {
      console.log(`Product "${productData.name}" already exists in category "${categoryName}". Skipping...`);
      await browser.close();
      return null;
    }

    await browser.close();
    return productData;

  } catch (error) {
    if (browser) await browser.close();
    console.error(`Error scraping SoftwareAdvice product page ${url}:`, error.message);
    return null;
  }
};

const scrapeSoftwareAdviceCategory = async (categoryUrl, categoryName = null, progress = null) => {
  try {
    const isAllowed = await checkRobotsTxt(BASE_URL, categoryUrl);
    if (!isAllowed) {
      console.log(`Scraping disallowed by robots.txt for category URL: ${categoryUrl}`);
      return [];
    }

    let allProducts = [];
    let currentPage = 1;
    let totalPages = 1;
    let hasMorePages = true;
    let basePageUrl = categoryUrl.replace(/\?.*$/, '');

    // Launch browser once for pagination detection
    const browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });
    await page.goto(categoryUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for product cards to load with fallback
    try {
      await page.waitForSelector('[data-testid="ProductCardComponent"]', { timeout: 10000 });
    } catch (error) {
      console.log('ProductCardComponent not found, trying alternative selectors...');
      // Try alternative selectors
      const hasProducts = await page.evaluate(() => {
        return document.querySelectorAll('[data-testid="ProductCardComponent"], .product-card, [class*="product"]').length > 0;
      });
      if (!hasProducts) {
        console.log('No product cards found on page');
        await browser.close();
        return [];
      }
    }

    // Detect total number of pages
    totalPages = await page.evaluate(() => {
      // Look for SoftwareAdvice pagination elements
      const paginationSection = document.querySelector('[data-testid="pagination-section"]');
      if (paginationSection) {
        // Get all pagination links
        const paginationLinks = paginationSection.querySelectorAll('a[href*="page="]');
        const pageNums = [];
        
        // Extract page numbers from href attributes
        paginationLinks.forEach(link => {
          const href = link.getAttribute('href');
          const match = href.match(/page=(\d+)/);
          if (match) {
            pageNums.push(parseInt(match[1]));
          }
        });
        
        // Also check the text content of pagination elements
        const paginationEls = document.querySelectorAll('[data-testid^="pagination-pages-"]');
        paginationEls.forEach(el => {
          const num = parseInt(el.textContent.trim());
          if (!isNaN(num)) {
            pageNums.push(num);
          }
        });
        
        if (pageNums.length > 0) {
          return Math.max(...pageNums);
        }
      }
      
      return 1; // Default to 1 page if no pagination found
    });
    console.log(`\n=== Starting to scrape SoftwareAdvice category: ${categoryName || categoryUrl} ===`);
    console.log(`Total pages detected: ${totalPages}`);
    await browser.close();
      
    // Scrape in batches of 5 pages
    while (currentPage <= totalPages) {
      const batchEnd = Math.min(currentPage + 4, totalPages);
      console.log(`\nScraping pages ${currentPage} to ${batchEnd} of ${totalPages}`);
      
      for (let pageNum = currentPage; pageNum <= batchEnd; pageNum++) {
        const pageUrl = pageNum === 1 ? basePageUrl : `${basePageUrl}?page=${pageNum}`;
        console.log(`\nProcessing page ${pageNum}/${totalPages}: ${pageUrl}`);
        
        const browser = await puppeteer.launch({ 
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for product cards with fallback
        try {
          await page.waitForSelector('[data-testid="ProductCardComponent"]', { timeout: 10000 });
        } catch (error) {
          console.log(`No ProductCardComponent found on page ${pageNum}, trying alternative selectors...`);
          const hasProducts = await page.evaluate(() => {
            return document.querySelectorAll('[data-testid="ProductCardComponent"], .product-card, [class*="product"]').length > 0;
          });
          if (!hasProducts) {
            console.log(`No product cards found on page ${pageNum}, skipping...`);
            await browser.close();
            continue;
          }
        }

        // Extract product links and names from product cards
        const { productLinks, extractedNames } = await page.evaluate((BASE_URL) => {
          const links = [];
          const names = [];
          
          // Find all product cards
          const productCards = document.querySelectorAll('[data-testid="ProductCardComponent"]');
          
          productCards.forEach(card => {
            // Get product title link
            const titleLink = card.querySelector('[data-testid="product-title"]');
            
            if (titleLink) {
              const href = titleLink.getAttribute('href');
              const name = titleLink.textContent.trim();
              
              if (href && name && !href.includes('#') && !href.includes('javascript:')) {
                const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                links.push(fullUrl);
                names.push(name);
              }
            }
          });

          return { 
            productLinks: [...new Set(links)],
            extractedNames: [...new Set(names)]
          };
        }, BASE_URL);

        await browser.close();
        console.log(`Found ${productLinks.length} product links on page ${pageNum}`);

        // Deduplicate product links and names together
        const seen = new Set();
        const uniqueLinks = [];
        const uniqueNames = [];
        for (let i = 0; i < productLinks.length; i++) {
          if (!seen.has(productLinks[i])) {
            seen.add(productLinks[i]);
            uniqueLinks.push(productLinks[i]);
            uniqueNames.push(extractedNames[i]);
          }
        }

        // Check existence of all products in this batch first
        const existingProducts = await SoftwareAdviceProduct.find({
          name: { $in: uniqueNames },
          category: categoryName
        }).select('name');

        const existingNames = new Set(existingProducts.map(p => p.name.toLowerCase()));

        // Filter out existing products, keeping indices in sync
        const filteredLinks = [];
        const filteredNames = [];
        for (let i = 0; i < uniqueLinks.length; i++) {
          if (!existingNames.has(uniqueNames[i].toLowerCase())) {
            filteredLinks.push(uniqueLinks[i]);
            filteredNames.push(uniqueNames[i]);
          }
        }

        if (filteredLinks.length === 0) {
          console.log('All products on this page already exist. Skipping page...');
          continue;
        }

        // Process only new products, strictly in order
        for (let i = 0; i < filteredLinks.length; i++) {
          const link = filteredLinks[i];
          const name = filteredNames[i];
          console.log(`Processing new SoftwareAdvice product ${i + 1}/${filteredLinks.length}: ${name}`);
          
          try {
            const product = await scrapeSoftwareAdviceProductPage(link, categoryName);
            if (product && product.name) {
              // Save the product
              const savedProduct = new SoftwareAdviceProduct({
                ...product,
                category: categoryName
              });
              await savedProduct.save();
              
              allProducts.push(product);
              console.log(`Successfully scraped SoftwareAdvice product: ${product.name}`);
              
              // Add delay between products
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          } catch (error) {
            console.error(`Error processing SoftwareAdvice product ${link}:`, error.message);
          }
        }

        // Update progress after each page
        if (progress) {
          progress.lastScrapedPage = pageNum;
          progress.totalPagesInCategory = totalPages;
          progress.lastUpdated = new Date();
          await progress.save();
          console.log(`Progress updated: Page ${pageNum}/${totalPages} completed`);
        }

        if (pageNum < batchEnd) {
          console.log('Waiting 3 seconds before next page...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      currentPage = batchEnd + 1;
      if (currentPage <= totalPages) {
        console.log('Batch complete. Waiting 1 minute before next batch...');
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }

    return allProducts;
  } catch (error) {
    console.error(`Error scraping SoftwareAdvice category ${categoryUrl}:`, error.message);
    return [];
  }
};

const scrapeAllSoftwareAdviceProducts = async () => {
  console.log('Starting to scrape all SoftwareAdvice products...');
  
  // Get progress
  let progress = await SoftwareAdviceProgress.findOne() || await SoftwareAdviceProgress.create({});
  
  // Get all categories from database
  const categories = await SoftwareAdviceCategory.find();
  
  let totalProductsScraped = 0;
  let startIndex = 0;
  let pageToStart = 1;

  // If we have a last scraped category, find its index and page
  if (progress.lastScrapedCategory) {
    startIndex = categories.findIndex(cat => cat.name === progress.lastScrapedCategory);
    if (startIndex === -1) startIndex = 0;
    pageToStart = progress.lastScrapedPage + 1;
  }

  for (let i = startIndex; i < categories.length; i++) {
    const category = categories[i];
    
    // Only update lastScrapedCategory when starting a new category
    if (progress.lastScrapedCategory !== category.name) {
      progress.lastScrapedCategory = category.name;
      progress.lastScrapedPage = 0;
      await progress.save();
      pageToStart = 1;
    }

    console.log(`\n=== Processing SoftwareAdvice category ${i + 1}/${categories.length}: ${category.name} ===`);
    console.log(`Resuming from page ${pageToStart}`);
    
    try {
      progress.lastUpdated = new Date();
      await progress.save();
      
      const products = await scrapeSoftwareAdviceCategory(category.url, category.name, progress);
      totalProductsScraped += products.length;
      
      // After finishing this category, reset pageToStart for next category
      progress.lastScrapedPage = 0;
      await progress.save();
      pageToStart = 1;
      
      console.log(`Completed SoftwareAdvice category: ${category.name} - ${products.length} products scraped`);
      
      // Add delay between categories
      if (i < categories.length - 1) {
        console.log('Waiting 10 seconds before next SoftwareAdvice category...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
    } catch (err) {
      console.error(`Error scraping products for SoftwareAdvice category ${category.name}:`, err);
      await progress.save();
      break;
    }
  }
  
  // Mark scraping as completed
  progress.isCompleted = true;
  progress.lastUpdated = new Date();
  await progress.save();
  
  console.log(`\n=== SOFTWAREADVICE SCRAPING COMPLETED ===`);
  console.log(`Total categories processed: ${categories.length}`);
  console.log(`Total products scraped: ${totalProductsScraped}`);
  
  return { categoriesProcessed: categories.length, totalProducts: totalProductsScraped };
};

module.exports = {
  scrapeSoftwareAdviceCategories,
  scrapeSoftwareAdviceProductPage,
  scrapeSoftwareAdviceCategory,
  scrapeAllSoftwareAdviceProducts
}; 