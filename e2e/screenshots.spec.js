const { test } = require("@playwright/test");
const { signIn, setTheme } = require("./helpers");

/**
 * Captures the interface in both themes.
 *
 * Not assertions. These exist so there is a record of what the product looked
 * like on a given day, and so a design change can be reviewed by looking at it
 * rather than by reading a diff of CSS.
 *
 * Written to e2e/screens/, which is gitignored.
 */

const shot = (page, name) =>
  page.screenshot({ path: `e2e/screens/${name}.png`, fullPage: false });

for (const theme of ["light", "dark"]) {
  test.describe(`${theme} theme`, () => {
    test(`login`, async ({ page }) => {
      await page.goto("/login");
      await setTheme(page, theme);
      await shot(page, `login-${theme}`);
    });

    test(`dashboard`, async ({ page }) => {
      await signIn(page, "ada");
      await setTheme(page, theme);
      await page.waitForTimeout(500);
      await shot(page, `dashboard-${theme}`);
    });

    test(`code editor`, async ({ page }) => {
      await signIn(page, "ada");
      await setTheme(page, theme);
      const open = page.getByTitle("Open Code Editor");
      if (await open.count()) {
        await open.click();
        await page.waitForTimeout(900); // Monaco takes a moment to paint
        await shot(page, `code-editor-${theme}`);
      }
    });

    test(`cited version`, async ({ page }) => {
      // Publish a version through the API, then view it as a stranger would.
      await signIn(page, "ada");
      const id = await page.evaluate(async () => {
        const token = JSON.parse(localStorage.getItem("user")).token;
        const api = "http://localhost:5002/api";
        const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        const versions = await (await fetch(`${api}/code/history/paper.md?docType=prose`, { headers })).json();
        const v = versions.find((x) => x.branch === "main") || versions[0];
        if (!v) return null;
        await fetch(`${api}/code/version/${v._id}/cite`, {
          method: "POST", headers, body: JSON.stringify({ citable: true }),
        });
        return v._id;
      });
      if (!id) return;

      await setTheme(page, theme);
      await page.goto(`/v/${id}`);
      await page.waitForSelector(".cited__title");
      await shot(page, `cited-${theme}`);
    });
  });
}
