const puppeteer = require('puppeteer');
const CapterraProduct = require('../models/CapterraProduct');
const { checkRobotsTxt } = require('../utils/robots');
const CapterraCategory = require('../models/CapterraCategory');
const CapterraProgress = require('../models/CapterraProgress');

const BASE_URL = 'https://www.capterra.com';

const scrapeProductPage = async (url, categoryName = null) => {
  let browser;
  try {
    console.log(`Starting to scrape product page: ${url}`);
    
    const isAllowed = await checkRobotsTxt(BASE_URL, url);
    if (!isAllowed) {
      console.log(`Scraping disallowed by robots.txt for URL: ${url}`);
      return null;
    }

    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Wait for main heading or a key element to ensure content is loaded
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Extract product data using robust selectors and fallbacks
    const productData = await page.evaluate(() => {
      // Helper: Known navigation/menu items to filter from features
      const navItems = [
        'Software Categories', 'Service Categories', 'FAQs', 'Blog & Research', 'Glossary', 'Write a Review', 'My Account', 'About Us', 'Careers', 'Press Page', 'Legal Terms', 'Privacy Policy', 'For Vendors', 'Vendor Login', 'Capterra Inc.', '1201 Wilson Blvd', 'Arlington, VA 22209', 'Email Us', 'Guides & Research', 'Who We Are', 'OKR Software', 'Browse All Categories'
      ];

      // Product name: Only use the first matching heading
      let name = '';
      const mainHeading = document.querySelector('h1.text-typo-70.font-bold.text-neutral-100') ||
                         document.querySelector('h1[data-testid="product-header-title"]') ||
                         document.querySelector('h1') ||
                         document.querySelector('h2.text-typo-50');
      if (mainHeading) {
        // Get the text content but handle special cases
        const headingContent = mainHeading.textContent.trim();
        
        // Remove unwanted text patterns
        name = headingContent
          .replace(/Features, Integrations, Pros & Cons/g, '')
          .replace(/Features, Integrations, Pros &amp; Cons/g, '')
          .replace(/: Software(?:\s+|$)/g, '')
          .replace(/\s*:\s*$/, '') // Remove trailing colon
          .replace(/(\w+)\s*:\s*\1/g, '$1') // Remove duplicated names separated by colon
          .replace(/\s+2025\s*$/g, '') // Remove year suffix
          .replace(/\s+2025\s*:/g, '') // Remove year suffix with colon
          .trim();
          
        // If no clean name found or if name is within a complex structure
        if (!name || mainHeading.querySelector('figure')) {
          // Try to find name in complex structure
          const productNameParts = Array.from(mainHeading.childNodes)
            .filter(node => {
              // Keep text nodes and exclude figure/img elements
              return (node.nodeType === 3 || // Text nodes
                    (node.nodeType === 1 && !['FIGURE', 'IMG'].includes(node.tagName))) &&
                    node.textContent.trim();
            })
            .map(node => node.textContent.trim())
            .join(' ')
            .replace(/Features, Integrations, Pros & Cons/g, '')
            .replace(/Features, Integrations, Pros &amp; Cons/g, '')
            .replace(/: Software(?:\s+|$)/g, '')
            .replace(/\s*:\s*$/, '')
            .replace(/(\w+)\s*:\s*\1/g, '$1')
            .replace(/\s+2025\s*$/g, '')
            .replace(/\s+2025\s*:/g, '')
            .replace(/\s+/g, ' ')
            .trim();
            
          if (productNameParts) {
            name = productNameParts;
          }
        }
      }

      // Description: Prefer <p class="line-clamp-4 whitespace-pre-wrap">, fallback to previous logic
      let description = '';
      const descP = document.querySelector('p.line-clamp-4.whitespace-pre-wrap');
      if (descP && descP.textContent && !descP.textContent.includes('25+ years helping businesses')) {
        description = descP.textContent.trim();
      }
      // Try to find the <h2> 'What is [ProductName]?' and get the next <p>
      if (!description) {
      const h2s = Array.from(document.querySelectorAll('article h2'));
      const whatIsH2 = h2s.find(h2 => h2.textContent.trim().toLowerCase().startsWith('what is '));
      if (whatIsH2) {
        let next = whatIsH2.nextElementSibling;
        while (next && next.tagName !== 'P') next = next.nextElementSibling;
        if (next && next.tagName === 'P') description = next.textContent.trim();
        }
      }
      // Fallback to previous logic if not found
      if (!description) {
        description = document.querySelector('p.text-neutral-99.text-md.pb-lg.max-w-7xl.font-sans')?.textContent?.trim() ||
                      document.querySelector('section[data-testid="product-summary"] p')?.textContent?.trim() ||
                      document.querySelector('section#about p')?.textContent?.trim() ||
                      document.querySelector('div[data-testid="description"]')?.textContent?.trim() ||
                      Array.from(document.querySelectorAll('p')).map(p => p.textContent.trim()).find(t => t.length > 30 && !t.includes('25+ years helping businesses')) ||
                      '';
      }

      // Pricing extraction for Capterra
      let pricing = {
        plans: []
      };
      const planCards = Array.from(document.querySelectorAll('div[id^="slider-card-pricing"], div.c1ofrhif'));
      planCards.forEach(card => {
        const planName = card.querySelector('span.font-semibold')?.textContent.trim();
        let planPrice = '';
        const priceSpan = card.querySelector('span.hbasb1j.font-semibold') || card.querySelector('span.font-semibold + div span.font-semibold');
        if (priceSpan) {
          planPrice = priceSpan.textContent.trim();
        } else {
          const altPrice = Array.from(card.querySelectorAll('span')).find(s => s.textContent.includes('$'));
          if (altPrice) planPrice = altPrice.textContent.trim();
        }
        if (planName && planPrice) {
          pricing.plans.push({ name: planName, price: planPrice });
        }
      });
      // Remove startingPrice fallback logic

      // Features: Prefer <span data-testid="dottedFeatureSpan">, fallback to previous logic
      let features = [];
      const featureSpans = Array.from(document.querySelectorAll('span[data-testid="dottedFeatureSpan"]'));
      if (featureSpans.length > 0) {
        features = featureSpans.map(span => span.textContent.trim()).filter(Boolean);
      } else {
      let featurePs = Array.from(document.querySelectorAll('div[data-testid="product-card-category-features"] p'));
      if (featurePs.length > 1) {
        features = featurePs.slice(1).map(p => p.textContent.trim());
      } else {
        features = Array.from(document.querySelectorAll('ul[data-testid="features-list"] li')).map(li => li.textContent.trim());
        if (features.length === 0) {
          features = Array.from(document.querySelectorAll('li')).map(li => li.textContent.trim()).filter(t => t.length > 3);
        }
      }
      // Filter out known nav/menu items and duplicates
      features = features.filter(f => f.length > 2 && !navItems.includes(f)).filter((f, i, arr) => arr.indexOf(f) === i);
      }

      // Vendor name
      const vendorName = document.querySelector('a[data-testid="vendor-link"]')?.textContent?.trim() ||
                         document.querySelector('div.vendor-name')?.textContent?.trim() ||
                         name;

      // Vendor website: Try to get from DOM, else fallback to Puppeteer click
      let vendorWebsite = '';
      // Try to get from data attributes (if any)
      const visitWebsiteBtn = document.querySelector('button[data-testid="visit-website-button"]');
      if (visitWebsiteBtn) {
        vendorWebsite = visitWebsiteBtn.getAttribute('data-href') ||
                        visitWebsiteBtn.getAttribute('data-url') || '';
      }
      // Fallback: look for <a> with "Visit website" text
      if (!vendorWebsite) {
        const altVendorLink = Array.from(document.querySelectorAll('a')).find(a => 
          a.href && a.href.startsWith('http') && 
          !a.href.includes('capterra.com') &&
          a.textContent.toLowerCase().includes('visit website')
        );
        if (altVendorLink) vendorWebsite = altVendorLink.href;
      }
      // Fallback: leave blank, will be filled by Puppeteer if needed

      // Product logo
      let logoUrl = '';
      const logoImg = document.querySelector('figure img[alt], a.thumbnail img[alt="product-logo"]');
      if (logoImg) {
        // Get the highest resolution image from srcset if available
        const srcset = logoImg.getAttribute('srcset');
        if (srcset) {
          const srcsetUrls = srcset.split(',')
            .map(s => s.trim().split(' ')[0])
            .filter(url => url);
          logoUrl = srcsetUrls[srcsetUrls.length - 1] || logoImg.src;
        } else {
          logoUrl = logoImg.src;
        }
      }

      // Public rating: Try multiple selectors and fallback to first float in text
      let rating = 0;
      let ratingEl = document.querySelector('span[data-testid="star-rating-value"]') ||
                     Array.from(document.querySelectorAll('div[aria-label*="Rating"], span.text-typo-20.text-neutral-99, span.star-rating-label')).find(el => el.textContent.match(/\d\.?\d?/));
      if (!ratingEl) {
        // Fallback: look for first float in any text
        ratingEl = Array.from(document.querySelectorAll('span, div')).find(el => el.textContent.match(/\d\.\d/));
      }
      if (ratingEl) {
        const match = ratingEl.textContent.match(/(\d\.\d)/);
        if (match) rating = parseFloat(match[1]);
      }

      // Number of reviews: Try multiple selectors and fallback to first number in parentheses
      let reviewCount = 0;
      let reviewCountEl = document.querySelector('span[data-testid="review-count"]') ||
                          Array.from(document.querySelectorAll('span.text-typo-20.text-neutral-99, span.star-rating-label')).find(el => el.textContent.match(/\(.*\)/));
      if (!reviewCountEl) {
        // Fallback: look for first number in parentheses in any text
        reviewCountEl = Array.from(document.querySelectorAll('span, div')).find(el => el.textContent.match(/\(\d+\)/));
      }
      if (reviewCountEl) {
        const match = reviewCountEl.textContent.replace(/,/g, '').match(/\((\d+)\)/);
        if (match) reviewCount = parseInt(match[1]);
      }

      return {
        name,
        description,
        pricing,
        features,
        logo: logoUrl,
        vendor: {
          name: vendorName,
          website: vendorWebsite
        },
        rating,
        reviewCount
      };
    });
    
    console.log('Extracted product data:', {
      name: productData.name,
      vendor: productData.vendor.name,
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

    // Skip error pages with 'Oops' in name or vendor
    if (
      productData.name && productData.name.toLowerCase().includes('oops') ||
      (productData.vendor && productData.vendor.name && productData.vendor.name.toLowerCase().includes('oops'))
    ) {
      console.log('Skipping error page product:', productData.name);
      await browser.close();
      return null;
    }

    // Check if product already exists before scraping
    const existingProduct = await CapterraProduct.findOne({ 
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

      // Filter out review pages and blank names
      if (!productData.name || productData.name.startsWith('Reviews of ')) {
        console.log('Skipping review or blank product:', productData.name);
        await browser.close();
        return null;
      }

      // Clean up vendor name to match product name
      if (productData.vendor && productData.vendor.name) {
        productData.vendor.name = productData.vendor.name
          .replace(/\s+2025\s*$/g, '')
          .replace(/\s+2025\s*:/g, '')
          .replace(/\s*:\s*$/, '')
          .replace(/(\w+)\s*:\s*\1/g, '$1')
          .trim();
      }

      // If vendor website is not found, try Puppeteer click to capture new tab
      if (!productData.vendor.website) {
        try {
          const [newPage] = await Promise.all([
            new Promise(resolve => browser.once('targetcreated', async target => {
              const newPage = await target.page();
              try {
                await newPage.waitForNavigation({timeout: 10000});
              } catch (e) {}
              resolve(newPage);
            })),
            page.click('button[data-testid="visit-website-button"]').catch(() => {})
          ]);
          if (newPage) {
            try {
              const newTabUrl = newPage.url();
              if (newTabUrl && newTabUrl.startsWith('http') && !newTabUrl.includes('capterra.com')) {
                productData.vendor.website = newTabUrl;
              }
            } catch (e) {}
            await newPage.close();
          }
        } catch (e) {
          console.log('Error capturing vendor website via Puppeteer click:', e.message);
        }
      }

    await browser.close();
    return productData;
  } catch (error) {
    if (browser) await browser.close();
    console.error(`Error scraping product page ${url}:`, error.message);
    return null;
  }
};

const scrapeCategory = async (categoryUrl, categoryName = null) => {
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
    await page.waitForSelector('a[href^="/p/"]', { timeout: 10000 });

    // Detect total number of pages
    totalPages = await page.evaluate(() => {
      // Try to get the total pages from the "current-page-display" div
      const pageDisplay = document.querySelector('div[data-test-id="current-page-display"]');
      if (pageDisplay) {
        const match = pageDisplay.textContent.match(/of\s+(\d+)/i);
        if (match) return parseInt(match[1]);
      }
      // Fallback: get max from visible page buttons
      const pageEls = Array.from(document.querySelectorAll('nav[aria-label="Pagination"] li button, nav[aria-label="Pagination"] li a'));
      const pageNums = pageEls.map(el => parseInt(el.textContent.trim())).filter(n => !isNaN(n));
      return pageNums.length > 0 ? Math.max(...pageNums) : 1;
    });
    console.log(`\n=== Starting to scrape category: ${categoryName || categoryUrl} ===`);
    console.log(`Total pages detected: ${totalPages}`);
      await browser.close();
      
    // Scrape in batches of 5 pages
    let allPagesSkipped = true;
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
        await page.waitForSelector('a[href^="/p/"]', { timeout: 10000 });

        // Extract product links and names
        const { productLinks, extractedNames } = await page.evaluate((BASE_URL) => {
          const links = [];
          const names = [];
          const learnMoreLinks = Array.from(document.querySelectorAll('a[data-trk-label="text-link_learn-more"]'));
          learnMoreLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('/p/') && !href.endsWith('/reviews/')) {
              const nameEl = link.querySelector('h2, h3') || link;
              const name = nameEl.textContent.trim()
                .replace(/Features, Integrations, Pros & Cons/g, '')
                .replace(/Features, Integrations, Pros &amp; Cons/g, '')
                .replace(/: Software(?:\s+|$)/g, '')
                .replace(/\s*:\s*$/, '')
                .replace(/(\w+)\s*:\s*\1/g, '$1')
                .replace(/\s+2025\s*$/g, '')
                .replace(/\s+2025\s*:/g, '')
                .trim();
              
              links.push(new URL(href, BASE_URL).href);
              names.push(name);
            }
          });
          if (links.length === 0) {
            const cardLinks = Array.from(document.querySelectorAll('div.pr-xl.justify-start > a[href^="/p/"], a[href^="/p/"]'));
            cardLinks.forEach(link => {
              const href = link.getAttribute('href');
              if (href && !href.endsWith('/reviews/')) {
                const nameEl = link.querySelector('h2, h3') || link;
                const name = nameEl.textContent.trim()
                  .replace(/Features, Integrations, Pros & Cons/g, '')
                  .replace(/Features, Integrations, Pros &amp; Cons/g, '')
                  .replace(/: Software(?:\s+|$)/g, '')
                  .replace(/\s*:\s*$/, '')
                  .replace(/(\w+)\s*:\s*\1/g, '$1')
                  .replace(/\s+2025\s*$/g, '')
                  .replace(/\s+2025\s*:/g, '')
                  .trim();
                
                links.push(new URL(href, BASE_URL).href);
                names.push(name);
              }
            });
          }
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
        const existingProducts = await Product.find({
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
          console.log(`Processing new product ${i + 1}/${filteredLinks.length}: ${link}`);
          const product = await scrapeProductPage(link, categoryName);
          if (product && product.name) {
            allProducts.push(product);
            console.log(`Successfully scraped: ${product.name}`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }

        // Update progress after each page
        progress.lastScrapedPage = pageNum;
        progress.totalPagesInCategory = totalPages;
        await progress.save();

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
    console.error(`Error scraping category ${categoryUrl}:`, error.message);
    return [];
  }
};

const scrapeCategories = async () => {
  const url = 'https://www.capterra.com/categories/';
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
  
  // Set a more realistic viewport
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Set user agent and additional headers
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  });
  
  console.log('Navigating to categories page...');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Add a small delay to ensure page is fully loaded
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Wait for initial content to load
  await page.waitForSelector('li[data-testid="group-list-item"]', { timeout: 10000 });
  
  console.log('Initial categories loaded, starting to scroll...');

  // Scroll to load all categories (lazy loading)
  let previousHeight = 0;
  let currentHeight = await page.evaluate(() => document.body.scrollHeight);
  let scrollAttempts = 0;
  const maxScrollAttempts = 20; // Prevent infinite scrolling
  
  while (previousHeight !== currentHeight && scrollAttempts < maxScrollAttempts) {
    previousHeight = currentHeight;
    
    // Scroll to bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    // Wait for new content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if new content was loaded
    currentHeight = await page.evaluate(() => document.body.scrollHeight);
    scrollAttempts++;
    
    console.log(`Scroll attempt ${scrollAttempts}: Height changed from ${previousHeight} to ${currentHeight}`);
  }
  
  console.log(`Finished scrolling after ${scrollAttempts} attempts`);

  // Extract categories using the current HTML structure
  const categories = await page.evaluate(() => {
    const cats = [];
    // Select all list items with data-testid="group-list-item"
    document.querySelectorAll('li[data-testid="group-list-item"]').forEach(li => {
      const a = li.querySelector('a');
      if (a) {
        const name = a.textContent.trim();
        const href = a.getAttribute('href');
        // Construct full URL if it's a relative path
        const url = href.startsWith('http') ? href : `https://www.capterra.com${href}`;
        cats.push({
          name: name,
          url: url
        });
      }
    });
    return cats;
  });
  
  console.log(`Extracted ${categories.length} categories from Capterra`);
  
  // Log the first and last categories to verify we got the full range
  if (categories.length > 0) {
    console.log(`First category: ${categories[0].name}`);
    console.log(`Last category: ${categories[categories.length - 1].name}`);
    
    // Check if we have categories starting with different letters
    const firstLetters = [...new Set(categories.map(cat => cat.name.charAt(0).toUpperCase()))].sort();
    console.log(`Categories found starting with letters: ${firstLetters.join(', ')}`);
  }
  
  await browser.close();

  // Upsert categories to database
  let savedCount = 0;
  let newCount = 0;
  let updatedCount = 0;
  
  for (const cat of categories) {
    try {
      const existingCategory = await CapterraCategory.findOne({ name: cat.name });
      const result = await CapterraCategory.findOneAndUpdate(
        { name: cat.name },
        cat,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      
      if (existingCategory) {
        updatedCount++;
      } else {
        newCount++;
        console.log(`New category saved: ${cat.name}`);
      }
      savedCount++;
    } catch (err) {
      console.error('Error upserting category:', cat.name, err);
    }
  }
  
  console.log(`\n=== DATABASE SUMMARY ===`);
  console.log(`Total categories processed: ${savedCount}`);
  console.log(`New categories added: ${newCount}`);
  console.log(`Existing categories updated: ${updatedCount}`);
  console.log(`Successfully saved ${savedCount} categories to database`);
  
  return categories;
};

const scrapeAllCategoryProducts = async () => {
  console.log('Starting to scrape products from all categories...');
  
  // Get scraping progress
  let progress = await CapterraProgress.findOne() || await CapterraProgress.create({});
  
  // Get all categories from database
  const categories = await CapterraCategory.find();
  
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

    console.log(`\n=== Processing category ${i + 1}/${categories.length}: ${category.name} ===`);
    console.log(`Resuming from page ${pageToStart}`);
    
    try {
      progress.lastUpdated = new Date();
      await progress.save();
      
      // Scrape category with page tracking, starting from pageToStart-1 (since scrapeCategoryWithProgress expects lastScrapedPage)
      const products = await scrapeCategoryWithProgress(
        category.url, 
        category.name, 
        pageToStart - 1
      );
      totalProductsScraped += products.length;
      
      // After finishing all pages in this category, reset pageToStart for next category
      progress.lastScrapedPage = 0;
      await progress.save();
      pageToStart = 1;
      
      console.log(`Completed category: ${category.name} - ${products.length} products scraped`);
      
      // Add delay between categories to avoid being blocked
      if (i < categories.length - 1) {
        console.log('Waiting 10 seconds before next category...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
    } catch (err) {
      console.error(`Error scraping products for category ${category.name}:`, err);
      // Save progress even if there's an error
      await progress.save();
      // If error, break to allow proper resume
      break;
    }
  }
  
  // Mark scraping as completed
  progress.isCompleted = true;
  progress.lastUpdated = new Date();
  await progress.save();
  
  console.log(`\n=== SCRAPING COMPLETED ===`);
  console.log(`Total categories processed: ${categories.length}`);
  console.log(`Total products scraped: ${totalProductsScraped}`);
  
  return { categoriesProcessed: categories.length, totalProducts: totalProductsScraped };
};

// New function to scrape category with progress tracking
const scrapeCategoryWithProgress = async (categoryUrl, categoryName, startPage = 0) => {
  try {
    const isAllowed = await checkRobotsTxt(BASE_URL, categoryUrl);
    if (!isAllowed) {
      console.log(`Scraping disallowed by robots.txt for category URL: ${categoryUrl}`);
      return [];
    }

    let allProducts = [];
    let currentPage = startPage + 1;
    let totalPages = 1;
    let basePageUrl = categoryUrl.replace(/\?.*$/, '');

    // Get progress tracker
    let progress = await CapterraProgress.findOne() || await CapterraProgress.create({});

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
    await page.waitForSelector('a[href^="/p/"]', { timeout: 10000 });

    // Detect total number of pages
    totalPages = await page.evaluate(() => {
      // Try to get the total pages from the "current-page-display" div
      const pageDisplay = document.querySelector('div[data-test-id="current-page-display"]');
      if (pageDisplay) {
        const match = pageDisplay.textContent.match(/of\s+(\d+)/i);
        if (match) return parseInt(match[1]);
      }
      // Fallback: get max from visible page buttons
      const pageEls = Array.from(document.querySelectorAll('nav[aria-label="Pagination"] li button, nav[aria-label="Pagination"] li a'));
      const pageNums = pageEls.map(el => parseInt(el.textContent.trim())).filter(n => !isNaN(n));
      return pageNums.length > 0 ? Math.max(...pageNums) : 1;
    });

    await browser.close();
    console.log(`Total pages detected: ${totalPages}`);

    // Scrape in batches of 5 pages
    let allPagesSkipped = true;
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
        await page.waitForSelector('a[href^="/p/"]', { timeout: 10000 });

        // Extract product links and names
        const { productLinks, extractedNames } = await page.evaluate((BASE_URL) => {
          const links = [];
          const names = [];
          const learnMoreLinks = Array.from(document.querySelectorAll('a[data-trk-label="text-link_learn-more"]'));
          learnMoreLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('/p/') && !href.endsWith('/reviews/')) {
              const nameEl = link.querySelector('h2, h3') || link;
              const name = nameEl.textContent.trim()
                .replace(/Features, Integrations, Pros & Cons/g, '')
                .replace(/Features, Integrations, Pros &amp; Cons/g, '')
                .replace(/: Software(?:\s+|$)/g, '')
                .replace(/\s*:\s*$/, '')
                .replace(/(\w+)\s*:\s*\1/g, '$1')
                .replace(/\s+2025\s*$/g, '')
                .replace(/\s+2025\s*:/g, '')
                .trim();
              
              links.push(new URL(href, BASE_URL).href);
              names.push(name);
            }
          });
          if (links.length === 0) {
            const cardLinks = Array.from(document.querySelectorAll('div.pr-xl.justify-start > a[href^="/p/"], a[href^="/p/"]'));
            cardLinks.forEach(link => {
              const href = link.getAttribute('href');
              if (href && !href.endsWith('/reviews/')) {
                const nameEl = link.querySelector('h2, h3') || link;
                const name = nameEl.textContent.trim()
                  .replace(/Features, Integrations, Pros & Cons/g, '')
                  .replace(/Features, Integrations, Pros &amp; Cons/g, '')
                  .replace(/: Software(?:\s+|$)/g, '')
                  .replace(/\s*:\s*$/, '')
                  .replace(/(\w+)\s*:\s*\1/g, '$1')
                  .replace(/\s+2025\s*$/g, '')
                  .replace(/\s+2025\s*:/g, '')
                  .trim();
                
                links.push(new URL(href, BASE_URL).href);
                names.push(name);
              }
            });
          }
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
        const existingProducts = await CapterraProduct.find({
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
          } else {
            console.log(`Product "${uniqueNames[i]}" already exists in category "${categoryName}". Skipping...`);
          }
        }

        if (filteredLinks.length === 0) {
          console.log('All products on this page already exist. Skipping page...');
          // Update progress even when skipping
          progress.lastScrapedPage = pageNum;
          progress.totalPagesInCategory = totalPages;
          await progress.save();
          continue;
        }

        // Process only new products, strictly in order
        for (let i = 0; i < filteredLinks.length; i++) {
          const link = filteredLinks[i];
          const name = filteredNames[i];
          console.log(`Processing new product ${i + 1}/${filteredLinks.length}: ${link}`);
          
          try {
            // Check one more time before scraping to prevent race conditions
            const existingProduct = await CapterraProduct.findOne({
              name: name,
              category: categoryName
            });
            
            if (existingProduct) {
              console.log(`Product "${name}" already exists in category "${categoryName}". Skipping...`);
              continue;
            }
            
          const product = await scrapeProductPage(link, categoryName);
          if (product && product.name) {
              // Final check before saving to prevent duplicates
              const finalCheck = await CapterraProduct.findOne({
                name: product.name,
                category: categoryName
              });
              
              if (finalCheck) {
                console.log(`Product "${product.name}" already exists in category "${categoryName}". Skipping...`);
                continue;
              }
              
              // Save the product with proper error handling
              try {
                const savedProduct = new CapterraProduct({
                  ...product,
                  category: categoryName
                });
                await savedProduct.save();
                
            allProducts.push(product);
            console.log(`Successfully scraped: ${product.name}`);
              } catch (saveError) {
                if (saveError.code === 11000) {
                  // Duplicate key error - product was saved by another process
                  console.log(`Product "${product.name}" was already saved by another process. Skipping...`);
                } else {
                  console.error(`Error saving product ${product.name}:`, saveError.message);
                }
              }
              
            await new Promise(resolve => setTimeout(resolve, 3000));
            }
          } catch (error) {
            console.error(`Error scraping product ${link}:`, error.message);
            // Continue with next product even if one fails
          }
        }

        // Update progress after each page
        progress.lastScrapedPage = pageNum;
        progress.totalPagesInCategory = totalPages;
        await progress.save();

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
    console.error(`Error scraping category ${categoryUrl}:`, error.message);
    return [];
  }
};

module.exports = {
  scrapeProductPage,
  scrapeCategory,
  scrapeCategories,
  scrapeAllCategoryProducts
}; 