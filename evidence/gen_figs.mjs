import { chromium } from "@playwright/test";
import fs from "fs";

const OUT = process.cwd() + "/figures";
fs.mkdirSync(OUT, { recursive: true });

const FONT = `font-family:"Helvetica Neue",Helvetica,Arial,sans-serif`;
const head = (title, sub) => `
<div style="${FONT};color:#111;padding:18px 26px 0">
  <div style="font-size:21px;font-weight:700">${title}</div>
  <div style="font-size:13px;color:#666;margin-top:4px">${sub}</div>
</div>`;

function barChart({ items, unit, color = "#1f4e79", max }) {
  const m = max || Math.max(...items.map(i => i.v));
  const rowH = 46, W = 980, labelW = 300, barW = 520;
  const rows = items.map((it, i) => {
    const w = Math.max(2, (it.v / m) * barW);
    const y = i * rowH;
    return `
      <text x="0" y="${y + 26}" font-size="17" fill="#222">${it.k}</text>
      <rect x="${labelW}" y="${y + 8}" width="${w}" height="26" fill="${it.c || color}" rx="3"/>
      <text x="${labelW + w + 12}" y="${y + 27}" font-size="17" font-weight="600" fill="#111">${it.v.toLocaleString("vi-VN")}${unit ? " " + unit : ""}</text>`;
  }).join("");
  return `<svg width="${W}" height="${items.length * rowH + 10}">${rows}</svg>`;
}

function stackedChart(items) {
  const rowH = 40, W = 980, labelW = 300, total = Math.max(...items.map(i => i.a + i.b));
  const scale = 520 / total;
  const rows = items.map((it, i) => {
    const y = i * rowH;
    const wa = it.a * scale, wb = it.b * scale;
    return `
      <text x="0" y="${y + 25}" font-size="16" fill="#222">${it.k}</text>
      <rect x="${labelW}" y="${y + 8}" width="${wa}" height="24" fill="#1f4e79" rx="2"/>
      <rect x="${labelW + wa}" y="${y + 8}" width="${wb}" height="24" fill="#c9a227" rx="2"/>
      <text x="${labelW + wa + wb + 10}" y="${y + 25}" font-size="15" fill="#444">${it.a} / ${it.a + it.b} ms</text>`;
  }).join("");
  const legend = `
    <rect x="0" y="${items.length * rowH + 6}" width="14" height="14" fill="#1f4e79"/><text x="22" y="${items.length * rowH + 18}" font-size="14" fill="#444">Thời gian vẽ khung (paint)</text>
    <rect x="250" y="${items.length * rowH + 6}" width="14" height="14" fill="#c9a227"/><text x="272" y="${items.length * rowH + 18}" font-size="14" fill="#444">Thời gian tới khi dữ liệu sẵn sàng</text>`;
  return `<svg width="${W}" height="${items.length * rowH + 40}">${rows}${legend}</svg>`;
}

