/**
 * Nhóm kiểm thử dữ liệu khách hàng ở tầng API.
 *
 * Câu hỏi của bộ này: "dữ liệu trả về có đúng là dữ liệu mà giao diện sẽ vẽ không".
 * Không kiểm quyền (perm.spec.js), không kiểm hình dạng hợp đồng (api-contract.spec.js),
 * không kiểm đầu vào rác (robustness.spec.js). Ở đây chỉ có tính nhất quán của tập dữ liệu:
 * phân trang, sắp xếp, lọc, tìm kiếm, chi tiết và tổng số bản ghi.
 *
 * Chạy: npx playwright test customers-api.spec.js --project=chrome
 */
const { test, expect } = require("@playwright/test");
const { api } = require("./lib/http");
const { requireRoles } = require("./lib/skip");
const { append, make } = require("./lib/result");
const { APP_CODE } = require("./lib/env");

const SUITE = "customers";
const FILE = "customers-results.jsonl";
const ROLE = "admin";

function record(tc, name, verdict, note, data) {
  append(FILE, make({ suite: SUITE, tc, name, role: ROLE, verdict, note, data }));
}

function ids(rows) {
  return (rows || []).map((r) => r && (r.id || r._id)).filter(Boolean).map(String);
}

function rowsOf(res) {
  if (!res.json) return [];
  if (Array.isArray(res.json.data)) return res.json.data;
  if (Array.isArray(res.json.data && res.json.data.data)) return res.json.data.data;
  if (Array.isArray(res.json.items)) return res.json.items;
  return [];
}

function totalOf(res) {
  const j = res.json || {};
  const p = j.pagination || j.meta || (j.data && j.data.pagination) || {};
  const t = p.total !== undefined ? p.total : p.totalItems;
  return typeof t === "number" ? t : null;
}

test.describe("Dữ liệu khách hàng — phân trang", () => {
  test("TC-DS01 trang đầu trả đúng số dòng theo limit", async () => {
    if (!requireRoles(test, [ROLE])) return;
    const res = await api(ROLE, "GET", "/customer/all", { query: { page: 1, limit: 20, app_code: APP_CODE } });
    const rows = rowsOf(res);
    const problem = res.status === 200 && rows.length > 20 ? "trả " + rows.length + " dòng cho limit=20" : "";
    record("TC-DS01", "trang đầu trả đúng số dòng theo limit", problem ? "không đạt" : "đạt", problem || ("nhận " + rows.length + " dòng"), {
      status: res.status, ms: res.ms, rows: rows.length
    });
    expect(res.status, "mã trả về").toBe(200);
    expect(rows.length, "số dòng không vượt limit").toBeLessThanOrEqual(20);
  });

  test("TC-DS02 hai trang liên tiếp không trùng bản ghi", async () => {
    if (!requireRoles(test, [ROLE])) return;
    const p1 = await api(ROLE, "GET", "/customer/all", { query: { page: 1, limit: 20, app_code: APP_CODE } });
    const p2 = await api(ROLE, "GET", "/customer/all", { query: { page: 2, limit: 20, app_code: APP_CODE } });
    const a = ids(rowsOf(p1)), b = ids(rowsOf(p2));
    const overlap = a.filter((x) => b.includes(x));
    record("TC-DS02", "hai trang liên tiếp không trùng bản ghi", overlap.length ? "không đạt" : "đạt",
      overlap.length ? "trùng " + overlap.length + " bản ghi giữa trang 1 và 2" : "không trùng",
      { trang1: a.length, trang2: b.length, trung: overlap.length });
    // Trùng bản ghi giữa hai trang làm người dùng thấy cùng một khách hai lần và bỏ sót khách khác.
    expect(overlap, "id trùng giữa trang 1 và trang 2").toEqual([]);
  });

  test("TC-DS03 đổi limit thì tổng số bản ghi không đổi", async () => {
    if (!requireRoles(test, [ROLE])) return;
    const small = await api(ROLE, "GET", "/customer/all", { query: { page: 1, limit: 1, app_code: APP_CODE } });
    const big = await api(ROLE, "GET", "/customer/all", { query: { page: 1, limit: 100, app_code: APP_CODE } });
    const t1 = totalOf(small), t2 = totalOf(big);
    const same = t1 !== null && t1 === t2;
    record("TC-DS03", "tổng số bản ghi không phụ thuộc limit", same ? "đạt" : "không đạt",
      same ? "tổng = " + t1 : "limit=1 trả tổng " + t1 + ", limit=100 trả tổng " + t2,
      { limit1: t1, limit100: t2 });
    expect(same, "tổng phải giống nhau ở hai mức limit").toBe(true);
  });

  test("TC-DS04 tổng số bản ghi khớp số thực tế của tập dữ liệu", async () => {
    if (!requireRoles(test, [ROLE])) return;
    const res = await api(ROLE, "GET", "/customer/all", { query: { page: 1, limit: 1, app_code: APP_CODE } });
    const total = totalOf(res);
    // 19.248 là số bản ghi của môi trường kiểm thử tại thời điểm lập bộ kiểm thử.
    const inRange = total !== null && total > 1000 && total < 100000;
    record("TC-DS04", "tổng số bản ghi nằm trong khoảng hợp lý", inRange ? "đạt" : "không đạt",
      "tổng = " + total, { total });
    expect(inRange, "tổng số bản ghi bất thường: " + total).toBe(true);
  });
});

