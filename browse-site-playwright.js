const { chromium } = require('playwright');
const fs = require('fs');

async function browseSite() {
  console.log('🚀 Launching browser...');

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  const results = {
    pages: [],
    forms: [],
    errors: []
  };

  // Create screenshots directory
  if (!fs.existsSync('screenshots')) {
    fs.mkdirSync('screenshots');
  }

  try {
    // 1. Visit homepage
    console.log('\n📍 Step 1: Visiting homepage...');
    await page.goto('https://signal-prime.com/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'screenshots/01-homepage.png', fullPage: true });
    console.log('📸 Screenshot saved: 01-homepage.png');

    // Extract homepage content
    const homepageContent = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        h1: Array.from(document.querySelectorAll('h1')).map(el => el.textContent.trim()),
        h2: Array.from(document.querySelectorAll('h2')).map(el => el.textContent.trim()),
        h3: Array.from(document.querySelectorAll('h3')).map(el => el.textContent.trim()),
        navLinks: Array.from(document.querySelectorAll('nav a, header a, [class*="nav"] a')).map(el => ({
          text: el.textContent.trim(),
          href: el.href
        })).filter(l => l.text && l.href),
        buttons: Array.from(document.querySelectorAll('button, [class*="btn"], [class*="cta"], a[class*="button"]')).map(el => ({
          text: el.textContent.trim(),
          href: el.href || null,
          classes: el.className
        })).filter(b => b.text),
        paragraphs: Array.from(document.querySelectorAll('p')).map(el => el.textContent.trim()).filter(t => t.length > 20),
        images: Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt
        })),
        forms: Array.from(document.querySelectorAll('form')).map((form, i) => ({
          index: i,
          action: form.action,
          fields: Array.from(form.querySelectorAll('input, select, textarea')).map(field => ({
            type: field.type || field.tagName.toLowerCase(),
            name: field.name,
            placeholder: field.placeholder,
            required: field.required
          }))
        })),
        fullText: document.body.innerText.substring(0, 8000)
      };
    });

    results.pages.push({ name: 'Homepage', ...homepageContent });
    console.log(`   Title: ${homepageContent.title}`);
    console.log(`   H1s: ${homepageContent.h1.join(', ') || 'none'}`);
    console.log(`   Nav links: ${homepageContent.navLinks.length}`);
    console.log(`   Buttons: ${homepageContent.buttons.length}`);
    console.log(`   Forms: ${homepageContent.forms.length}`);

    // 2. Look for and click primary CTA
    console.log('\n📍 Step 2: Looking for primary CTA...');
    const ctaSelectors = [
      'a[class*="cta"]',
      'button[class*="primary"]',
      'a[class*="primary"]',
      'a[class*="btn"]',
      '[class*="hero"] button',
      '[class*="hero"] a[href]'
    ];

    let ctaClicked = false;
    for (const selector of ctaSelectors) {
      const cta = await page.$(selector);
      if (cta) {
        const ctaText = await cta.textContent();
        const isVisible = await cta.isVisible();
        if (isVisible && ctaText && ctaText.trim()) {
          console.log(`   Found CTA: "${ctaText.trim()}" (${selector})`);
          try {
            await cta.click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: 'screenshots/02-after-cta.png', fullPage: true });
            console.log('📸 Screenshot saved: 02-after-cta.png');

            const afterCtaUrl = page.url();
            const afterCtaContent = await page.evaluate(() => ({
              title: document.title,
              fullText: document.body.innerText.substring(0, 5000)
            }));
            results.pages.push({ name: 'After CTA Click', url: afterCtaUrl, ...afterCtaContent });
            ctaClicked = true;
            break;
          } catch (e) {
            console.log(`   Could not click CTA: ${e.message}`);
          }
        }
      }
    }

    // 3. Check for modals/popups
    console.log('\n📍 Step 3: Checking for modals/popups...');
    const modalSelectors = ['[class*="modal"]', '[class*="popup"]', '[role="dialog"]', '[class*="overlay"]'];
    for (const selector of modalSelectors) {
      const modal = await page.$(selector);
      if (modal && await modal.isVisible()) {
        console.log(`   Found visible modal: ${selector}`);
        await page.screenshot({ path: 'screenshots/03-modal.png' });
        console.log('📸 Screenshot saved: 03-modal.png');
        break;
      }
    }

    // 4. Navigate to key pages
    console.log('\n📍 Step 4: Exploring navigation...');
    const navLinks = homepageContent.navLinks;
    const visitedUrls = new Set([homepageContent.url]);

    const pagesToVisit = ['contact', 'about', 'pricing', 'demo', 'features', 'solutions', 'product', 'how', 'why'];
    let pageNum = 4;

    for (const targetPage of pagesToVisit) {
      const link = navLinks.find(l =>
        l.text.toLowerCase().includes(targetPage) ||
        l.href.toLowerCase().includes(targetPage)
      );

      if (link && !visitedUrls.has(link.href)) {
        try {
          console.log(`\n   Visiting: ${link.text} (${link.href})`);
          await page.goto(link.href, { waitUntil: 'networkidle', timeout: 20000 });
          await page.waitForTimeout(1500);

          const screenshotName = `screenshots/0${pageNum}-${targetPage}.png`;
          await page.screenshot({ path: screenshotName, fullPage: true });
          console.log(`📸 Screenshot saved: 0${pageNum}-${targetPage}.png`);

          const pageContent = await page.evaluate(() => ({
            title: document.title,
            url: window.location.href,
            h1: Array.from(document.querySelectorAll('h1')).map(el => el.textContent.trim()),
            fullText: document.body.innerText.substring(0, 4000)
          }));

          results.pages.push({ name: link.text, ...pageContent });
          visitedUrls.add(link.href);
          pageNum++;
        } catch (e) {
          console.log(`   Error visiting ${targetPage}: ${e.message}`);
        }
      }
    }

    // 5. Find and analyze contact/demo forms
    console.log('\n📍 Step 5: Analyzing forms...');
    await page.goto('https://signal-prime.com/', { waitUntil: 'networkidle' });

    const allForms = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('form')).map((form, i) => ({
        index: i,
        action: form.action,
        method: form.method,
        id: form.id,
        classes: form.className,
        fields: Array.from(form.querySelectorAll('input, select, textarea')).map(field => ({
          tag: field.tagName.toLowerCase(),
          type: field.type,
          name: field.name,
          placeholder: field.placeholder,
          required: field.required,
          label: field.labels?.[0]?.textContent?.trim() || null
        })),
        submitButton: form.querySelector('button[type="submit"], input[type="submit"]')?.textContent?.trim() || null
      }));
    });

    results.forms = allForms;
    console.log(`   Found ${allForms.length} form(s)`);
    allForms.forEach((form, i) => {
      console.log(`   Form ${i + 1}: ${form.fields.length} fields, submit: "${form.submitButton}"`);
    });

    // 6. Mobile viewport check
    console.log('\n📍 Step 6: Mobile viewport check...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('https://signal-prime.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/99-mobile.png', fullPage: true });
    console.log('📸 Screenshot saved: 99-mobile.png');

  } catch (error) {
    console.error('❌ Error:', error.message);
    results.errors.push(error.message);
  }

  await browser.close();

  // Save results
  fs.writeFileSync('site-analysis.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Analysis complete!');
  console.log('📁 Results saved to: site-analysis.json');
  console.log('📁 Screenshots saved to: screenshots/');

  return results;
}

browseSite().then(results => {
  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`Pages analyzed: ${results.pages.length}`);
  console.log(`Forms found: ${results.forms.length}`);
  console.log(`Errors: ${results.errors.length}`);

  if (results.pages.length > 0) {
    console.log('\n📄 Pages visited:');
    results.pages.forEach(p => console.log(`   - ${p.name}: ${p.url || 'N/A'}`));
  }
}).catch(err => {
  console.error('Fatal error:', err);
});
