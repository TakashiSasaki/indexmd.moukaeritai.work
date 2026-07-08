const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err));
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // also check if there is an error boundary showing
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('BODY TEXT START:\n', bodyText.substring(0, 500));
  
  await browser.close();
})();

