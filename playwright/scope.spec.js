/**
 * Nhóm kiểm thử phạm vi dữ liệu ở tầng API.
 *
 * Câu hỏi: "vai trò thấp có nhìn thấy nhiều dữ liệu hơn mức được phép không".
 * perm.spec.js đã kiểm từng màn hình và từng đường dẫn; bộ này kiểm số lượng bản ghi mà
 * mỗi vai trò đọc được qua API, vì đó là thứ người dùng không thấy trên giao diện nhưng
 * vẫn lấy được bằng một lần gọi.
 *
 * Cách chấm: dựa trên quan hệ thứ bậc, không dựa trên con số tuyệt đối.
 *   - Quản trị toàn hệ thống phải thấy nhiều nhất.
 *   - Sale không được thấy nhiều hơn quản lý của mình.
 *   - Không vai trò nào được thấy vượt tổng số bản ghi của hệ thống.
 * Quan hệ này đúng ở mọi thời điểm, không phụ thuộc dữ liệu tăng thêm.
 */
const { test, expect } = require("@playwright/test");
const { api, visibleTotal } = require("./lib/http");
const { requireRoles } = require("./lib/skip");
const { append, make } = require("./lib/result");
const { APP_CODE, roles, hasRole } = require("./lib/env");

const SUITE = "scope";
const FILE = "scope-results.jsonl";

// Thứ bậc đọc dữ liệu, từ hẹp tới rộng. Tên vai trò lấy đúng như trong qa_perm_tokens.json.
const LADDER = ["sale", "team_lead", "sale_manager", "branch_manager", "admin"];
const LABEL = {
  sale: "Nhân viên kinh doanh",
  team_lead: "Trưởng nhóm",
  sale_manager: "Quản lý kinh doanh",
  branch_manager: "Quản trị chi nhánh",
  admin: "Quản trị hệ thống"
};

function record(tc, name, role, verdict, note, data) {
  append(FILE, make({ suite: SUITE, tc, name, role, verdict, note, data }));
}

