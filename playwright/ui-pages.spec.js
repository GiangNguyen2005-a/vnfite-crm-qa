/**
 * Nhóm kiểm thử hiển thị: mỗi màn hình chính phải mở được, có dữ liệu, không lỗi console.
 *
 * Đây là lớp kiểm thử rẻ nhất và bắt được nhiều lỗi nhất sau mỗi lần nâng cấp giao diện:
 * màn hình trắng, bảng rỗng, chữ "undefined" lọt ra, một lời gọi API trả 500 làm cả trang trắng.
 *
 * Số liệu đo được ghi vào results/ui-results.jsonl để so sánh giữa các lần chạy.
 */
const { test, expect } = require("@playwright/test");
const { loginAs, open, collectors, bodyText, rowCount } = require("./lib/ui");
const { hasRole } = require("./lib/env");
const { append, make, shot } = require("./lib/result");

const SUITE = "ui";
const FILE = "ui-results.jsonl";

// Đường dẫn và tên màn hình. Giữ đúng đường dẫn đang dùng trong hệ thống, không tự đặt tên mới.
const SCREENS = [
  { tc: "TC-UI01", path: "/dashboard", name: "Tổng quan" },
  { tc: "TC-UI02", path: "/khach-hang", name: "Danh sách khách hàng" },
  { tc: "TC-UI03", path: "/doi-ngu", name: "Đội ngũ" },
  { tc: "TC-UI04", path: "/hoa-hong", name: "Hoa hồng" },
  { tc: "TC-UI05", path: "/bao-cao", name: "Báo cáo" },
  { tc: "TC-UI06", path: "/phan-quyen", name: "Phân quyền" }
];

const BAD_TEXT = /undefined|NaN|\[object Object\]|Infinity/;

test.describe("Hiển thị màn hình chính", () => {
  test.skip(!hasRole("admin"), "Cần token admin để kiểm hiển thị");

  for (const s of SCREENS) {
    test(s.tc + " " + s.name + " mở được và có nội dung", async ({ page }) => {
      await loginAs(page, "admin", { landing: s.path });
      const c = collectors(page);
      const t0 = Date.now();
      const text = await open(page, s.path, 2500);
      const totalMs = Date.now() - t0;
      const rows = await rowCount(page);
      const shots = [await shot(page, s.tc)];

      const blank = text.length < 40;
      const junk = BAD_TEXT.test(text);
      const crashed = c.consoleErrors.some((e) => /is not a function|Cannot read prop|TypeError/i.test(e));
      const verdict = blank || junk || crashed ? "không đạt" : "đạt";
      const note = blank
        ? "màn hình gần như trắng (" + text.length + " ký tự)"
        : junk
        ? "có chữ rác trên giao diện"
        : crashed
        ? "lỗi JavaScript: " + c.consoleErrors[0]
        : "mở được, " + rows + " dòng, " + c.calls.length + " lời gọi API";

      append(FILE, make({
        suite: SUITE, tc: s.tc, name: s.name, role: "admin", verdict, note, shots,
        data: { path: s.path, totalMs, rows, apiCalls: c.calls.length, failedCalls: c.failedCalls, consoleErrors: c.consoleErrors.slice(0, 5) }
      }));

      expect(blank, "màn hình trắng: " + s.path).toBe(false);
      expect(junk, "chữ rác trên màn hình " + s.path).toBe(false);
      expect(crashed, "lỗi JavaScript trên " + s.path).toBe(false);
    });
  }

  test("TC-UI07 không màn hình nào có lời gọi API thất bại", async ({ page }) => {
    await loginAs(page, "admin");
    const c = collectors(page);
    for (const s of SCREENS) await open(page, s.path, 1800);

    append(FILE, make({
      suite: SUITE, tc: "TC-UI07", name: "không có lời gọi API thất bại", role: "admin",
      verdict: c.failedCalls.length ? "không đạt" : "đạt",
      note: c.failedCalls.length ? c.failedCalls.slice(0, 5).join(" | ") : c.calls.length + " lời gọi, không lời gọi nào lỗi",
      data: { failedCalls: c.failedCalls, calls: c.calls.length }
    }));
    expect(c.failedCalls.slice(0, 5), "lời gọi API thất bại khi duyệt các màn hình").toEqual([]);
  });

  test("TC-UI08 thời gian mở màn hình danh sách dưới 6 giây", async ({ page }) => {
    await loginAs(page, "admin");
    const t0 = Date.now();
    await open(page, "/khach-hang", 2500);
    const totalMs = Date.now() - t0;
    // Ngưỡng rộng: bao gồm cả thời gian dựng trang lần đầu, không phải thời gian phản hồi API.
    append(FILE, make({
      suite: SUITE, tc: "TC-UI08", name: "mở danh sách khách hàng dưới 6 giây", role: "admin",
      verdict: totalMs < 6000 ? "đạt" : "không đạt", note: totalMs + " ms", data: { totalMs }
    }));
    expect(totalMs).toBeLessThan(6000);
  });
});
