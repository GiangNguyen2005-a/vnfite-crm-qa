/**
 * Nhóm kiểm thử khả năng tiếp cận ở mức cấu trúc.
 *
 * Chỉ kiểm những thứ đọc được từ DOM mà không cần công cụ ngoài: ngôn ngữ trang, thẻ tiêu đề,
 * tên của nút, nhãn của ô nhập, ảnh có mô tả. Đây là mức tối thiểu; kiểm tương phản màu và
 * thứ tự tiêu điểm cần công cụ chuyên dụng nên không nằm trong phạm vi bộ này.
 */
const { test, expect } = require("@playwright/test");
const { loginAs, open } = require("./lib/ui");
const { hasRole } = require("./lib/env");
const { append, make } = require("./lib/result");

const SUITE = "a11y";
const FILE = "a11y-results.jsonl";
const PAGES = ["/dashboard", "/khach-hang", "/phan-quyen"];

function rec(tc, name, verdict, note, data) {
  append(FILE, make({ suite: SUITE, tc, name, role: "admin", verdict, note, data }));
}

test.describe("Cấu trúc trang", () => {
  test.skip(!hasRole("admin"), "Cần token admin");

  test("TC-A11Y01 trang khai báo ngôn ngữ", async ({ page }) => {
    await loginAs(page, "admin");
    const bad = [];
    for (const p of PAGES) {
      await open(page, p, 1800);
      const lang = await page.evaluate(() => document.documentElement.getAttribute("lang"));
      if (!lang) bad.push(p);
    }
    rec("TC-A11Y01", "khai báo ngôn ngữ trang", bad.length ? "không đạt" : "đạt",
      bad.length ? "thiếu lang ở " + bad.join(", ") : "có lang ở cả " + PAGES.length + " trang", { thieu: bad });
    expect(bad).toEqual([]);
  });

  test("TC-A11Y02 mỗi trang có đúng một tiêu đề cấp một", async ({ page }) => {
    await loginAs(page, "admin");
    const bad = [];
    for (const p of PAGES) {
      await open(page, p, 1800);
      const n = await page.locator("h1").count();
      if (n !== 1) bad.push(p + " (" + n + " thẻ h1)");
    }
    rec("TC-A11Y02", "đúng một tiêu đề cấp một", bad.length ? "không đạt" : "đạt",
      bad.length ? bad.join("; ") : "mỗi trang một h1", { vi_pham: bad });
    expect(bad).toEqual([]);
  });

  test("TC-A11Y03 không nhảy bậc tiêu đề", async ({ page }) => {
    await loginAs(page, "admin");
    const bad = [];
    for (const p of PAGES) {
      await open(page, p, 1800);
      const levels = await page.evaluate(() =>
        [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => Number(h.tagName[1]))
      );
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] - levels[i - 1] > 1) {
          bad.push(p + ": h" + levels[i - 1] + " → h" + levels[i]);
          break;
        }
      }
    }
    rec("TC-A11Y03", "không nhảy bậc tiêu đề", bad.length ? "không đạt" : "đạt",
      bad.length ? bad.join("; ") : "thứ tự liên tục", { vi_pham: bad });
    expect(bad).toEqual([]);
  });

  test("TC-A11Y04 ảnh có mô tả hoặc được đánh dấu trang trí", async ({ page }) => {
    await loginAs(page, "admin");
    const bad = [];
    for (const p of PAGES) {
      await open(page, p, 1800);
      const n = await page.evaluate(() =>
        [...document.querySelectorAll("img")].filter(
          (i) => !i.hasAttribute("alt") && i.getAttribute("role") !== "presentation" && i.getAttribute("aria-hidden") !== "true"
        ).length
      );
      if (n > 0) bad.push(p + " (" + n + " ảnh)");
    }
    rec("TC-A11Y04", "ảnh có mô tả", bad.length ? "không đạt" : "đạt",
      bad.length ? bad.join("; ") : "không có ảnh thiếu mô tả", { vi_pham: bad });
    expect(bad).toEqual([]);
  });

  test("TC-A11Y05 nút có tên đọc được", async ({ page }) => {
    await loginAs(page, "admin");
    await open(page, "/khach-hang", 2500);
    const nameless = await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .filter((b) => !(b.innerText || "").trim() && !b.getAttribute("aria-label") && !b.getAttribute("title"))
        .map((b) => b.outerHTML.slice(0, 120))
        .slice(0, 5)
    );
    rec("TC-A11Y05", "nút có tên đọc được", nameless.length ? "không đạt" : "đạt",
      nameless.length ? nameless.length + " nút không có tên" : "mọi nút có chữ hoặc nhãn", { mau: nameless });
    expect(nameless, "nút chỉ có biểu tượng mà không có nhãn").toEqual([]);
  });

  test("TC-A11Y06 ô nhập có nhãn", async ({ page }) => {
    await loginAs(page, "admin");
    await open(page, "/khach-hang", 2500);
    const unlabeled = await page.evaluate(() =>
      [...document.querySelectorAll("input:not([type=hidden]), select, textarea")]
        .filter((el) => {
          if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("placeholder")) return false;
          if (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) return false;
          return !el.closest("label");
        })
        .map((el) => (el.getAttribute("name") || el.getAttribute("type") || el.tagName) + "")
        .slice(0, 8)
    );
    rec("TC-A11Y06", "ô nhập có nhãn", unlabeled.length ? "không đạt" : "đạt",
      unlabeled.length ? unlabeled.length + " ô không có nhãn: " + unlabeled.join(", ") : "mọi ô có nhãn hoặc gợi ý",
      { mau: unlabeled });
    expect(unlabeled, "ô nhập không có nhãn cho trình đọc màn hình").toEqual([]);
  });
});
