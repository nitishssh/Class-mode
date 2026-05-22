import { chromium } from "playwright";
import fs from "fs";

async function runTest() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", (msg) => console.log("BROWSER LOG:", msg.text()));
  page.on("pageerror", (err) => console.error("BROWSER ERROR:", err.message));

  console.log("Navigating to http://127.0.0.1:5001...");
  try {
    await page.goto("http://127.0.0.1:5001", { waitUntil: "load", timeout: 60000 });

    // Wait for anything to appear in #root
    console.log("Waiting for #root to have content...");
    await page.waitForFunction(
      () => {
        const root = document.getElementById("root");
        return root && root.children.length > 0;
      },
      { timeout: 30000 }
    );

    console.log(`Page title: ${await page.title()}`);

    // Wait a bit for animations/content to settle
    await page.waitForTimeout(2000);

    // Take screenshot of landing page
    await page.screenshot({ path: "landing_page.png" });
    console.log("Landing page screenshot saved.");

    // Check if we are on landing or redirected to dashboard
    const url = page.url();
    console.log(`Current URL: ${url}`);

    if (url.includes("/login") || url.endsWith(":5001/")) {
      const getStartedBtn = page
        .locator(
          'button:has-text("Get My Plan"), button:has-text("Get Started"), button:has-text("Login")'
        )
        .first();

      if (await getStartedBtn.isVisible()) {
        console.log(`Found button: ${await getStartedBtn.innerText()}`);
        await getStartedBtn.click();
        await page.waitForLoadState("load");
        console.log(`Navigated to after click: ${page.url()}`);
        await page.screenshot({ path: "after_click.png" });
      } else {
        console.log("Primary buttons not visible. Printing all buttons:");
        const buttons = await page.locator("button").all();
        for (let i = 0; i < buttons.length; i++) {
          console.log(`Button ${i}: ${await buttons[i].innerText()}`);
        }
      }
    }
  } catch (e) {
    console.error(`Error during test: ${e}`);
    const content = await page.content();
    console.log("Page content snippet:", content.substring(0, 1000));
    await page.screenshot({ path: "error_state.png" });
  } finally {
    await browser.close();
  }
}

runTest().catch(console.error);
