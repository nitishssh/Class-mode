import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("http://localhost:5001");

  const buttons = await page.$$("button");

  console.log(`Found ${buttons.length} buttons`);

  for (let i = 0; i < buttons.length; i++) {
    try {
      await buttons[i].click();
      console.log(`Button ${i + 1} clicked`);
      await page.waitForTimeout(1000);
    } catch (err) {
      console.log(`Button ${i + 1} failed`);
    }
  }

  await browser.close();
})();
