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

module.exports = { signIn, setTheme, token, contrast, parseColor, SEEDED, PASSWORD, API };
