#!/usr/bin/env node
/**
 * Làm mới token cho 5 vai trò rồi ghi lại vào qa_perm_tokens.json.
 *
 * Vì sao cần: access token của hệ thống hết hạn sau khoảng một giờ. Khi token hết hạn,
 * mọi bộ kiểm thử đều báo "không đạt" với mã 401 — nhìn giống lỗi phân quyền nhưng thật ra
 * chỉ là phiên cũ. Bước làm mới tách riêng để kết quả kiểm thử không bị nhiễu.
 *
 * Mật khẩu KHÔNG nằm trong mã và KHÔNG được ghi xuống đĩa. Truyền qua biến môi trường:
 *
 *   QA_PASS_admin=... QA_PASS_sale=... node tools/refresh-tokens.js
 *   QA_PASS_admin=... node tools/refresh-tokens.js --role admin
 *
 * Tên đăng nhập lấy từ qa_perm_tokens.json (trường username), để chỉ cần nhập mật khẩu.
 * Tệp kết quả đã nằm trong .gitignore.
 */
const fs = require("fs");
const path = require("path");
const { BASE_API, TOKEN_FILE } = require("../lib/env");

const args = process.argv.slice(2);
const only = args.includes("--role") ? args[args.indexOf("--role") + 1] : null;

function readStore() {
  if (!fs.existsSync(TOKEN_FILE)) {
    console.error("Không thấy " + TOKEN_FILE + ". Tạo tệp trước, mỗi vai trò một dòng username.");
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
}

async function login(username, password) {
  const res = await fetch(BASE_API + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username, password })
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = null;
  }
  if (res.status !== 200) {
    return { ok: false, error: "HTTP " + res.status + " " + text.slice(0, 160) };
  }
  const token = (json && (json.accessToken || (json.data && json.data.accessToken))) || null;
  if (!token) return { ok: false, error: "Phản hồi 200 nhưng không có accessToken: " + text.slice(0, 120) };
  return { ok: true, token, json };
}

async function perms(token) {
  const res = await fetch(BASE_API + "/permissions/me", { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

(async () => {
  const store = readStore();
  const roles = Object.keys(store).filter((r) => !only || r === only);
  if (!roles.length) {
    console.error("Không có vai trò nào khớp --role " + only);
    process.exit(2);
  }

  const report = [];
  for (const role of roles) {
    const username = store[role].username;
    const password = process.env["QA_PASS_" + role] || "";
    if (!username) {
      report.push([role, "bỏ qua", "thiếu username trong tệp token"]);
      continue;
    }
    if (!password) {
      report.push([role, "bỏ qua", "thiếu biến QA_PASS_" + role]);
      continue;
    }

    const r = await login(username, password);
    if (!r.ok) {
      report.push([role, "lỗi", r.error]);
      continue;
    }
    store[role].token = r.token;
    store[role].status = "ok";
    store[role].refreshedAt = new Date().toISOString();
    const p = await perms(r.token);
    if (p) store[role].perms = p;
    report.push([role, "ok", "token " + r.token.length + " ký tự"]);
  }

  fs.writeFileSync(TOKEN_FILE, JSON.stringify(store, null, 2) + "\n");

  console.log("Vai trò".padEnd(14) + "Kết quả".padEnd(10) + "Ghi chú");
  for (const [role, kq, note] of report) console.log(role.padEnd(14) + kq.padEnd(10) + note);
  console.log("\nĐã ghi " + TOKEN_FILE);
  if (report.some((r) => r[1] === "lỗi")) process.exit(1);
})();
