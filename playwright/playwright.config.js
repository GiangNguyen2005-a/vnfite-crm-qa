const { defineConfig } = require("@playwright/test");
const path = require("path");

const OUT = path.join(__dirname, "results");

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /perm\.spec\.js/,
  timeout: 120000,
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
    trace: "off"
  },
  projects: [
    { name: "chrome", use: { browserName: "chromium", channel: "chrome" } },
    { name: "edge", use: { browserName: "chromium", channel: "msedge" } },
    { name: "firefox", use: { browserName: "firefox" } }
  ]
});
