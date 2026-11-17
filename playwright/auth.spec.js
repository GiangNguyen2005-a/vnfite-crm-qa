/**
 * Nhóm kiểm thử đăng nhập và vòng đời phiên.
 *
 * Khác các bộ còn lại: bộ này đi qua form thật, không chèn sẵn token. Lý do là các lỗi đăng
 * nhập chỉ xuất hiện ở đường đi thật — sai mật khẩu vẫn vào được, tải lại trang mất phiên,
 * đăng xuất không xoá token, token cũ dùng lại được.
 *
 * Tài khoản đọc từ biến môi trường, không viết trong mã:
 *   QA_USER=... QA_PASS=... npx playwright test auth.spec.js --project=chrome
 * Thiếu biến thì bỏ qua, không báo đạt.
 */
const { test, expect } = require("@playwright/test");
const { BASE_WEB, tokenOf, hasRole } = require("./lib/env");
const { api } = require("./lib/http");
const { append, make, shot } = require("./lib/result");

const SUITE = "auth";
const FILE = "auth-results.jsonl";
const USER = process.env.QA_USER || "";
const PASS = process.env.QA_PASS || "";

function record(tc, name, verdict, note, data, shots) {
  append(FILE, make({ suite: SUITE, tc, name, role: null, verdict, note, data, shots }));
}

/** Điền form đăng nhập. Tìm theo thuộc tính trước, theo kiểu ô sau, để không phụ thuộc thứ tự ô. */
async function fillLogin(page, user, pass) {
  const u =
    page.locator('input[name="username"], input[name="email"], input[type="email"], input[autocomplete="username"]').first();
  await u.waitFor({ state: "visible", timeout: 20000 });
  await u.fill(user);

  const pw = page.locator('input[type="password"]').first();
  await pw.fill(pass);

  const btn = page
    .locator('button[type="submit"], button:has-text("Đăng nhập"), button:has-text("Đăng Nhập")')
    .first();
  await btn.click();
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(3000);
}

async function stored(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("auth-storage");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return { raw: raw.slice(0, 120) };
    }
  });
}

