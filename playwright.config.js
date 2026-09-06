const { defineConfig, devices } = require("@playwright/test");

/**
 * End to end tests.
 *
 * These exist for the parts of the product that unit and integration tests
 * cannot reach. Collaborative editing only fails when two clients are involved,
 * a video tile only fails once a real stream is attached, and a theme only
 * fails once something paints. None of that shows up in a Node process.
 *
 * Both servers are started here so a run needs no manual setup. The backend
 * uses its in memory database, which is seeded with four accounts that are
 * already friends, so the tests can sign in and immediately have someone to
 * collaborate with.
 */
module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,        // one seeded database, shared between specs
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // A camera and microphone that always exist and never ask permission,
          // so the call tests can run anywhere.
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
          ],
        },
        permissions: ["camera", "microphone", "clipboard-read", "clipboard-write"],
      },
    },
  ],

  webServer: [
    {
      command: "npm run dev",
      cwd: "./backend",
      url: "http://localhost:5002/healthz",
      reuseExistingServer: true,
      timeout: 180_000,
      stdout: "pipe",
    },
    {
      command: "npm start",
      cwd: "./frontend",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 240_000,
      env: { BROWSER: "none", NODE_OPTIONS: "--openssl-legacy-provider" },
    },
  ],
});
