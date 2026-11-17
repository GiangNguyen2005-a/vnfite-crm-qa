import { test, expect } from "@playwright/test";
import fs from "node:fs";

const PAGES = [
  { id: "dashboard", url: "/dashboard", name: "Dashboard điều hành", wait: "text=Tổng quan" },
  { id: "khach-hang", url: "/khach-hang", name: "Danh sách khách hàng", wait: "table tbody tr:nth-child(3)" },
  { id: "nhan-khach", url: "/cskh/nhan-khach-hang", name: "Nhận khách hàng", wait: "table tbody tr:nth-child(3)" },
  { id: "khach-cua-toi", url: "/cskh/khach-hang-cua-toi", name: "Khách hàng của tôi", wait: "text=Khách hàng của tôi" },
  { id: "goi-dien", url: "/goi-dien", name: "Gọi điện", wait: "text=Gọi điện" },
  { id: "hoa-hong", url: "/hoa-hong", name: "Hoa hồng", wait: "text=Hoa hồng" },
  { id: "yeu-cau-nhan-khach", url: "/yeu-cau-nhan-khach", name: "Yêu cầu nhận khách", wait: "text=Yêu cầu nhận khách" },
  { id: "tong-dai", url: "/tong-dai", name: "Cấu hình tổng đài", wait: "text=Tổng đài" },
  { id: "kpi", url: "/hrm/quan-ly-kpi", name: "Quản lý KPI", wait: "text=KPI" },
];

fs.mkdirSync("screenshots", { recursive: true });
const results = [];

for (const p of PAGES) {
  test(`${p.id} — ${p.name}`, async ({ page }) => {
    const consoleErrors = [];
    const apiCalls = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
    });
    page.on("response", (r) => {
      if (r.url().includes("2345")) apiCalls.push(`${r.status()} ${r.url().replace("http://localhost:2345", "")}`);
    });

    const t0 = Date.now();
    await page.goto(p.url, { waitUntil: "domcontentloaded" });
    const paintMs = Date.now() - t0;

    let dataReady = true;
    try {
      await page.locator(p.wait).first().waitFor({ state: "visible", timeout: 20_000 });
    } catch {
      dataReady = false;
    }
    await page.waitForTimeout(1500); // chờ chart/ảnh vẽ xong
    const totalMs = Date.now() - t0;

    const rows = await page.locator("table tbody tr").count();
    const text = await page.locator("body").innerText();
    await page.screenshot({ path: `screenshots/${p.id}.png` });

    const failed = apiCalls.filter((c) => !c.startsWith("200") && !c.startsWith("201"));
    results.push({
      id: p.id, name: p.name, url: p.url, finalUrl: page.url(),
      loggedOut: page.url().includes("/login"), paintMs, totalMs, dataReady, rows,
      apiCalls: apiCalls.length, failedCalls: failed, consoleErrors,
      textHead: text.replace(/\s+/g, " ").slice(0, 300),
    });
    fs.writeFileSync("results.json", JSON.stringify(results, null, 2));

    expect(page.url().includes("/login"), `bị đẩy về /login ở ${p.url}`).toBe(false);
  });
}
