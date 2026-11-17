/**
 * Lớp gọi API mỏng, dùng fetch có sẵn của Node 18+.
 *
 * Vì sao không dùng thư viện: bộ kiểm thử chỉ cần gửi JSON, đọc mã trả về và đo thời gian.
 * Thêm một phụ thuộc nữa chỉ làm tăng rủi ro lệch phiên bản giữa các máy.
 */
const { BASE_API, APP_CODE, tokenOf } = require("./env");

function buildQuery(query) {
  if (!query) return "";
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v));
  return parts.length ? "?" + parts.join("&") : "";
}

/**
 * Gọi một endpoint.
 * @param {string|null} role   vai trò lấy token; null = gọi không kèm token
 * @param {string} method      GET, POST, ...
 * @param {string} pathname    đường dẫn bắt đầu bằng dấu /
 * @param {object} opts        { query, body, token, headers, timeout, appCode }
 */
async function api(role, method, pathname, opts = {}) {
  const { query, body, headers = {}, timeout = 30000 } = opts;
  const h = { Accept: "application/json", ...headers };
  if (body !== undefined) h["Content-Type"] = "application/json";

  const tk = opts.token !== undefined ? opts.token : role ? tokenOf(role) : null;
  if (tk) h.Authorization = "Bearer " + tk;

  const url = BASE_API + pathname + buildQuery(query);
  const t0 = Date.now();
  let res, text = "", json = null, error = null;

  try {
    res = await fetch(url, {
      method,
      headers: h,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout)
    });
    text = await res.text();
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = null;
    }
  } catch (e) {
    error = e.name === "TimeoutError" ? "timeout" : String(e.message || e);
  }

  return {
    url,
    method,
    role,
    status: res ? res.status : 0,
    ok: res ? res.ok : false,
    json,
    text,
    error,
    ms: Date.now() - t0
  };
}

/** Đường dẫn danh sách khách hàng, tham số hay dùng lặp lại ở nhiều ca. */
function customersPath(query = {}) {
  return { path: "/customer/all", query: { page: 1, limit: 20, app_code: APP_CODE, ...query } };
}

/** Lấy tổng số bản ghi mà một vai trò nhìn thấy — dùng cho các ca phạm vi dữ liệu. */
async function visibleTotal(role, extra = {}) {
  const r = await api(role, "GET", "/customer/all", { query: { page: 1, limit: 1, app_code: APP_CODE, ...extra } });
  const p = r.json && (r.json.pagination || r.json.meta || r.json);
  const total = p && (p.total !== undefined ? p.total : p.totalItems);
  return { res: r, total: typeof total === "number" ? total : null };
}

module.exports = { api, customersPath, visibleTotal };
