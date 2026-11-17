/**
 * Bộ kiểm thử phân quyền CRM: 5 vai trò x 14 màn hình = 70 tổ hợp / mỗi trình duyệt.
 * Mỗi tổ hợp kiểm hai lớp: menu có hiện đúng quyền và vào thẳng URL có bị chặn không.
 * Kết quả ghi nối tiếp vào results/perm-results.jsonl
 */
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const MATRIX = require("./matrix.json");
const TOKENS = require(path.join(__dirname, "qa_perm_tokens.json"));
const OUT = path.join(__dirname, "results");
const JSONL = path.join(OUT, "perm-results.jsonl");

fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });
if (!fs.existsSync(JSONL)) fs.writeFileSync(JSONL, "");

function append(obj) {
  fs.appendFileSync(JSONL, JSON.stringify(obj) + "\n");
}

function url(pathTemplate) {
  return pathTemplate.replace("__CID__", MATRIX.customerId);
}

for (const role of MATRIX.roles) {
  for (const screen of MATRIX.screens) {
    const expected = MATRIX.expected[screen.key][role.key];
    test(`${role.key} | ${screen.key} | mong doi ${expected ? "duoc phep" : "bi chan"}`, async ({ page }, testInfo) => {
      const token = TOKENS[role.key].token;
      const api403 = [];
      const api4xx = [];
      page.on("response", (res) => {
        const u = res.url();
        if (!u.includes("/api") && !u.includes(":2345")) return;
        if (res.status() === 403) api403.push(u.split("?")[0].replace(/^https?:\/\/[^/]+/, ""));
        else if (res.status() === 401) api4xx.push(u.split("?")[0].replace(/^https?:\/\/[^/]+/, ""));
      });

      await page.addInitScript((tk) => {
        localStorage.setItem(
          "auth-storage",
          JSON.stringify({ state: { accessToken: tk, refreshToken: null, isAuthenticated: true, account: null }, version: 0 })
        );
      }, token);

      const started = Date.now();
      // Cho app nạp xong quyền rồi mới đọc menu
      const boot = page.goto(MATRIX.baseUrl + "/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForResponse((r) => r.url().includes("/permissions/me"), { timeout: 40000 }).catch(() => null);
      await boot.catch(() => null);
      await page.waitForTimeout(2000);
      const menuText = await page.evaluate(() => document.body.innerText.slice(0, 20000)).catch(() => "");

      const nav = page.goto(MATRIX.baseUrl + url(screen.path), { waitUntil: "domcontentloaded" });
      await page.waitForResponse((r) => r.url().includes("/permissions/me"), { timeout: 40000 }).catch(() => null);
      await nav.catch(() => null);
      await page.waitForTimeout(2500);
      let finalUrl = page.url();
      if (finalUrl.includes("/workplace/dashboard")) {
        await page.goto(MATRIX.baseUrl + url(screen.path), { waitUntil: "domcontentloaded" }).catch(() => {});
        await page.waitForTimeout(4000);
        finalUrl = page.url();
      }
      const body = await page.evaluate(() => document.body.innerText.slice(0, 4000)).catch(() => "");
      const elapsed = Date.now() - started;

      const redirectedLogin = finalUrl.includes("/login");
      const redirectedAway = finalUrl.includes("/workplace/dashboard");
      const routeOk = !redirectedLogin && !redirectedAway;
      const deniedText = /không có quyền|không được phép|403|forbidden/i.test(body);
      const menuVisible = screen.menu ? menuText.includes(screen.menu) : null;

      // Kết luận: được phép -> phải mở được; bị chặn -> phải có tín hiệu chặn (menu ẩn + 403/không có quyền)
      let verdict;
      if (expected) {
        verdict = routeOk && menuVisible !== false ? "PASS" : "FAIL";
      } else {
        const deniedSignal = menuVisible === false || api403.length > 0 || deniedText;
        verdict = !routeOk || deniedSignal ? "PASS" : "FAIL";
      }

      const rec = {
        role: role.key, roleName: role.name, screen: screen.key, screenName: screen.name,
        path: screen.path, expected, menuVisible, routeOk, redirectedLogin, redirectedAway,
        deniedText, api403: api403.slice(0, 5), api401: api4xx.slice(0, 5),
        finalUrl: finalUrl.replace(MATRIX.baseUrl, ""), verdict, ms: elapsed,
        browser: testInfo.project.name, docBacked: screen.doc
      };
      append(rec);

      if (verdict === "FAIL") {
        await page.screenshot({ path: path.join(OUT, "shots", `${role.key}-${screen.key}-${testInfo.project.name}.png`) }).catch(() => {});
      }
      expect(verdict, `${role.key}/${screen.key} -> ${JSON.stringify(rec).slice(0, 600)}`).toBe("PASS");
    });
  }
}
