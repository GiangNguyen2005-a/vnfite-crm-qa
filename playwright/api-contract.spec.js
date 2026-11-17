/**
 * Kiểm hợp đồng dữ liệu của các endpoint đọc.
 *
 * Mỗi ca lấy một mục trong data/api-contracts.json rồi kiểm bốn thứ, theo thứ tự:
 *   1. mã trả về đúng kỳ vọng
 *   2. cấu trúc JSON có đủ trường bắt buộc và đúng kiểu
 *   3. nếu khai báo lọc thì mọi bản ghi phải thỏa điều kiện lọc
 *   4. thời gian phản hồi không vượt ngưỡng cảnh báo
 *
 * Vì sao tách khỏi bộ phân quyền: bộ này trả lời "dữ liệu trả về có đúng hình dạng không",
 * còn bộ phân quyền trả lời "vai trò này có được thấy dữ liệu không". Hai câu hỏi khác nhau,
 * lỗi ở hai tầng khác nhau, sửa ở hai nơi khác nhau.
 */
const { test, expect } = require("@playwright/test");
const contracts = require("./data/api-contracts.json").contracts;
const { api } = require("./lib/http");
const { shapeProblems } = require("./lib/assertions");
const { requireRoles } = require("./lib/skip");
const { append, make } = require("./lib/result");

const SUITE = "contract";
const RESULT_FILE = "contract-results.jsonl";

for (const c of contracts) {
  test(`${c.id} ${c.name}`, async ({}, testInfo) => {
    if (c.role && !requireRoles(test, [c.role])) return;

    const res = await api(c.role, c.method, c.path, {
      query: c.query,
      token: c.token // undefined = dùng token của vai trò; null = không gửi token
    });

    const problems = [];

    // 1. mã trả về
    if (res.status !== c.expectStatus) {
      problems.push(`mã trả về ${res.status}, kỳ vọng ${c.expectStatus}` + (res.error ? ` (lỗi: ${res.error})` : ""));
    }

    // 2. cấu trúc
    if (c.shape && res.json) {
      problems.push(...shapeProblems(res.json, c.shape));
      if (c.paginationShape && res.json.pagination) {
        problems.push(...shapeProblems(res.json.pagination, c.paginationShape, "pagination"));
      }
    } else if (c.shape && !res.json) {
      problems.push("không đọc được JSON từ phản hồi");
    }

    // 3. điều kiện lọc áp lên từng bản ghi
    let rowsChecked = 0;
    if (c.allRowsField && res.json && Array.isArray(res.json.data)) {
      for (const [field, want] of Object.entries(c.allRowsField)) {
        rowsChecked = res.json.data.length;
        const bad = res.json.data.filter((r) => r && r[field] !== undefined && r[field] !== want);
        if (bad.length) problems.push(`${bad.length}/${res.json.data.length} bản ghi có ${field} khác "${want}"`);
      }
    }

    // 4. thời gian
    if (c.maxMs && res.status === c.expectStatus && res.ms > c.maxMs) {
      problems.push(`thời gian phản hồi ${res.ms} ms vượt ngưỡng cảnh báo ${c.maxMs} ms`);
    }

    const rec = make({
      suite: SUITE,
      tc: c.id,
      name: c.name,
      role: c.role,
      verdict: problems.length ? "FAIL" : "PASS",
      note: problems.join("; ") || c.note || "",
      data: { status: res.status, ms: res.ms, rows: rowsChecked, url: res.url }
    });
    append(RESULT_FILE, rec);
    await testInfo.attach("ket-qua.json", { body: JSON.stringify(rec, null, 2), contentType: "application/json" });

    expect(problems, problems.join("\n")).toHaveLength(0);
  });
}
