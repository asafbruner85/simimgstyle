const puppeteer = require('puppeteer');
const fs = require('fs');

async function browseSite() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const results = {
    pages: [],
    errors: []
  };

  try {
    // 1. Visit homepage
    console.log('📍 Visiting homepage...');
    await page.goto('https://signal-prime.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await page.waitForTimeout(2000); // Extra time for animations

    // Screenshot homepage
    await page.screenshot({ path: 'screenshots/01-homepage.png', fullPage: true });
    console.log('📸 Screenshot: homepage');

    // Extract homepage content
    const homepageContent = await page.evaluate(() => {
      return {
        title: document.title,
        h1: Array.from(document.querySelectorAll('h1')).map(el => el.textContent.trim()),
        h2: Array.from(document.querySelectorAll('h2')).map(el => el.textContent.trim()),
        buttons: Array.from(document.querySelectorAll('button, a[class*="btn"], a[class*="cta"], [role="button"]')).map(el => ({
          text: el.textContent.trim(),
          href: el.href || null
        })),
        links: Array.from(document.querySelectorAll('nav a, header a')).map(el => ({
          text: el.textContent.trim(),
          href: el.href
        })),
        forms: Array.from(document.querySelectorAll('form')).map(form => ({
          inputs: Array.from(form.querySelectorAll('input, select, textarea')).map(input => ({
            type: input.type,
            name: input.name,
            placeholder: input.placeholder
          }))
        })),
        paragraphs: Array.from(document.querySelectorAll('p')).slice(0, 10).map(el => el.textContent.trim()),
        bodyText: document.body.innerText.substring(0, 5000)
      };
    });

    results.pages.push({
      name: 'Homepage',
      url: page.url(),
      content: homepageContent
    });

    // 2. Find and click main CTA or navigation items
    const navLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('nav a, header a, a[class*="nav"]')).map(a => ({
        text: a.textContent.trim(),
        href: a.href
      })).filter(l => l.href && !l.href.includes('#') && l.text);
    });

    console.log('🔗 Found navigation links:', navLinks.map(l => l.text).join(', '));

    // 3. Look for primary CTA button
    const ctaButton = await page.$('button[class*="primary"], a[class*="cta"], a[class*="btn-primary"], button:not([type="submit"])');
    if (ctaButton) {
      const ctaText = await ctaButton.evaluate(el => el.textContent.trim());
      console.log('🎯 Found CTA button:', ctaText);

      await ctaButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/02-after-cta-click.png', fullPage: true });
      console.log('📸 Screenshot: after CTA click');

      const afterCtaContent = await page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 3000)
      }));

      results.pages.push({
        name: 'After CTA Click',
        url: afterCtaContent.url,
        content: afterCtaContent
      });
    }

    // 4. Check for any modals or popups
    const modal = await page.$('[class*="modal"], [class*="popup"], [role="dialog"]');
    if (modal) {
      console.log('📦 Modal/popup detected');
      await page.screenshot({ path: 'screenshots/03-modal.png' });
    }

    // 5. Visit a few key pages if navigation exists
    const pagesToVisit = ['contact', 'about', 'pricing', 'demo', 'features', 'solutions'];
    for (const pageName of pagesToVisit) {
      const link = navLinks.find(l => l.text.toLowerCase().includes(pageName) || l.href.toLowerCase().includes(pageName));
      if (link) {
        console.log(`📍 Visiting ${pageName} page...`);
        await page.goto(link.href, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `screenshots/04-${pageName}.png`, fullPage: true });

        const pageContent = await page.evaluate(() => ({
          title: document.title,
          bodyText: document.body.innerText.substring(0, 3000)
        }));

        results.pages.push({
          name: pageName,
          url: page.url(),
          content: pageContent
        });
      }
    }

    // 6. Look for forms and document them
    await page.goto('https://signal-prime.com/', { waitUntil: 'networkidle2' });
    const forms = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('form')).map((form, i) => ({
        index: i,
        action: form.action,
        method: form.method,
        fields: Array.from(form.querySelectorAll('input, select, textarea')).map(field => ({
          tag: field.tagName.toLowerCase(),
          type: field.type,
          name: field.name,
          placeholder: field.placeholder,
          required: field.required
        }))
      }));
    });

    results.forms = forms;
    console.log(`📝 Found ${forms.length} form(s)`);

  } catch (error) {
    console.error('Error:', error.message);
    results.errors.push(error.message);
  }

  await browser.close();

  // Save results
  fs.writeFileSync('site-analysis.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Analysis complete! Results saved to site-analysis.json');

  return results;
}

// Create screenshots directory
if (!fs.existsSync('screenshots')) {
  fs.mkdirSync('screenshots');
}

browseSite().then(results => {
  console.log('\n📊 Summary:');
  console.log(`- Pages analyzed: ${results.pages.length}`);
  console.log(`- Forms found: ${results.forms?.length || 0}`);
  console.log(`- Errors: ${results.errors.length}`);
});
