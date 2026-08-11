const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/?nocache=10');
    
    // Check if there are console errors
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    await page.waitForSelector('#btnHideUI');
    
    // Check classes before
    let isHidden = await page.$eval('#uiPanel', el => el.classList.contains('hidden'));
    console.log('Before click uiPanel hidden?', isHidden);
    
    await page.click('#btnHideUI');
    await page.waitForTimeout(500); // Wait for transition
    
    // Check classes after
    isHidden = await page.$eval('#uiPanel', el => el.classList.contains('hidden'));
    console.log('After click uiPanel hidden?', isHidden);
    
    await browser.close();
})();
