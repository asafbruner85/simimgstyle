const { chromium } = require('playwright');
const fs = require('fs');

async function getResults() {
  console.log('🚀 Getting final results page...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');

  try {
    await page.goto('https://signal-prime.com/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Fill form
    const domainInput = await page.$('input');
    if (domainInput) await domainInput.fill('nike.com');

    // Select spend
    const spendBtn = await page.$('button:has-text("$100K–$200K")');
    if (spendBtn) await spendBtn.click();

    await page.waitForTimeout(500);

    // Click analyze
    const analyzeBtn = await page.$('button:has-text("Analyze")');
    if (analyzeBtn) await analyzeBtn.click();

    console.log('⏳ Waiting for analysis to complete (60s)...');
    await page.waitForTimeout(60000);

    await page.screenshot({ path: 'screenshots/results-final.png', fullPage: true });
    console.log('📸 Screenshot: results-final.png');

    // Try to scroll and capture more
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/results-scrolled.png', fullPage: true });
    console.log('📸 Screenshot: results-scrolled.png');

    // Get all text
    const content = await page.evaluate(() => document.body.innerText);
    console.log('\n📄 Page content:\n', content);

    fs.writeFileSync('final-results.txt', content);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  await browser.close();
}

getResults();