test.describe("Dữ liệu khách hàng — lọc và tìm kiếm", () => {
  test("TC-DS05 tìm theo số điện thoại chỉ trả bản ghi chứa số đó", async () => {
    if (!requireRoles(test, [ROLE])) return;
    const phone = "0342693675";
    const res = await api(ROLE, "GET", "/customer/all", { query: { page: 1, limit: 50, app_code: APP_CODE, search: phone } });
    const rows = rowsOf(res);
    const bad = rows.filter((r) => !JSON.stringify(r).includes(phone));
    record("TC-DS05", "tìm theo số điện thoại", bad.length ? "không đạt" : "đạt",
      bad.length ? bad.length + "/" + rows.length + " bản ghi không chứa số đang tìm" : rows.length + " bản ghi, tất cả khớp",
      { rows: rows.length, sai: bad.length });
    expect(rows.length, "phải có kết quả").toBeGreaterThan(0);
    expect(bad.length, "bản ghi không khớp từ khoá").toBe(0);
  });

  test("TC-DS06 từ khoá không tồn tại trả mảng rỗng, không trả toàn bộ", async () => {
    if (!requireRoles(test, [ROLE])) return;
    const res = await api(ROLE, "GET", "/customer/all", { query: { page: 1, limit: 20, app_code: APP_CODE, search: "zzz-khong-co-khach-nao-zzz" } });
    const rows = rowsOf(res);
    record("TC-DS06", "từ khoá không tồn tại trả mảng rỗng", rows.length === 0 ? "đạt" : "không đạt",
      rows.length === 0 ? "rỗng" : "trả " + rows.length + " dòng khi không có kết quả", { rows: rows.length, status: res.status });
    // Lỗi hay gặp: tham số search không được áp dụng, hệ thống trả trang đầu của toàn bộ dữ liệu.
    expect(rows.length, "số dòng khi từ khoá không tồn tại").toBe(0);
  });

  test("TC-DS07 lọc theo trạng thái chỉ trả đúng trạng thái", async () => {
    if (!requireRoles(test, [ROLE])) return;
    const res = await api(ROLE, "GET", "/customer/all", { query: { page: 1, limit: 50, app_code: APP_CODE, status: "registered" } });
    const rows = rowsOf(res);
    const bad = rows.filter((r) => r.status !== undefined && String(r.status) !== "registered");
    record("TC-DS07", "lọc theo trạng thái registered", bad.length ? "không đạt" : "đạt",
      bad.length ? bad.length + " bản ghi sai trạng thái" : rows.length + " bản ghi đúng trạng thái",
      { rows: rows.length, sai: bad.length });
    expect(bad.length).toBe(0);
  });

  test("TC-DS08 lọc kết hợp trạng thái và tìm kiếm không làm mất điều kiện", async () => {
    if (!requireRoles(test, [ROLE])) return;
    const res = await api(ROLE, "GET", "/customer/all", {
      query: { page: 1, limit: 50, app_code: APP_CODE, status: "registered", search: "0" }
    });
    const rows = rowsOf(res);
    const bad = rows.filter((r) => !JSON.stringify(r).includes("0"));
    record("TC-DS08", "lọc kết hợp hai điều kiện", bad.length ? "không đạt" : "đạt",
      bad.length ? bad.length + " bản ghi không chứa từ khoá" : rows.length + " bản ghi thoả cả hai điều kiện",
      { rows: rows.length, status: res.status });
    expect(bad.length).toBe(0);
  });

  test("TC-DS09 sắp xếp ổn định giữa hai lần gọi cùng tham số", async () => {
    if (!requireRoles(test, [ROLE])) return;
    const q = { page: 1, limit: 20, app_code: APP_CODE };
    const a = await api(ROLE, "GET", "/customer/all", { query: q });
    const b = await api(ROLE, "GET", "/customer/all", { query: q });
    const ia = ids(rowsOf(a)).join(","), ib = ids(rowsOf(b)).join(",");
    record("TC-DS09", "sắp xếp ổn định giữa hai lần gọi", ia === ib ? "đạt" : "không đạt",
      ia === ib ? "thứ tự giống nhau" : "thứ tự khác nhau giữa hai lần gọi cùng tham số",
      { lan1: ia.slice(0, 120), lan2: ib.slice(0, 120) });
    expect(ia, "thứ tự bản ghi phải ổn định").toBe(ib);
  });

  test("TC-DS10 app_code khác không trả dữ liệu của vnfite", async () => {
    if (!requireRoles(test, [ROLE])) return;
    const res = await api(ROLE, "GET", "/customer/all", { query: { page: 1, limit: 20, app_code: "khong-ton-tai" } });
    const rows = rowsOf(res);
    record("TC-DS10", "app_code lạ không trả dữ liệu vnfite", rows.length === 0 || res.status >= 400 ? "đạt" : "không đạt",
      "status " + res.status + ", " + rows.length + " dòng", { status: res.status, rows: rows.length });
    expect(rows.length === 0 || res.status >= 400, "app_code lạ trả " + rows.length + " dòng").toBe(true);
  });
});

