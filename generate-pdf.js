const { chromium } = require('playwright');
const path = require('path');

async function generatePDF() {
  console.log('📄 Generating PDF report...');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const htmlPath = path.resolve(__dirname, 'signal-prime-analysis.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

  await page.pdf({
    path: 'Signal-Prime-UX-Analysis.pdf',
    format: 'A4',
    margin: {
      top: '20px',
      bottom: '20px',
      left: '20px',
      right: '20px'
    },
    printBackground: true
  });

  await browser.close();

  console.log('✅ PDF saved: Signal-Prime-UX-Analysis.pdf');
}

generatePDF();
