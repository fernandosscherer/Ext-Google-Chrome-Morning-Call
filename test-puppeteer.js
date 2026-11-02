import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  // use file:// url to local popup.html
  const fileUrl = 'file://' + path.resolve('extension/popup.html');
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  await browser.close();
})();