const charts = {
  "hinh-3-7-phan-bo-522-ca": head("Phân bố 522 ca kiểm thử theo phương pháp thực thi",
      "Nguồn: qa-e2e — Playwright, Newman, JMeter, chạy trên môi trường kiểm thử local, 08/11/2026") +
    barChart({ items: [
      { k: "Thủ công (Google Sheets)", v: 120 },
      { k: "API tự động (Postman/Newman)", v: 149 },
      { k: "Giao diện tự động (Playwright)", v: 173 },
      { k: "Kịch bản hiệu năng (JMeter)", v: 80 },
    ], unit: "ca" }),

  "hinh-3-10-thoi-gian-tung-man-hinh": head("Thời gian tải từng màn hình của bộ smoke test Playwright",
      "9 màn hình, Chromium 158, viewport 1440×900, mạng nội bộ; đơn vị mili giây") +
    stackedChart([
      { k: "Bảng điều khiển", a: 835, b: 1662 },
      { k: "Danh sách khách hàng", a: 597, b: 7235 },
      { k: "Nhận khách hàng", a: 811, b: 21513 },
      { k: "Khách hàng của tôi", a: 835, b: 1611 },
      { k: "Gọi điện", a: 899, b: 1610 },
      { k: "Hoa hồng", a: 424, b: 1613 },
      { k: "Yêu cầu nhận khách", a: 520, b: 1610 },
      { k: "Cấu hình tổng đài", a: 664, b: 1608 },
      { k: "Quản lý KPI", a: 1178, b: 1612 },
    ]),

  "hinh-3-12-p95-theo-endpoint": head("Phân vị 95 thời gian phản hồi theo endpoint ở 150 người dùng đồng thời",
      "JMeter 5.6.3, 120 giây, 5.221 request, 0 lỗi; ngưỡng T=500 ms, F=1.000 ms") +
    barChart({ color: "#a33a2b", items: [
      { k: "GET /notification/unread-count", v: 2531 },
      { k: "GET /user/getUserInfo", v: 2923, c: "#a33a2b" },
      { k: "GET /permissions/me", v: 6296, c: "#7b1e14" },
      { k: "Toàn bộ (5.221 request)", v: 5044, c: "#555" },
    ], unit: "ms" }),

  "hinh-3-13-ket-qua-thuc-thi": head("Kết quả thực thi 146 ca chạy được và trạng thái 29 lỗi",
      "Đợt kiểm thử 8 tuần; số liệu đối chiếu Bảng 3.44") +
    barChart({ color: "#1f6f43", items: [
      { k: "Ca Đạt", v: 145 },
      { k: "Ca Không đạt", v: 1, c: "#a33a2b" },
      { k: "Ca Bỏ qua", v: 2, c: "#b08a2e" },
      { k: "Lỗi đã đóng", v: 26, c: "#1f4e79" },
      { k: "Lỗi tồn (2 S3, 1 S4)", v: 3, c: "#7b1e14" },
    ], unit: "ca" }),
};

const codeFiles = [
  { name: "hinh-3-1-code-playwright", file: "tests/crm-smoke.spec.js", lang: "JavaScript", max: 42 },
  { name: "hinh-3-2-code-postman", file: "postman/CRM-API-ReadOnly.postman_collection.json", lang: "JSON", max: 38 },
  { name: "hinh-3-3-code-jmeter", file: "jmeter/crm-150-users.jmx", lang: "XML (JMeter Test Plan)", max: 34 },
];

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hl = line => esc(line)
  .replace(/(\/\/.*$)/g, '<span style="color:#6a9955">$1</span>')
  .replace(/(&quot;|")([^"]*)(")/g, '<span style="color:#a31515">$1$2$3</span>')
  .replace(/\b(import|from|const|await|test|expect|page|async|let|function|return|if|else|new)\b/g, '<span style="color:#0000ff">$1</span>')
  .replace(/(&lt;\/?[a-zA-Z]+)/g, '<span style="color:#800000">$1</span>');

const codePages = codeFiles.map(c => {
  const lines = fs.readFileSync(c.file, "utf8").split("\n").slice(0, c.max);
  const body = lines.map((l, i) =>
    `<tr><td style="color:#999;text-align:right;padding:0 14px 0 0;user-select:none">${i + 1}</td><td style="white-space:pre">${hl(l)}</td></tr>`
  ).join("");
  return {
    name: c.name,
    html: `<div style="${FONT};background:#fff;border:1px solid #ddd;border-radius:6px;overflow:hidden;width:1120px">
      <div style="background:#f3f3f3;border-bottom:1px solid #ddd;padding:9px 16px;font-size:13px;color:#333;font-family:Menlo,monospace">${c.file}<span style="float:right;color:#777">${c.lang}</span></div>
      <div style="padding:12px 10px"><table style="border-collapse:collapse;font-family:Menlo,'Courier New',monospace;font-size:12.5px;color:#1a1a1a;line-height:1.55">${body}</table></div>
    </div>`,
  };
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1220, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

for (const [name, html] of Object.entries(charts)) {
  await page.setContent(`<body style="margin:0;background:#fff"><div id="fig" style="display:inline-block;padding-bottom:16px">${html}</div></body>`);
  await page.waitForTimeout(250);
  const el = await page.$("#fig");
  await el.screenshot({ path: `${OUT}/${name}.png` });
  console.log("chart", name);
}
for (const c of codePages) {
  await page.setContent(`<body style="margin:0;background:#fff;padding:0">${c.html}</body>`);
  await page.waitForTimeout(250);
  const el = await page.$("body > div");
  await el.screenshot({ path: `${OUT}/${c.name}.png` });
  console.log("code", c.name);
}
await browser.close();
console.log("DONE");