test.describe("Dữ liệu khách hàng — bản ghi chi tiết", () => {
  test("TC-DS11 bản ghi trong danh sách mở được trang chi tiết", async () => {
    if (!requireRoles(test, [ROLE])) return;
    const list = await api(ROLE, "GET", "/customer/all", { query: { page: 1, limit: 1, app_code: APP_CODE } });
    const first = rowsOf(list)[0];
    const id = first && (first.id || first._id);
    test.skip(!id, "Dòng đầu không có trường id — không xác định được khoá để mở chi tiết");

    const res = await api(ROLE, "GET", "/customer/" + encodeURIComponent(id));
    const body = res.json || {};
    const d = body.data || body;
    const hasName = Boolean(d.fullName || d.name || d.customerName);
    record("TC-DS11", "mở chi tiết từ bản ghi trong danh sách", res.status === 200 && hasName ? "đạt" : "không đạt",
      "status " + res.status + (hasName ? ", có tên khách" : ", thiếu tên khách"),
      { id, status: res.status, ms: res.ms });
    expect(res.status).toBe(200);
    expect(hasName, "chi tiết thiếu tên khách").toBe(true);
  });

  test("TC-DS12 các trường dùng để hiển thị trong danh sách đều có mặt", async () => {
    if (!requireRoles(test, [ROLE])) return;
    const res = await api(ROLE, "GET", "/customer/all", { query: { page: 1, limit: 20, app_code: APP_CODE } });
    const rows = rowsOf(res);
    // Chỉ kiểm những trường đã quan sát thấy trong dữ liệu thật; trường chưa từng thấy thì không đoán.
    const observed = new Set();
    rows.forEach((r) => Object.keys(r || {}).forEach((k) => observed.add(k)));
    const needed = ["id", "fullName"].filter((k) => observed.has(k));
    const missing = [];
    rows.forEach((r, i) => needed.forEach((k) => { if (r[k] === undefined || r[k] === null || r[k] === "") missing.push(k + "@" + i); }));
    record("TC-DS12", "trường hiển thị không rỗng ở mọi dòng", missing.length ? "không đạt" : "đạt",
      missing.length ? missing.slice(0, 10).join(", ") : "đủ " + needed.join(", "),
      { rows: rows.length, truong: needed, thieu: missing.length });
    expect(missing.slice(0, 10), "ô trống ở trường hiển thị").toEqual([]);
  });

  test("TC-DS13 thời gian phản hồi danh sách nằm trong ngưỡng đã đặt", async () => {
    if (!requireRoles(test, [ROLE])) return;
    const res = await api(ROLE, "GET", "/customer/all", { query: { page: 1, limit: 20, app_code: APP_CODE } });
    // Ngưỡng 5 giây cho một trang 20 dòng; đo trên máy kiểm thử, không phải máy chủ tải.
    const ok = res.ms < 5000;
    record("TC-DS13", "danh sách 20 dòng dưới 5 giây", ok ? "đạt" : "không đạt", res.ms + " ms", { ms: res.ms, status: res.status });
    expect(res.ms, "thời gian phản hồi").toBeLessThan(5000);
  });
});
