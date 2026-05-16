const { chromium } = require('playwright');
const fs = require('fs');

async function completeFunnel() {
  console.log('🚀 Launching browser to complete the funnel...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');

  try {
    // Go to homepage
    await page.goto('https://signal-prime.com/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Step 1: Enter a domain
    console.log('\n📍 Step 1: Entering domain...');
    const domainInput = await page.$('input[type="text"], input[placeholder*="domain"], input');
    if (domainInput) {
      await domainInput.fill('nike.com');
      await page.waitForTimeout(500);
      console.log('   Entered: nike.com');
    }

    // Step 2: Select a spend range
    console.log('\n📍 Step 2: Selecting spend range...');
    const spendButtons = await page.$$('button:has-text("$")');
    console.log(`   Found ${spendButtons.length} spend buttons`);

    if (spendButtons.length > 0) {
      // Click the $100K-$200K option
      for (const btn of spendButtons) {
        const text = await btn.textContent();
        if (text.includes('$100K')) {
          await btn.click();
          console.log('   Selected: $100K-$200K');
          break;
        }
      }
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/funnel-01-filled.png', fullPage: true });
    console.log('📸 Screenshot: funnel-01-filled.png');

    // Step 3: Click the analyze button
    console.log('\n📍 Step 3: Clicking analyze button...');
    const analyzeBtn = await page.$('button:has-text("Analyze")');

    if (analyzeBtn) {
      const isDisabled = await analyzeBtn.evaluate(el => el.disabled || el.classList.contains('cursor-not-allowed'));
      console.log(`   Analyze button disabled: ${isDisabled}`);

      if (!isDisabled) {
        await analyzeBtn.click();
        console.log('   Clicked analyze button');

        // Wait for results or next step
        await page.waitForTimeout(5000);
        await page.screenshot({ path: 'screenshots/funnel-02-loading.png', fullPage: true });
        console.log('📸 Screenshot: funnel-02-loading.png');

        // Wait more for results
        await page.waitForTimeout(40000); // They said ~30-40 seconds
        await page.screenshot({ path: 'screenshots/funnel-03-results.png', fullPage: true });
        console.log('📸 Screenshot: funnel-03-results.png');

        // Extract results
        const resultsContent = await page.evaluate(() => ({
          url: window.location.href,
          title: document.title,
          fullText: document.body.innerText
        }));

        console.log('\n📊 Results page content:');
        console.log(resultsContent.fullText.substring(0, 2000));

        fs.writeFileSync('funnel-results.json', JSON.stringify(resultsContent, null, 2));
      } else {
        console.log('   Button is disabled - checking why...');

        // Check what's needed
        const formState = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input');
          return Array.from(inputs).map(i => ({
            value: i.value,
            placeholder: i.placeholder,
            name: i.name
          }));
        });
        console.log('   Form state:', JSON.stringify(formState, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'screenshots/funnel-error.png', fullPage: true });
  }

  await browser.close();
  console.log('\n✅ Funnel exploration complete!');
}

completeFunnel();
