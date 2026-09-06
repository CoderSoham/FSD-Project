const { test, expect } = require("@playwright/test");
const { signIn, setTheme, token, contrast } = require("./helpers");

/**
 * The design system, measured rather than assumed.
 *
 * A screenshot proves a page looked right on one machine on one day. These
 * check the properties that make a design system a system: both themes are
 * complete, text is readable against what is behind it, nothing is left over
 * from before the tokens existed, and the interface can be used from a
 * keyboard.
 */

test.describe("theming", () => {
  test("both themes define every token", async ({ page }) => {
    await page.goto("/login");

    // Every token the components actually depend on.
    const required = [
      "--bg", "--surface", "--surface-raised", "--surface-sunken",
      "--surface-hover", "--surface-active",
      "--text", "--text-muted", "--text-subtle", "--text-on-accent",
      "--border", "--border-strong", "--border-subtle",
      "--accent", "--accent-hover", "--accent-quiet", "--accent-text",
      "--success", "--success-quiet", "--warning", "--warning-quiet",
      "--danger", "--danger-quiet",
      "--space-2", "--space-4", "--radius-md", "--font-sans",
    ];

    for (const theme of ["light", "dark"]) {
      await setTheme(page, theme);
      const missing = [];
      for (const name of required) {
        const value = await token(page, name);
        if (!value) missing.push(name);
      }
      expect(missing, `tokens missing in ${theme} theme`).toEqual([]);
    }
  });

  test("the two themes are genuinely different", async ({ page }) => {
    await page.goto("/login");

    await setTheme(page, "light");
    const lightBg = await token(page, "--bg");
    const lightText = await token(page, "--text");

    await setTheme(page, "dark");
    const darkBg = await token(page, "--bg");
    const darkText = await token(page, "--text");

    expect(lightBg).not.toBe(darkBg);
    expect(lightText).not.toBe(darkText);
  });

  test("MUI follows the app theme instead of its own default", async ({ page }) => {
    // This is the bug that made the toggle only change half the screen: the app
    // set data-theme, drove the CSS variables, and MUI carried on rendering
    // with its built in light palette because no MUI theme was ever created.
    await signIn(page, "ada");

    await setTheme(page, "dark");
    const darkPaper = await page.evaluate(() => {
      const el = document.querySelector(".MuiPaper-root, .MuiButtonBase-root");
      return el ? getComputedStyle(el).color : null;
    });

    await setTheme(page, "light");
    const lightPaper = await page.evaluate(() => {
      const el = document.querySelector(".MuiPaper-root, .MuiButtonBase-root");
      return el ? getComputedStyle(el).color : null;
    });

    if (darkPaper && lightPaper) {
      expect(darkPaper, "an MUI component renders identically in both themes")
        .not.toBe(lightPaper);
    }
  });
});

test.describe("readability", () => {
  for (const theme of ["light", "dark"]) {
    test(`body text meets WCAG AA in ${theme}`, async ({ page }) => {
      await signIn(page, "ada");
      await setTheme(page, theme);

      const pairs = await page.evaluate(() => {
        // Walk visible text nodes and record the colour against the nearest
        // ancestor that actually paints a background.
        const out = [];
        const els = document.querySelectorAll("body *");
        for (const el of els) {
          const text = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3 && n.textContent.trim().length > 2);
          if (!text.length) continue;

          const rect = el.getBoundingClientRect();
          if (rect.width < 4 || rect.height < 4) continue;

          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.opacity === "0") continue;

          let bgEl = el;
          let bg = "rgba(0, 0, 0, 0)";
          while (bgEl) {
            const c = getComputedStyle(bgEl).backgroundColor;
            if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break; }
            bgEl = bgEl.parentElement;
          }
          out.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || "").toString().slice(0, 40),
            fg: cs.color,
            bg,
            size: parseFloat(cs.fontSize),
            sample: text[0].textContent.trim().slice(0, 30),
          });
        }
        return out;
      });

      const failures = [];
      for (const p of pairs) {
        const ratio = contrast(p.fg, p.bg);
        if (ratio === null) continue;
        // AA is 4.5:1, relaxed to 3:1 for large text.
        const needed = p.size >= 18.66 ? 3 : 4.5;
        if (ratio < needed) {
          failures.push(`${p.tag}.${p.cls} "${p.sample}" ${ratio.toFixed(2)}:1 (needs ${needed})`);
        }
      }

      expect(failures, `low contrast text in ${theme} theme`).toEqual([]);
    });
  }
});

test.describe("consistency", () => {
  test("no element still uses the old colour variables", async ({ page }) => {
    await signIn(page, "ada");

    // The previous token names. Anything still referencing them was missed in
    // the conversion and will not respond to the theme.
    const stale = await page.evaluate(() => {
      const old = ["--color-bg", "--color-surface", "--color-text", "--color-primary",
                   "--color-accent", "--color-border", "--color-secondary"];
      const found = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            const text = rule.cssText || "";
            for (const name of old) {
              if (text.includes(`var(${name})`)) {
                found.push(`${name} in ${(rule.selectorText || "").slice(0, 60)}`);
              }
            }
          }
        } catch { /* cross origin sheet */ }
      }
      return [...new Set(found)];
    });

    expect(stale, "stale colour variables still referenced").toEqual([]);
  });

  test("there is at most one primary button per view", async ({ page }) => {
    await signIn(page, "ada");
    const count = await page.locator(".btn--primary:visible").count();
    expect(count, "more than one primary button competing for attention")
      .toBeLessThanOrEqual(1);
  });
});

test.describe("keyboard access", () => {
  test("focus is visible on the login form", async ({ page }) => {
    await page.goto("/login");

    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        shadow: cs.boxShadow,
        outline: cs.outlineStyle + " " + cs.outlineWidth,
      };
    });

    expect(focused, "nothing received focus on Tab").not.toBeNull();
    const hasRing =
      (focused.shadow && focused.shadow !== "none") ||
      (focused.outline && !focused.outline.startsWith("none"));
    expect(hasRing, `no visible focus indicator on <${focused.tag}>`).toBe(true);
  });
});
