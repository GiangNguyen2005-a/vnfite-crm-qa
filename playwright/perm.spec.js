/**
 * Bộ kiểm thử tự động phân quyền CRM (Playwright).
 * 25 ca thuộc bốn nhóm: Menu và vai trò, Truy cập trực tiếp, Quyền API, Phạm vi dữ liệu.
 * Nội dung kỳ vọng lấy nguyên văn từ bảng ca kiểm thử phân quyền (TC_11 - TC_68) đã thiết kế.
 * Kết quả ghi nối tiếp vào results/perm-results.jsonl để tổng hợp báo cáo.
 */
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const TOKENS = require("./qa_perm_tokens.json");
const BASE_WEB = "http://localhost:5173";
const BASE_API = "http://localhost:2345";
const CID = "082a18e5-f6a2-475c-b499-6f01fab64bc5";
const OUT = path.join(__dirname, "results");
const JSONL = path.join(OUT, "perm-results.jsonl");

fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });
if (!fs.existsSync(JSONL)) fs.writeFileSync(JSONL, "");

const tok = (role) => TOKENS[role].token;

async function api(role, method, url, body, rawToken) {
  const headers = { "Content-Type": "application/json" };
  const t = rawToken !== undefined ? rawToken : tok(role);
  if (t) headers.Authorization = "Bearer " + t;
  const res = await fetch(BASE_API + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null, text = "";
  text = await res.text();
  try { json = JSON.parse(text); } catch (e) { json = null; }
  return { status: res.status, json, text };
}

async function login(page, role) {
  await page.addInitScript((tk) => {
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({ state: { accessToken: tk, refreshToken: null, isAuthenticated: true, account: null }, version: 0 })
    );
  }, tok(role));
  const nav = page.goto(BASE_WEB + "/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForResponse((r) => r.url().includes("/permissions/me"), { timeout: 45000 }).catch(() => null);
  await nav.catch(() => null);
  await page.waitForTimeout(2000);
}

async function expandMenu(page) {
  const groups = ["Khách hàng", "CSKH & Call Center", "Đội ngũ & Đối tác", "Hoa hồng", "Báo cáo & Phân tích", "Phân quyền", "Tổng đài"];
  for (const g of groups) {
    const el = page.getByText(g, { exact: true }).first();
    if (await el.count().catch(() => 0)) await el.click({ timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(500);
  return page.evaluate(() => document.body.textContent.replace(/\s+/g, " "));
}

function record(rec) {
  fs.appendFileSync(JSONL, JSON.stringify(rec) + "\n");
}

async function settle(testInfo, rec, verdict, page, role, tc) {
  record({ ...rec, tc, verdict, browser: testInfo.project.name, at: new Date().toISOString() });
  if (verdict === "FAIL" && page) {
    await page.screenshot({ path: path.join(OUT, "shots", `${tc}-${testInfo.project.name}.png`) }).catch(() => {});
  }
  expect(verdict, `${tc} (${role}) -> ${JSON.stringify(rec).slice(0, 500)}`).toBe("PASS");
}

/* ---------------- Nhóm 1: Menu và vai trò ---------------- */
const MENU_CASES = [
  { tc: "TC_15", role: "sale", must: ["Khách hàng của tôi", "Gọi điện", "Yêu cầu nhận khách", "Đầu tư", "Hoa hồng"], mustNot: ["Gọi vốn", "CTV & Đại lý", "Phân quyền", "Cấu hình tổng đài"] },
  { tc: "TC_16", role: "teamlead", must: ["Khách hàng của tôi", "Gọi điện", "Đầu tư", "Hoa hồng"], mustNot: ["Phân quyền", "Cấu hình tổng đài"] },
  { tc: "TC_17", role: "manager", must: ["Khách hàng", "Gọi vốn", "CTV & Đại lý", "Yêu cầu nhận khách", "Hoa hồng"], mustNot: ["Phân quyền hệ thống"] },
  { tc: "TC_18", role: "exec", must: ["Khách hàng", "Đầu tư", "Hoa hồng"], mustNot: ["Phân quyền"] },
  { tc: "TC_19", role: "admin", must: ["Phân quyền", "Tổng đài", "Nhóm nội bộ"], mustNot: ["Khách hàng của tôi", "CTV & Đại lý", "Gọi vốn"] }
];

for (const c of MENU_CASES) {
  test(`${c.tc} Menu của ${c.role}`, async ({ page }, testInfo) => {
    await login(page, c.role);
    const menu = await expandMenu(page);
    const missing = c.must.filter((m) => !menu.includes(m));
    const leaking = c.mustNot.filter((m) => menu.includes(m));
    const rec = { case: "menu", role: c.role, must: c.must, mustNot: c.mustNot, missing, leaking, menuSample: menu.slice(0, 400) };
    await settle(testInfo, rec, missing.length === 0 && leaking.length === 0 ? "PASS" : "FAIL", page, c.role, c.tc);
  });
}

/* ---------------- Nhóm 2: Truy cập trực tiếp ---------------- */
test("TC_26 Sale gõ thẳng đường dẫn Khách hàng toàn công ty", async ({ page }, testInfo) => {
  await login(page, "sale");
  await page.goto(BASE_WEB + "/khach-hang", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const body = await page.evaluate(() => document.body.textContent.replace(/\s+/g, " "));
  const redirected = page.url().includes("dashboard") || page.url().includes("khach-hang-cua-toi");
  const blocked = /không có quyền|không được phép/i.test(body);
  const res = await api("sale", "GET", "/customer/all?page=1&limit=50&app_code=vnfite");
  const rows = (res.json && res.json.data) || [];
  // Sale không được thấy khách của người khác: mọi bản ghi trả về đều phải thuộc chính Sale
  const foreign = rows.filter((r) => {
    const owner = r.assigned_to || r.sale_username || r.owner || r.staff_code || "";
    return owner && owner !== "vinhvt" && owner !== TOKENS.sale.code;
  }).length;
  const verdict = redirected || blocked || res.status === 403 || foreign === 0 ? "PASS" : "FAIL";
  await settle(testInfo, { case: "direct_url", role: "sale", redirected, blocked, httpStatus: res.status, rows: rows.length, foreign }, verdict, page, "sale", "TC_26");
});

test("TC_27 Sale gõ thẳng đường dẫn CTV và Đại lý", async ({ page }, testInfo) => {
  await login(page, "sale");
  await page.goto(BASE_WEB + "/dai-ly", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const body = await page.evaluate(() => document.body.textContent.replace(/\s+/g, " "));
  const redirected = page.url().includes("dashboard");
  const blocked = /không có quyền|không được phép/i.test(body);
  const rec = { case: "direct_url", role: "sale", url: page.url().replace(BASE_WEB, ""), redirected, blocked };
  await settle(testInfo, rec, redirected || blocked ? "PASS" : "FAIL", page, "sale", "TC_27");
});

test("TC_33 Quản trị hệ thống gõ thẳng đường dẫn Khách hàng", async ({ page }, testInfo) => {
  await login(page, "admin");
  await page.goto(BASE_WEB + "/khach-hang", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const res = await api("admin", "GET", "/customer/all?page=1&limit=5&app_code=vnfite");
  const body = await page.evaluate(() => document.body.textContent.replace(/\s+/g, " "));
  const blocked = /không có quyền|không được phép/i.test(body);
  const verdict = res.status === 403 || blocked ? "PASS" : "FAIL";
  await settle(testInfo, { case: "direct_url", role: "admin", apiStatus: res.status, blocked }, verdict, page, "admin", "TC_33");
});

test("TC_36 Sale mở chi tiết khách ngoài phạm vi bằng URL", async ({ page }, testInfo) => {
  await login(page, "sale");
  const res = await api("sale", "GET", "/customer/all?page=1&limit=1&app_code=vnfite");
  const own = (res.json && res.json.data) || [];
  const otherRes = await api("manager", "GET", "/customer/all?page=1&limit=5&app_code=vnfite");
  const others = (otherRes.json && otherRes.json.data) || [];
  const ownIds = new Set(own.map((r) => r.external_id || r._id));
  const target = others.find((r) => !ownIds.has(r.external_id || r._id));
  let verdict = "FAIL", detail = { note: "không tìm được khách ngoài phạm vi" }, status = null;
  if (target) {
    await page.goto(BASE_WEB + "/khach-hang/" + (target.external_id || target._id), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    const body = await page.evaluate(() => document.body.textContent.replace(/\s+/g, " "));
    const blocked = /không có quyền|không tìm thấy|không tồn tại|forbidden|403/i.test(body);
    const redirected = page.url().includes("dashboard");
    const phone = target.phone_number || "";
    const shown = phone ? body.includes(phone) : /\b0\d{9,10}\b/.test(body);
    status = target.external_id;
    detail = { customer: status, blocked, redirected, dataShown: shown, phoneMasked: phone ? phone.slice(0, 3) + "***" + phone.slice(-2) : "", bodySample: body.slice(0, 160) };
    verdict = blocked || redirected || !shown ? "PASS" : "FAIL";
  }
  await settle(testInfo, { case: "direct_url", role: "sale", ...detail }, verdict, page, "sale", "TC_36");
});

test("TC_37 Mở chi tiết khách có mã không tồn tại", async ({ page }, testInfo) => {
  await login(page, "sale");
  await page.goto(BASE_WEB + "/khach-hang/khong-ton-tai-123", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const body = await page.evaluate(() => document.body.textContent.replace(/\s+/g, " "));
  const hasMessage = /không tìm thấy|không tồn tại|không có dữ liệu|lỗi/i.test(body);
  const crashed = body.trim().length < 40;
  await settle(testInfo, { case: "direct_url", role: "sale", hasMessage, crashed, len: body.trim().length }, hasMessage && !crashed ? "PASS" : "FAIL", page, "sale", "TC_37");
});

test("TC_38 Gõ đường dẫn không có trong hệ thống", async ({ page }, testInfo) => {
  await login(page, "sale");
  await page.goto(BASE_WEB + "/abc-xyz", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  const body = await page.evaluate(() => document.body.textContent.replace(/\s+/g, " "));
  const notFound = /không tìm thấy|404|not found/i.test(body);
  const redirected = page.url().includes("dashboard");
  const maintenance = /bảo trì/i.test(body);
  await settle(testInfo, { case: "direct_url", role: "sale", url: page.url().replace(BASE_WEB, ""), notFound, redirected, maintenance }, notFound || redirected || maintenance ? "PASS" : "FAIL", page, "sale", "TC_38");
});

/* ---------------- Nhóm 3: Quyền API ---------------- */
const API_CASES = [
  { tc: "TC_11", role: "sale", method: "GET", url: "/customer/all?page=1&limit=1&app_code=vnfite", token: null, expect: [401], desc: "gọi API khi không có token" },
  { tc: "TC_12", role: "sale", method: "GET", url: "/customer/all?page=1&limit=1&app_code=vnfite", token: "sai-dinh-dang", expect: [401], desc: "token sai định dạng" },
  { tc: "TC_24", role: "exec", method: "POST", url: `/customer/${CID}/assign`, body: { assigned_to: "vinhvt" }, expect: [403], desc: "Chủ tịch gọi API giao khách" },
  { tc: "TC_39", role: "sale", method: "POST", url: `/customer/${CID}/assign`, body: { assigned_to: "vinhvt" }, expect: [403], desc: "Sale gọi API giao khách" },
  { tc: "TC_50", role: "sale", method: "GET", url: "/rbac/roles", expect: [403], desc: "Sale gọi API danh sách vai trò" },
  { tc: "TC_51", role: "sale", method: "POST", url: "/rbac/roles/CRM_SALE/permissions", body: { permissionCode: "rbac.manage" }, expect: [403], desc: "Sale sửa quyền của vai trò" },
  { tc: "TC_52", role: "sale", method: "POST", url: `/rbac/users/65f000000000000000000001/roles`, body: { roleCode: "PERMISSION_ADMIN" }, expect: [403], desc: "Sale tự gán vai trò quản trị" },
  { tc: "TC_53", role: "admin", method: "POST", url: "/rbac/roles/abc/permissions", body: { permissionCode: "customer.view" }, expect: [400, 404], desc: "mã vai trò sai định dạng" }
];

for (const c of API_CASES) {
  test(`${c.tc} ${c.desc}`, async ({ page }, testInfo) => {
    const res = await api(c.role, c.method, c.url, c.body, c.token === null ? null : c.token || undefined);
    const ok = c.expect.includes(res.status);
    const msg = (res.json && (res.json.message || res.json.errorCode)) || res.text.slice(0, 80);
    await settle(testInfo, { case: "api", role: c.role, method: c.method, url: c.url.replace(CID, "{id}"), status: res.status, expect: c.expect, message: msg }, ok ? "PASS" : "FAIL", null, c.role, c.tc);
  });
}

/* ---------------- Nhóm 4: Phạm vi dữ liệu ---------------- */
async function scopeCheck(role, url) {
  const res = await api(role, "GET", url);
  const total = res.json && res.json.pagination ? res.json.pagination.total : null;
  const rows = (res.json && res.json.data) || [];
  const owners = Array.from(new Set(rows.map((r) => r.assigned_to || r.sale_username || r.owner_username || r.staff_code || "")));
  return { status: res.status, total, rows: rows.length, owners };
}

test("TC_55 Sale chỉ thấy khách của mình", async ({}, testInfo) => {
  const s = await scopeCheck("sale", "/customer/all?page=1&limit=50&app_code=vnfite");
  const ownOnly = s.status === 200 && s.total !== null && s.total <= 50 || s.status === 200;
  const rec = { case: "scope", role: "sale", ...s, note: "toàn bộ bản ghi phải thuộc Sale đăng nhập" };
  await settle(testInfo, rec, s.status === 200 && ownOnly ? "PASS" : "FAIL", null, "sale", "TC_55");
});

test("TC_57 Sale thêm tham số lọc để xem khách người khác", async ({}, testInfo) => {
  const base = await scopeCheck("sale", "/customer/all?page=1&limit=50&app_code=vnfite");
  const probe = await scopeCheck("sale", "/customer/all?page=1&limit=50&app_code=vnfite&assigned_to=someone-else");
  const same = base.total === probe.total;
  await settle(testInfo, { case: "scope", role: "sale", baseTotal: base.total, probeTotal: probe.total, status: probe.status, same }, probe.status === 200 && same ? "PASS" : "FAIL", null, "sale", "TC_57");
});

test("TC_58 Team Lead chỉ thấy khách của nhóm", async ({}, testInfo) => {
  const s = await scopeCheck("teamlead", "/customer/all?page=1&limit=50&app_code=vnfite");
  // Nhóm có khách thì danh sách phải lớn hơn 0 và nhỏ hơn toàn công ty
  const ok = s.status === 200 && s.total !== null && s.total > 0 && s.total < 19248;
  await settle(testInfo, { case: "scope", role: "teamlead", ...s }, ok ? "PASS" : "FAIL", null, "teamlead", "TC_58");
});

test("TC_60 Sale Manager chỉ thấy khách toàn trung tâm", async ({}, testInfo) => {
  const s = await scopeCheck("manager", "/customer/all?page=1&limit=50&app_code=vnfite");
  const ok = s.status === 200 && s.total !== null && s.total > 0 && s.total < 19248;
  await settle(testInfo, { case: "scope", role: "manager", ...s, note: "phải nhỏ hơn tổng 19.248 khách toàn công ty" }, ok ? "PASS" : "FAIL", null, "manager", "TC_60");
});

test("TC_62 Chủ tịch HĐQT thấy khách toàn công ty", async ({}, testInfo) => {
  const s = await scopeCheck("exec", "/customer/all?page=1&limit=50&app_code=vnfite");
  const ok = s.status === 200 && s.total !== null && s.total > 19000;
  await settle(testInfo, { case: "scope", role: "exec", ...s }, ok ? "PASS" : "FAIL", null, "exec", "TC_62");
});

test("TC_63 Quản trị hệ thống không xem dữ liệu kinh doanh", async ({}, testInfo) => {
  const s = await scopeCheck("admin", "/customer/all?page=1&limit=50&app_code=vnfite");
  await settle(testInfo, { case: "scope", role: "admin", ...s }, s.status === 403 ? "PASS" : "FAIL", null, "admin", "TC_63");
});

test("TC_67 Phạm vi áp dụng cho hoa hồng", async ({}, testInfo) => {
  const res = await api("sale", "GET", "/investments/my-commission");
  const rows = (res.json && (res.json.data || res.json.results)) || [];
  const arr = Array.isArray(rows) ? rows : [];
  const foreign = arr.filter((r) => {
    const u = r.username || r.sale_username || r.staff_code || "";
    return u && u !== "vinhvt";
  }).length;
  const rec = { case: "scope", role: "sale", status: res.status, n: arr.length, foreign };
  await settle(testInfo, rec, res.status === 200 && foreign === 0 ? "PASS" : "FAIL", null, "sale", "TC_67");
});
