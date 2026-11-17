const { chromium } = require("@playwright/test");
const fs = require("fs");
const TOKENS = require("./qa_perm_tokens.json");
const GROUPS = ["Khách hàng", "CSKH & Call Center", "Đội ngũ & Đối tác", "Hoa hồng", "Báo cáo & Phân tích", "Phân quyền", "Hệ thống", "Cấu hình"];

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const out = {};
  for (const role of ["admin", "sale", "teamlead", "manager", "exec"]) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await ctx.newPage();
    await page.addInitScript((tk) => {
      localStorage.setItem("auth-storage", JSON.stringify({ state: { accessToken: tk, refreshToken: null, isAuthenticated: true, account: null }, version: 0 }));
    }, TOKENS[role].token);
    const nav = page.goto("http://localhost:5173/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForResponse((r) => r.url().includes("/permissions/me"), { timeout: 40000 }).catch(() => null);
    await nav.catch(() => null);
    await page.waitForTimeout(2500);

    for (const g of GROUPS) {
      const el = page.getByText(g, { exact: true }).first();
      if (await el.count().catch(() => 0)) await el.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(800);
    const info = await page.evaluate(() => ({
      text: document.body.textContent.replace(/\s+/g, " ").slice(0, 2500),
      hrefs: Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href"))
    }));
    out[role] = info;
    await ctx.close();
  }
  fs.writeFileSync("menu-dump2.json", JSON.stringify(out, null, 1));
  await browser.close();
  for (const k of Object.keys(out)) console.log("== " + k + " ==\n" + out[k].text.slice(0, 900) + "\nHREFS: " + JSON.stringify(out[k].hrefs) + "\n");
})();