test.describe("Phạm vi dữ liệu theo vai trò", () => {
  test("TC-PV01 mỗi vai trò đọc được danh sách khách hàng", async () => {
    const have = roles().filter((r) => LADDER.includes(r));
    test.skip(have.length === 0, "Chưa có qa_perm_tokens.json — bỏ qua nhóm phạm vi dữ liệu");

    const result = {};
    for (const r of have) {
      const { res, total } = await visibleTotal(r);
      result[r] = { status: res.status, total };
      record("TC-PV01", "đọc được danh sách", r, res.status === 200 ? "đạt" : "không đạt",
        "status " + res.status + ", tổng " + total, { status: res.status, total });
      expect(res.status, "vai trò " + r + " không đọc được danh sách").toBe(200);
    }
  });

  test("TC-PV02 vai trò hẹp không thấy nhiều hơn vai trò rộng hơn nó", async () => {
    const have = LADDER.filter((r) => hasRole(r));
    test.skip(have.length < 2, "Cần ít nhất hai vai trò để so sánh");

    const totals = {};
    for (const r of have) totals[r] = (await visibleTotal(r)).total;

    const violations = [];
    for (let i = 0; i < have.length - 1; i++) {
      const low = have[i], high = have[i + 1];
      if (totals[low] === null || totals[high] === null) continue;
      if (totals[low] > totals[high]) {
        violations.push(LABEL[low] + " (" + totals[low] + ") > " + LABEL[high] + " (" + totals[high] + ")");
      }
    }
    record("TC-PV02", "phạm vi không đảo thứ bậc", have.join(" → "), violations.length ? "không đạt" : "đạt",
      violations.length ? violations.join("; ") : JSON.stringify(totals), { totals, vi_pham: violations });
    expect(violations, "phạm vi dữ liệu đảo thứ bậc").toEqual([]);
  });

  test("TC-PV03 không vai trò nào thấy vượt tổng bản ghi của hệ thống", async () => {
    const have = LADDER.filter((r) => hasRole(r));
    test.skip(have.length === 0, "Chưa có token vai trò nào");

    const base = await visibleTotal("admin").catch(() => ({ total: null }));
    const ceilings = {};
    const bad = [];
    for (const r of have) {
      const { total } = await visibleTotal(r);
      ceilings[r] = total;
      if (total !== null && base.total !== null && total > base.total) bad.push(r + ": " + total + " > " + base.total);
    }
    record("TC-PV03", "không vượt tổng hệ thống", "tất cả", bad.length ? "không đạt" : "đạt",
      bad.length ? bad.join("; ") : "trần " + base.total, { ceilings, tran: base.total });
    expect(bad).toEqual([]);
  });

  test("TC-PV04 tổng bản ghi của vai trò hẹp không đổi khi đổi trang", async () => {
    const have = LADDER.filter((r) => hasRole(r));
    test.skip(have.length === 0, "Chưa có token vai trò nào");

    const problems = [];
    for (const r of have) {
      const a = await api(r, "GET", "/customer/all", { query: { page: 1, limit: 20, app_code: APP_CODE } });
      const b = await api(r, "GET", "/customer/all", { query: { page: 3, limit: 20, app_code: APP_CODE } });
      const t1 = a.json && a.json.pagination && a.json.pagination.total;
      const t2 = b.json && b.json.pagination && b.json.pagination.total;
      if (typeof t1 === "number" && typeof t2 === "number" && t1 !== t2) problems.push(r + ": trang 1 = " + t1 + ", trang 3 = " + t2);
    }
    record("TC-PV04", "tổng ổn định khi đổi trang", "tất cả", problems.length ? "không đạt" : "đạt",
      problems.length ? problems.join("; ") : "ổn định", { vi_pham: problems });
    expect(problems).toEqual([]);
  });

  test("TC-PV05 quản trị hệ thống đọc được nhiều hơn nhân viên kinh doanh", async () => {
    const have = requireRoles(test, ["admin", "sale"]);
    test.skip(!have, "Cần cả token admin và sale");

    const a = await visibleTotal("admin");
    const s = await visibleTotal("sale");
    const ok = a.total !== null && s.total !== null && a.total > s.total;
    record("TC-PV05", "quản trị thấy nhiều hơn nhân viên", "admin/sale", ok ? "đạt" : "không đạt",
      "admin " + a.total + " / sale " + s.total, { admin: a.total, sale: s.total });
    // Nếu hai vai trò thấy cùng một con số thì phạm vi dữ liệu chưa được áp dụng cho một trong hai.
    expect(ok, "admin " + a.total + " không lớn hơn sale " + s.total).toBe(true);
  });

  test("TC-PV06 nhân viên không lấy được bản ghi ngoài phạm vi qua đường dẫn chi tiết", async () => {
    if (!requireRoles(test, ["admin", "sale"])) return;

    const list = await api("admin", "GET", "/customer/all", { query: { page: 1, limit: 50, app_code: APP_CODE } });
    const rows = (list.json && list.json.data) || [];
    const mine = await api("sale", "GET", "/customer/all", { query: { page: 1, limit: 50, app_code: APP_CODE } });
    const mineIds = new Set(((mine.json && mine.json.data) || []).map((r) => String(r.id)));

    const outside = rows.filter((r) => r.id && !mineIds.has(String(r.id))).slice(0, 3);
    test.skip(outside.length === 0, "Không tìm được bản ghi nằm ngoài phạm vi của nhân viên trong 50 dòng đầu");

    const leaked = [];
    for (const r of outside) {
      const res = await api("sale", "GET", "/customer/" + encodeURIComponent(r.id));
      const body = res.json || {};
      const d = body.data || body;
      if (res.status === 200 && (d.fullName || d.name || d.phone)) leaked.push(String(r.id));
    }
    record("TC-PV06", "không đọc được bản ghi ngoài phạm vi", "sale", leaked.length ? "không đạt" : "đạt",
      leaked.length ? "đọc được " + leaked.length + " bản ghi ngoài phạm vi" : "bị chặn cả " + outside.length + " bản ghi",
      { thu: outside.length, lot: leaked });
    expect(leaked, "bản ghi ngoài phạm vi vẫn đọc được bằng đường dẫn chi tiết").toEqual([]);
  });
});
