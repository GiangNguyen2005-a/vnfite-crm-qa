/**
 * Kiểm độ bền của API trước đầu vào sai và biên.
 *
 * Nguyên tắc chấm: một ca chỉ không đạt khi rơi vào hai tình huống
 *   - trả 500 (lỗi máy chủ) — nghĩa là dữ liệu đầu vào lọt xuống tầng dưới mà không được kiểm
 *   - trả 200 kèm dữ liệu trong khi tham số vô nghĩa (ví dụ status không tồn tại mà vẫn trả đủ)
 * Mọi cách xử lý khác (400, 414, kẹp về mặc định) đều chấp nhận được, vì đó là quyết định thiết kế.
 *
 * Bộ này cố ý không kết luận về lỗ hổng bảo mật: nó chỉ chứng minh hệ thống không sập.
 */
const { test, expect } = require("@playwright/test");
const cases = require("./data/robustness-cases.json").cases;
const { api } = require("./lib/http");
const { requireRoles } = require("./lib/skip");
const { append, make } = require("./lib/result");

const SUITE = "robust";
const FILE = "robust-results.jsonl";

function expand(v) {
  if (v && typeof v === "object" && Array.isArray(v.__repeat)) {
    const [s, n] = v.__repeat;
    return String(s).repeat(Number(n) || 0);
  }
  return v;
}

for (const c of cases) {
  test(`${c.id} ${c.name}`, async ({}, testInfo) => {
    if (!requireRoles(test, ["sale"])) return;
    const query = Object.fromEntries(Object.entries(c.query).map(([k, v]) => [k, expand(v)]));
    const res = await api("sale", "GET", "/customer/all", { query, timeout: 25000 });

    const problems = [];
    if (res.status === 0) problems.push("không gọi được: " + (res.error || "lỗi mạng"));
    if (c.allow && !c.allow.includes(res.status)) problems.push(`mã ${res.status} ngoài danh sách chấp nhận ${c.allow.join("/")}`);
    if (c.mustNot && c.mustNot.includes(res.status)) problems.push(`mã ${res.status} thuộc danh sách cấm`);
    if (res.status >= 500) problems.push(`lỗi máy chủ ${res.status}`);

    // Tham số vô nghĩa mà vẫn trả đủ dữ liệu = bộ lọc bị bỏ qua.
    const rows = ((res.json || {}).data || []).length;
    if (res.status === 200 && /status không tồn tại/.test(c.name) && rows > 0) {
      problems.push(`status không tồn tại nhưng vẫn trả ${rows} bản ghi`);
    }
    if (res.status === 200 && /limit = 0|limit âm/.test(c.name) && rows > 100) {
      problems.push(`limit vô lý nhưng trả ${rows} bản ghi`);
    }

    const rec = make({
      suite: SUITE,
      tc: c.id,
      name: c.name,
      role: "sale",
      verdict: problems.length ? "FAIL" : "PASS",
      note: problems.join("; ") || c.note || "",
      data: { status: res.status, rows, ms: res.ms }
    });
    append(FILE, rec);
    await testInfo.attach("ket-qua.json", { body: JSON.stringify(rec, null, 2), contentType: "application/json" });
    expect(problems, problems.join("\n")).toHaveLength(0);
  });
}

test("RB-13 phương thức không được hỗ trợ", async ({}, testInfo) => {
  if (!requireRoles(test, ["sale"])) return;
  const res = await api("sale", "DELETE", "/customer/all", {});
  const problems = [];
  if (res.status !== 404 && res.status !== 405) problems.push(`DELETE /customer/all trả ${res.status}, kỳ vọng 404/405`);
  if (res.status === 200) problems.push("xoá qua endpoint danh sách trả 200 — rủi ro mất dữ liệu");
  const rec = make({
    suite: SUITE, tc: "RB-13", name: "phương thức không được hỗ trợ", role: "sale",
    verdict: problems.length ? "FAIL" : "PASS", note: problems.join("; "), data: { status: res.status }
  });
  append(FILE, rec);
  expect(problems, problems.join("\n")).toHaveLength(0);
});

test("RB-14 mã trả về có kiểu nội dung JSON", async ({}, testInfo) => {
  if (!requireRoles(test, ["sale"])) return;
  const res = await api("sale", "GET", "/customer/all", { query: { page: 1, limit: 5, app_code: "vnfite" } });
  const problems = [];
  if (res.status === 200 && !res.json) problems.push("mã 200 nhưng thân phản hồi không phải JSON đọc được");
  if (!res.text.length) problems.push("thân phản hồi rỗng");
  const rec = make({
    suite: SUITE, tc: "RB-14", name: "thân phản hồi là JSON", role: "sale",
    verdict: problems.length ? "FAIL" : "PASS", note: problems.join("; "), data: { status: res.status, bytes: res.text.length }
  });
  append(FILE, rec);
  expect(problems, problems.join("\n")).toHaveLength(0);
});
