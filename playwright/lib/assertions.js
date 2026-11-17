/**
 * Các phép kiểm tra dùng lại: nhận diện màn hình bị chặn, kiểm cấu trúc JSON.
 *
 * Để ở một tệp riêng vì cùng một câu hỏi ("màn hình này có bị chặn không") được hỏi ở
 * hàng chục ca; sửa một chỗ là sửa cho tất cả.
 */

/** Dấu hiệu bị chặn ở tầng giao diện: thông báo thiếu quyền, hoặc bị đẩy về trang khác. */
const BLOCK_PATTERN = /không có quyền|không được phép|không có quyền truy cập|access denied|forbidden|401|403/i;

function isBlocked(text, url) {
  if (BLOCK_PATTERN.test(text || "")) return true;
  if (url && /\/(login|dang-nhap|403|404)(\?|$)/.test(url)) return true;
  return false;
}

/**
 * Kiểm cấu trúc một đối tượng JSON theo mô tả dạng { field: "string" }.
 * Trả về danh sách vấn đề thay vì ném lỗi ngay, để một ca báo được nhiều thiếu sót cùng lúc.
 */
function shapeProblems(obj, spec, prefix = "") {
  const problems = [];
  if (obj === null || typeof obj !== "object") return [prefix + " không phải đối tượng"];
  for (const [key, kind] of Object.entries(spec)) {
    const path = prefix ? prefix + "." + key : key;
    if (!(key in obj)) {
      problems.push("thiếu trường " + path);
      continue;
    }
    const v = obj[key];
    if (kind === "any") continue;
    if (kind === "array") {
      if (!Array.isArray(v)) problems.push(path + " phải là mảng");
    } else if (kind === "object") {
      if (v === null || typeof v !== "object" || Array.isArray(v)) problems.push(path + " phải là đối tượng");
    } else if (kind === "number") {
      if (typeof v !== "number" && !(typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)))) {
        problems.push(path + " phải là số, nhận được " + JSON.stringify(v));
      }
    } else if (typeof v !== kind) {
      problems.push(path + " phải là " + kind + ", nhận được " + typeof v);
    }
  }
  return problems;
}

/**
 * Kiểm một mảng bản ghi có vi phạm phạm vi không.
 * Vi phạm = có bản ghi mà trường chỉ định không nằm trong danh sách cho phép.
 */
function scopeViolations(rows, field, allowed) {
  const out = [];
  if (!Array.isArray(rows)) return ["dữ liệu trả về không phải mảng"];
  const allow = new Set(allowed.filter(Boolean).map((x) => String(x).toLowerCase()));
  for (const r of rows) {
    const v = r && r[field];
    if (v === undefined || v === null) continue;
    if (!allow.has(String(v).toLowerCase())) out.push(String(v));
  }
  return [...new Set(out)];
}

/** So sánh hai tập giá trị, trả về phần chênh lệch để ghi vào ghi chú ca kiểm thử. */
function diffSets(actual, expected) {
  const a = new Set(actual), e = new Set(expected);
  return {
    thieu: [...e].filter((x) => !a.has(x)),
    thua: [...a].filter((x) => !e.has(x))
  };
}

module.exports = { BLOCK_PATTERN, isBlocked, shapeProblems, scopeViolations, diffSets };
