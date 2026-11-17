/**
 * Cổng bỏ qua khi thiếu token.
 *
 * Nếu qa_perm_tokens.json không có, bộ kiểm thử báo "bỏ qua" chứ không báo "đạt".
 * Đánh dấu đạt khi chưa hề chạy là cách tự lừa mình phổ biến nhất trong báo cáo kiểm thử.
 */
const { hasRole } = require("./env");

function requireRoles(t, list) {
  const missing = list.filter((r) => !hasRole(r));
  if (missing.length) {
    t.skip(true, "Thiếu token cho: " + missing.join(", ") + " — tạo qa_perm_tokens.json rồi chạy lại");
    return false;
  }
  return true;
}

module.exports = { requireRoles };
