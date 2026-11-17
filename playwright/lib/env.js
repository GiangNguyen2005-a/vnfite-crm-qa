/**
 * Cấu hình môi trường dùng chung cho toàn bộ bộ kiểm thử Playwright.
 *
 * Nguyên tắc: không có giá trị nào được viết cứng trong tệp spec. Mọi thứ đọc từ
 * biến môi trường hoặc từ qa_perm_tokens.json (tệp này nằm trong .gitignore).
 * Nhờ vậy cùng một bộ mã chạy được trên máy cá nhân, máy kiểm thử nội bộ và máy chủ CI.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BASE_WEB = process.env.BASE_WEB || "http://localhost:5173";
const BASE_API = process.env.BASE_API || "http://localhost:2345";
const APP_CODE = process.env.APP_CODE || "vnfite";
const TOKEN_FILE = process.env.QA_TOKENS || path.join(ROOT, "qa_perm_tokens.json");

let cache = null;

/** Đọc token của 5 vai trò. Trả về {} nếu chưa có tệp, để spec tự bỏ qua thay vì báo lỗi giả. */
function tokens() {
  if (cache) return cache;
  if (!fs.existsSync(TOKEN_FILE)) return (cache = {});
  try {
    cache = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
  } catch (e) {
    cache = {};
  }
  return cache;
}

function hasRole(role) {
  const rec = tokens()[role];
  return Boolean(rec && rec.token);
}

/** Lấy token, ném lỗi rõ ràng nếu thiếu — im lặng trả undefined sẽ làm ca kiểm thử sai lệch nghĩa. */
function tokenOf(role) {
  const rec = tokens()[role];
  if (!rec || !rec.token) {
    throw new Error(
      "Thiếu token cho vai trò '" + role + "'. Tạo " + TOKEN_FILE + " theo mẫu trong README, hoặc đặt QA_TOKENS trỏ tới tệp khác."
    );
  }
  return rec.token;
}

function roles() {
  return Object.keys(tokens());
}

module.exports = { ROOT, BASE_WEB, BASE_API, APP_CODE, TOKEN_FILE, tokens, tokenOf, hasRole, roles };
