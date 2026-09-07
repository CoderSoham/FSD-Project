/**
 * Shared helpers for the end to end tests.
 *
 * Signing in goes through the API and writes the result to localStorage rather
 * than filling the login form. The form has its own test; making every other
 * spec drive it as well would mean a change to the login markup breaks twenty
 * unrelated tests for no reason.
 */

const SEEDED = {
  ada: { mail: "ada@example.com", username: "ada" },
  grace: { mail: "grace@example.com", username: "grace" },
  alan: { mail: "alan@example.com", username: "alan" },
};

const PASSWORD = "devpassword";
const API = "http://localhost:5002/api";

/** Sign in as one of the seeded accounts and land on the dashboard. */
async function signIn(page, who = "ada") {
  const person = SEEDED[who];

  // The origin has to exist before localStorage can be written to it.
  await page.goto("/login");

  const details = await page.evaluate(
    async ({ api, mail, password }) => {
      const res = await fetch(`${api}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mail, password }),
      });
      if (!res.ok) throw new Error(`login failed: ${res.status}`);
      const data = await res.json();
      localStorage.setItem("user", JSON.stringify(data.userDetails));
      return data.userDetails;
    },
    { api: API, mail: person.mail, password: PASSWORD }
  );

  await page.goto("/dashboard");
  return details;
}

/** Force a theme and wait for the attribute to land. */
async function setTheme(page, theme) {
  await page.evaluate((t) => localStorage.setItem("theme", t), theme);
  await page.reload();
  await page.waitForFunction(
    (t) => document.documentElement.getAttribute("data-theme") === t,
    theme
  );
}

/** Read a design token as the browser resolves it. */
function token(page, name) {
  return page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name
  );
}

/**
 * Parse a CSS colour into rgb numbers so contrast can be measured.
 * Returns null for transparent or anything unparseable.
 */
function parseColor(css) {
  const m = String(css).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  const a = m[4] === undefined ? 1 : Number(m[4]);
  if (a === 0) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

/** WCAG relative luminance. */
function luminance({ r, g, b }) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Contrast ratio between two CSS colours, or null if either is transparent. */
function contrast(fg, bg) {
  const a = parseColor(fg);
  const b = parseColor(bg);
  if (!a || !b) return null;
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Open the code editor and wait for Monaco to be usable.
 *
 * The size check is not paranoia. Monaco measures its container when it mounts,
 * and inside this panel it can measure before flex has resolved and settle at
 * five pixels square, where it looks mounted and accepts nothing.
 */
async function openCodeEditor(page, { filename } = {}) {
  await page.getByTitle("Open the code editor").click();
  await page.waitForSelector(".code-panel");
  await page.waitForSelector(".monaco-editor textarea", { state: "attached" });
  await page.waitForFunction(
    () => {
      const r = document.querySelector(".monaco-editor")?.getBoundingClientRect();
      return r && r.width > 200 && r.height > 100;
    },
    { timeout: 15000 }
  );
  if (filename) {
    await page.getByLabel("Filename").fill(filename);
  }
  await page.waitForTimeout(400);
}

/**
 * Type into Monaco.
 *
 * Clicking the hidden textarea does not focus the editor; Monaco listens on its
 * own text surface. Click that, confirm focus landed, then type.
 */
async function typeInEditor(page, text) {
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.waitForFunction(
    () =>
      document.activeElement?.classList.contains("inputarea") ||
      document.activeElement?.closest(".monaco-editor") !== null,
    { timeout: 5000 }
  );
  await page.keyboard.type(text, { delay: 20 });
}

/**
 * The editor's visible text.
 *
 * Monaco renders every space as a non-breaking space (U+00A0), so a naive
 * comparison against ordinary text fails even when the two look identical on
 * screen. Normalise before returning.
 */
function editorText(page) {
  return page.evaluate(() => {
    if (!document.querySelector(".monaco-editor")) return null;
    return Array.from(document.querySelectorAll(".view-line"))
      .map((l) => l.textContent.replace(/\u00a0/g, " "))
      .join("\n");
  });
}

/**
 * Call the API from inside a signed in page, using that page's own token.
 *
 * Some setup is far cheaper through the API than through the interface, and
 * doing it in the browser means it uses the same session the test does.
 */
async function api(page, path, { method = "GET", body } = {}) {
  return page.evaluate(
    async ({ apiBase, path, method, body }) => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const res = await fetch(`${apiBase}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(user.token ? { Authorization: `Bearer ${user.token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: res.status, data };
    },
    { apiBase: API, path, method, body }
  );
}

module.exports = {
  signIn,
  setTheme,
  token,
  contrast,
  parseColor,
  openCodeEditor,
  typeInEditor,
  editorText,
  api,
  SEEDED,
  PASSWORD,
  API,
};
