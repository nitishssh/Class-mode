import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("http://localhost:5001");

  const buttons = await page.$$("button");

  console.log(`Found ${buttons.length} buttons`);

  let idx = 1;
  for (const button of buttons) {
    try {
      await button.click();
      console.log(`Button ${idx} clicked`);
      await page.waitForTimeout(1000);
    } catch (err) {
      console.log(`Button ${idx} failed`);
    }
    idx++;
  }

  await browser.close();
})();
