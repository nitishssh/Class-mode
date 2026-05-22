import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:5001/login");

  const boardStyles = await page.evaluate(() => {
    const el = document.querySelector(".bb-board");
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return {
      background: style.backgroundColor,
      border: style.border,
      boxShadow: style.boxShadow,
    };
  });

  const panelStyles = await page.evaluate(() => {
    const el = document.querySelector(".bb-board-panel");
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return {
      background: style.backgroundColor,
      border: style.border,
      boxShadow: style.boxShadow,
    };
  });

  console.log("board:", boardStyles);
  console.log("panel:", panelStyles);
  await browser.close();
})();
