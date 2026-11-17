const { chromium } = require("@playwright/test");
(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  const p = await b.newPage({ viewport: { width: 1500, height: 1980 }, deviceScaleFactor: 2 });
  await p.goto("http://127.0.0.1:9323", { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  // mở rộng toàn bộ danh sách ca để thấy đủ 26 dòng
  const all = p.getByText("Show all", { exact: false }).first();
  if (await all.count().catch(() => 0)) await all.click().catch(() => {});
  await p.waitForTimeout(1200);
  await p.screenshot({ path: require("path").join(__dirname, "results/report-full.png"), fullPage: false });
  await b.close();
})();
