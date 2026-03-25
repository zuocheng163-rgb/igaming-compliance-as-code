const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto('http://localhost:5173');
    
    // Wait for the login form to appear
    await page.waitForSelector('button[type="submit"]');
    
    // Click the login button (username and token are already pre-filled with test01)
    await page.click('button[type="submit"]');
    
    // Wait for 2 seconds to let the react state settle and API call finish
    await new Promise(r => setTimeout(r, 2000));
    
    // Dump the html of the header
    const headerHtml = await page.evaluate(() => {
        const header = document.querySelector('header');
        return header ? header.outerHTML : "NO HEADER FOUND";
    });
    
    console.log("HEADER HTML AFTER LOGIN:");
    console.log(headerHtml);
    
    await browser.close();
})();
