/**
 * Kiểm thử khói: mở 9 màn hình chính, ghi lại thời gian dựng trang, số dòng dữ liệu,
 * các lời gọi API thất bại và lỗi console.
 *
 * Đây là bộ chạy đầu tiên sau mỗi lần triển khai lên môi trường kiểm thử: nếu bộ này không
 * qua thì các bộ khác không có nghĩa. Kết quả ghi vào results/smoke.json để so sánh giữa
 * các lần chạy, ảnh chụp vào results/screenshots/.
 *
 * Chạy: npx playwright test crm-smoke.spec.js --project=chrome
 */
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { loginAs, collectors } = require("./lib/ui");
const { hasRole } = require("./lib/env");

const OUT = path.join(__dirname, "results");
fs.mkdirSync(path.join(OUT, "screenshots"), { recursive: true });

const PAGES = [
  { id: "dashboard", url: "/dashboard", name: "Tổng quan", wait: "text=Tổng quan" },
  { id: "khach-hang", url: "/khach-hang", name: "Danh sách khách hàng", wait: "table tbody tr:nth-child(3)" },
  { id: "nhan-khach", url: "/cskh/nhan-khach-hang", name: "Nhận khách hàng", wait: "table tbody tr:nth-child(3)" },
  { id: "khach-cua-toi", url: "/cskh/khach-hang-cua-toi", name: "Khách hàng của tôi", wait: "text=Khách hàng của tôi" },
  { id: "goi-dien", url: "/goi-dien", name: "Gọi điện", wait: "text=Gọi điện" },
  { id: "hoa-hong", url: "/hoa-hong", name: "Hoa hồng", wait: "text=Hoa hồng" },
  { id: "yeu-cau-nhan-khach", url: "/yeu-cau-nhan-khach", name: "Yêu cầu nhận khách", wait: "text=Yêu cầu nhận khách" },
  { id: "tong-dai", url: "/tong-dai", name: "Cấu hình tổng đài", wait: "text=Tổng đài" },
  { id: "kpi", url: "/hrm/quan-ly-kpi", name: "Quản lý KPI", wait: "text=KPI" }
];

const results = [];

for (const p of PAGES) {
  test(`${p.id} — ${p.name}`, async ({ page }) => {
    test.skip(!hasRole("admin"), "Cần token admin trong qa_perm_tokens.json");
    await loginAs(page, "admin", { landing: p.url });
    const c = collectors(page);

    const t0 = Date.now();
    await page.goto(p.url, { waitUntil: "domcontentloaded" });
    const paintMs = Date.now() - t0;

    let dataReady = true;
    try {
      await page.locator(p.wait).first().waitFor({ state: "visible", timeout: 20000 });
    } catch (e) {
      dataReady = false;
    }
    // Chờ biểu đồ và ảnh vẽ xong; không có bước này thì số đo thấp hơn thực tế người dùng cảm nhận.
    await page.waitForTimeout(1500);
    const totalMs = Date.now() - t0;

    const rows = await page.locator("table tbody tr").count();
    const text = await page.locator("body").innerText();
    const shots = path.join(OUT, "screenshots", p.id + ".png");
    await page.screenshot({ path: shots, fullPage: false });

    results.push({
      id: p.id,
      name: p.name,
      url: p.url,
      finalUrl: page.url(),
      paintMs,
      totalMs,
      dataReady,
      rows,
      apiCalls: c.calls.length,
      failedCalls: c.failedCalls,
      consoleErrors: c.consoleErrors.slice(0, 5),
      textHead: text.replace(/\s+/g, " ").slice(0, 300)
    });
    fs.writeFileSync(path.join(OUT, "smoke.json"), JSON.stringify(results, null, 2));

    expect(page.url().includes("/login"), "bị đẩy về trang đăng nhập ở " + p.url).toBe(false);
    expect(dataReady, "dữ liệu không hiện sau 20 giây ở " + p.url).toBe(true);
  });
}
