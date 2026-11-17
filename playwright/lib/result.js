/**
 * Ghi kết quả và ảnh chụp.
 *
 * Mỗi ca ghi một dòng JSON nối tiếp vào results/*.jsonl. Dòng này là nguồn để tính lại
 * tỉ lệ đạt, lọc theo nhóm, vẽ biểu đồ — không phải đọc báo cáo HTML.
 */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "results");
const SHOTS = path.join(OUT, "shots");

fs.mkdirSync(SHOTS, { recursive: true });

function append(name, rec) {
  fs.appendFileSync(path.join(OUT, name), JSON.stringify(rec) + "\n");
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/** Chụp ảnh theo mã ca. Bỏ qua lỗi chụp: mất ảnh không được làm ca kiểm thử sai kết luận. */
async function shot(page, tag) {
  try {
    const file = path.join(SHOTS, tag.replace(/[^\w.-]+/g, "_") + "-" + stamp() + ".png");
    await page.screenshot({ path: file, fullPage: false });
    return file;
  } catch (e) {
    return null;
  }
}

/** Tạo bản ghi kết quả thống nhất cho mọi bộ kiểm thử. */
function make({ suite, tc, name, role, verdict, note, data, shots }) {
  return {
    suite,
    tc,
    name,
    role: role || null,
    verdict,
    note: note || "",
    data: data || null,
    shots: shots || [],
    at: new Date().toISOString()
  };
}

module.exports = { OUT, SHOTS, append, shot, make };
