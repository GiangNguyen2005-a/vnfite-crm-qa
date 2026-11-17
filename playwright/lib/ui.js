/**
 * Thao tác giao diện dùng lại ở nhiều spec: đăng nhập bằng token, mở menu, thu thập lỗi console.
 *
 * Cách đăng nhập: chèn sẵn auth-storage vào localStorage trước khi trang chạy.
 * Không đi qua form đăng nhập thật vì mỗi ca sẽ tốn thêm 2-4 giây và phụ thuộc giao diện form.
 * Riêng nhóm ca kiểm thử đăng nhập thì đi qua form thật (xem auth.spec.js).
 */
const { BASE_WEB, tokenOf } = require("./env");

const MENU_GROUPS = [
  "Khách hàng",
  "CSKH & Call Center",
  "Đội ngũ & Đối tác",
  "Hoa hồng",
  "Báo cáo & Phân tích",
  "Phân quyền",
  "Tổng đài"
];

async function loginAs(page, role, opts = {}) {
  const token = opts.token !== undefined ? opts.token : tokenOf(role);
  await page.addInitScript((tk) => {
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({ state: { accessToken: tk, refreshToken: null, isAuthenticated: true, account: null }, version: 0 })
    );
  }, token);
  const nav = page.goto(BASE_WEB + (opts.landing || "/dashboard"), { waitUntil: "domcontentloaded" });
  await page
    .waitForResponse((r) => r.url().includes("/permissions/me"), { timeout: opts.timeout || 45000 })
    .catch(() => null);
  await nav.catch(() => null);
  await page.waitForTimeout(opts.settle || 2000);
}

/** Mở hết các nhóm menu để đọc được toàn bộ mục, kể cả mục nằm trong nhóm thu gọn. */
async function expandMenu(page) {
  for (const g of MENU_GROUPS) {
    const el = page.getByText(g, { exact: true }).first();
    if (await el.count().catch(() => 0)) await el.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(400);
  return bodyText(page);
}

async function bodyText(page) {
  return page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " ").trim());
}

/** Đi tới một đường dẫn và chờ mạng lắng xuống, dùng cho các ca kiểm tra hiển thị. */
async function open(page, pathname, waitMs = 2500) {
  await page.goto(BASE_WEB + pathname, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(waitMs);
  return bodyText(page);
}

/** Thu lỗi console và các lời gọi API thất bại trong suốt một ca. */
function collectors(page) {
  const consoleErrors = [];
  const failedCalls = [];
  const calls = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
  });
  page.on("response", (r) => {
    const u = r.url();
    if (!u.includes(":2345")) return;
    const short = u.replace(/^https?:\/\/[^/]+/, "");
    calls.push(r.status() + " " + short);
    if (r.status() >= 400) failedCalls.push(r.status() + " " + short);
  });
  return { consoleErrors, failedCalls, calls };
}

/** Đếm số dòng dữ liệu đang hiện trong bảng đầu tiên của trang. */
async function rowCount(page) {
  return page.locator("table tbody tr").count().catch(() => 0);
}

module.exports = { MENU_GROUPS, loginAs, expandMenu, bodyText, open, collectors, rowCount };
