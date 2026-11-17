const { defineConfig } = require("@playwright/test");
const path = require("path");

const OUT = path.join(__dirname, "results");

module.exports = defineConfig({
  testDir: __dirname,
  // Chạy mọi tệp .spec.js trong thư mục này; các tệp phụ trợ nằm trong lib/ và data/.
  testMatch: /.*\.spec\.js$/,
  timeout: 180000,
  expect: { timeout: 15000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: path.join(OUT, "html"), open: "never" }],
    ["json", { outputFile: path.join(OUT, "report.json") }]
  ],
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
    trace: "off",
    actionTimeout: 15000,
    navigationTimeout: 45000
  },
  // Chỉ một trình duyệt: bộ kiểm thử so sánh hành vi giữa các vai trò, không so sánh
  // giữa các trình duyệt. Thêm project khác sẽ làm số liệu không còn so sánh được.
  projects: [{ name: "chrome", use: { browserName: "chromium", channel: "chrome" } }]
});