test.describe("Đăng nhập", () => {
  test("TC-AU01 sai mật khẩu không vào được hệ thống", async ({ page }) => {
    test.skip(!USER, "Thiếu QA_USER — không chạy nhóm đăng nhập");

    await page.goto(BASE_WEB + "/login", { waitUntil: "domcontentloaded" });
    await fillLogin(page, USER, "mat-khau-sai-" + Date.now());
    const st = await stored(page);
    const token = st && st.state && st.state.accessToken;
    const body = await page.evaluate(() => document.body.innerText);

    const shots = [await shot(page, "TC-AU01")];
    record("TC-AU01", "sai mật khẩu không vào được", token ? "không đạt" : "đạt",
      token ? "vẫn ghi accessToken sau khi sai mật khẩu" : "không có token, trang còn ở form đăng nhập",
      { url: page.url(), co_token: Boolean(token), co_thong_bao: /sai|không đúng|invalid|thất bại/i.test(body) }, shots);

    expect(token, "sai mật khẩu vẫn tạo phiên").toBeFalsy();
  });

  test("TC-AU02 mật khẩu đúng vào được và lưu token", async ({ page }) => {
    test.skip(!USER || !PASS, "Thiếu QA_USER/QA_PASS");

    await page.goto(BASE_WEB + "/login", { waitUntil: "domcontentloaded" });
    await fillLogin(page, USER, PASS);
    const st = await stored(page);
    const token = st && st.state && st.state.accessToken;

    record("TC-AU02", "mật khẩu đúng tạo phiên", token ? "đạt" : "không đạt",
      token ? "có accessToken dài " + token.length + " ký tự" : "không thấy token sau khi đăng nhập",
      { url: page.url(), co_token: Boolean(token) });

    expect(token, "không có token sau khi đăng nhập đúng").toBeTruthy();
    expect(page.url(), "vẫn ở trang đăng nhập").not.toContain("/login");
  });

  test("TC-AU03 tải lại trang vẫn giữ phiên", async ({ page }) => {
    test.skip(!hasRole("admin"), "Cần token admin để kiểm phiên đã lưu");

    const token = tokenOf("admin");
    await page.goto(BASE_WEB + "/login", { waitUntil: "domcontentloaded" });
    await page.evaluate((tk) => {
      localStorage.setItem(
        "auth-storage",
        JSON.stringify({ state: { accessToken: tk, refreshToken: null, isAuthenticated: true, account: null }, version: 0 })
      );
    }, token);

    await page.goto(BASE_WEB + "/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const first = page.url();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const second = page.url();

    const stillIn = !/\/login/.test(second);
    record("TC-AU03", "tải lại trang không mất phiên", stillIn ? "đạt" : "không đạt",
      stillIn ? "ở lại " + second.replace(BASE_WEB, "") : "bị đẩy về trang đăng nhập sau khi tải lại",
      { truoc: first.replace(BASE_WEB, ""), sau: second.replace(BASE_WEB, "") });
    expect(stillIn, "tải lại trang làm mất phiên").toBe(true);
  });

  test("TC-AU04 đăng xuất xoá token khỏi trình duyệt", async ({ page }) => {
    test.skip(!hasRole("admin"), "Cần token admin");

    const token = tokenOf("admin");
    await page.addInitScript((tk) => {
      localStorage.setItem(
        "auth-storage",
        JSON.stringify({ state: { accessToken: tk, refreshToken: null, isAuthenticated: true, account: null }, version: 0 })
      );
    }, token);
    await page.goto(BASE_WEB + "/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    // Tìm nút đăng xuất theo chữ; bấm được thì kiểm tiếp, không thấy thì ghi rõ là không tìm thấy.
    const out = page.getByText(/đăng xuất|Đăng xuất|Đăng Xuất|logout/i).first();
    const found = await out.count().catch(() => 0);
    if (!found) {
      record("TC-AU04", "đăng xuất xoá token", "bỏ qua", "Không tìm thấy nút đăng xuất trên giao diện", {});
      test.skip(true, "Không tìm thấy nút đăng xuất");
      return;
    }

    await out.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const st = await stored(page);
    const left = st && st.state && st.state.accessToken;
    const shots = [await shot(page, "TC-AU04")];

    record("TC-AU04", "đăng xuất xoá token", left ? "không đạt" : "đạt",
      left ? "vẫn còn accessToken sau khi đăng xuất" : "token đã bị xoá", { co_token: Boolean(left) }, shots);
    expect(left, "đăng xuất không xoá token").toBeFalsy();
  });
});

test.describe("Phiên ở tầng API", () => {
  test("TC-AU05 gọi API không kèm token bị từ chối", async () => {
    const res = await api(null, "GET", "/customer/all", { query: { page: 1, limit: 1, app_code: "vnfite" } });
    record("TC-AU05", "không token bị từ chối", res.status === 401 ? "đạt" : "không đạt",
      "status " + res.status, { status: res.status });
    expect(res.status, "API không chặn yêu cầu thiếu token").toBe(401);
  });

  test("TC-AU06 token rác bị từ chối nhưng máy chủ không sập", async () => {
    const res = await api(null, "GET", "/customer/all", { token: "rac.rac.rac", query: { page: 1, limit: 1 } });
    const ok = res.status === 401 || res.status === 403;
    record("TC-AU06", "token rác bị từ chối", ok ? "đạt" : "không đạt",
      "status " + res.status, { status: res.status, ms: res.ms });
    expect(ok, "token rác trả " + res.status).toBe(true);
  });

  test("TC-AU07 token hợp lệ đọc được đúng thông tin tài khoản", async () => {
    test.skip(!hasRole("admin"), "Cần token admin");
    const res = await api("admin", "GET", "/user/getUserInfo");
    const j = res.json || {};
    const d = j.data || j;
    const hasIdentity = Boolean(d.username || d.email || d.id || d.fullName);
    record("TC-AU07", "token hợp lệ đọc được thông tin tài khoản", res.status === 200 && hasIdentity ? "đạt" : "không đạt",
      "status " + res.status, { status: res.status, truong: Object.keys(d).slice(0, 12) });
    expect(res.status).toBe(200);
    expect(hasIdentity, "không xác định được danh tính từ phản hồi").toBe(true);
  });

  test("TC-AU08 thời gian trả quyền của tài khoản dưới ngưỡng", async () => {
    test.skip(!hasRole("admin"), "Cần token admin");
    const res = await api("admin", "GET", "/permissions/me");
    // Ngưỡng 3 giây: endpoint này chạy ở mọi lần chuyển màn hình nên chậm ở đây là chậm toàn hệ thống.
    record("TC-AU08", "quyền tài khoản dưới 3 giây", res.ms < 3000 ? "đạt" : "không đạt",
      res.ms + " ms", { ms: res.ms, status: res.status });
    expect(res.status).toBe(200);
    expect(res.ms, "thời gian /permissions/me").toBeLessThan(3000);
  });
});
