const { test, expect } = require("@playwright/test");
const { signIn, api, API } = require("./helpers");

/**
 * The public citation page.
 *
 * A reference in a paper is no use if following it lands the reader on a login
 * screen, so this page has to work with no session at all. That is exactly the
 * property a signed in test cannot check: the browser it runs in already has a
 * token, and every request would succeed for the wrong reason.
 *
 * So each test here opens the page in a context that has never signed in.
 */

/** Publish one of ada's versions and return its id. */
async function publishAVersion(page, { citable = true } = {}) {
  const history = await api(page, "/code/history/paper.md?docType=prose");
  const version = history.data.find((v) => v.branch === "main") || history.data[0];
  expect(version, "the seeded paper.md should have history").toBeTruthy();

  const res = await api(page, `/code/version/${version._id}/cite`, {
    method: "POST",
    body: { citable },
  });
  expect(res.status).toBe(200);
  return version._id;
}

test("a published version opens for someone with no account", async ({ page, browser }) => {
  await signIn(page, "ada");
  const id = await publishAVersion(page);

  // A context that has never held a token.
  const stranger = await browser.newContext();
  const anon = await stranger.newPage();
  try {
    await anon.goto(`/v/${id}`);
    await expect(anon.locator(".cited__title")).toHaveText("paper.md");
    await expect(anon.getByText("Cited version")).toBeVisible();

    // It really is anonymous, not a session leaking through.
    const token = await anon.evaluate(() => localStorage.getItem("user"));
    expect(token).toBeNull();
  } finally {
    await stranger.close();
  }
});

test("the page shows the hash a reader needs to confirm the text is what was cited", async ({ page, browser }) => {
  await signIn(page, "ada");
  const id = await publishAVersion(page);
  const version = (await api(page, `/code/version/${id}`)).data;

  const stranger = await browser.newContext();
  const anon = await stranger.newPage();
  try {
    await anon.goto(`/v/${id}`);
    await expect(anon.locator(".cited__hash")).toContainText(version.contentHash.slice(0, 12));
    // The full hash is there for anyone who wants to check it properly.
    await expect(anon.locator(".cited__hash")).toHaveAttribute("title", version.contentHash);
  } finally {
    await stranger.close();
  }
});

test("both a plain reference and a BibTeX entry are offered, and copy", async ({ page, browser }) => {
  await signIn(page, "ada");
  const id = await publishAVersion(page);

  const stranger = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const anon = await stranger.newPage();
  try {
    await anon.goto(`/v/${id}`);
    await expect(anon.getByText("Reference")).toBeVisible();
    await expect(anon.getByText("BibTeX")).toBeVisible();

    await anon.getByRole("button", { name: "Copy" }).first().click();
    await expect(anon.getByRole("button", { name: "Copied" })).toBeVisible();

    const clipboard = await anon.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain("paper.md");
  } finally {
    await stranger.close();
  }
});

test("prose is rendered as prose, not shown as raw markdown", async ({ page, browser }) => {
  await signIn(page, "ada");
  const id = await publishAVersion(page);

  const stranger = await browser.newContext();
  const anon = await stranger.newPage();
  try {
    await anon.goto(`/v/${id}`);
    const article = anon.locator(".prose-readonly");
    await expect(article).toBeVisible();
    // The seeded paper starts with a heading. Seeing the hashes would mean the
    // markdown was never converted.
    await expect(article.locator("h1, h2").first()).toBeVisible();
    await expect(article).not.toContainText("## Introduction");
  } finally {
    await stranger.close();
  }
});

test("unpublishing makes the link stop resolving", async ({ page, browser }) => {
  await signIn(page, "ada");
  const id = await publishAVersion(page);

  const stranger = await browser.newContext();
  const anon = await stranger.newPage();
  try {
    await anon.goto(`/v/${id}`);
    await expect(anon.locator(".cited__title")).toBeVisible();

    // The author changes their mind.
    await api(page, `/code/version/${id}/cite`, { method: "POST", body: { citable: false } });

    await anon.reload();
    await expect(anon.getByText("Not available")).toBeVisible();
    await expect(anon.locator(".cited__title")).toHaveCount(0);
  } finally {
    await stranger.close();
  }
});

test("an unpublished version does not confirm its own existence", async ({ page, browser }) => {
  // Distinguishing "exists but private" from "does not exist" is itself a
  // disclosure: it tells a stranger that a particular document is being worked
  // on. Both cases have to look the same.
  await signIn(page, "ada");
  const history = await api(page, "/code/history/paper.md?docType=prose");
  const privateId = history.data[0]._id;
  await api(page, `/code/version/${privateId}/cite`, { method: "POST", body: { citable: false } });

  const madeUpId = "0".repeat(24);

  const stranger = await browser.newContext();
  const anon = await stranger.newPage();
  try {
    const responses = [];
    for (const id of [privateId, madeUpId]) {
      const res = await anon.request.get(`${API}/public/versions/${id}`);
      responses.push({ status: res.status(), body: await res.text() });
    }
    expect(responses[0].status).toBe(404);
    expect(responses[1].status).toBe(404);

    // And the page itself says the same thing in both cases.
    for (const id of [privateId, madeUpId]) {
      await anon.goto(`/v/${id}`);
      await expect(anon.getByText("Not available")).toBeVisible();
    }
  } finally {
    await stranger.close();
  }
});

test("a malformed id is a 404 rather than a crash", async ({ browser }) => {
  // This is the shape of input that used to terminate the API process: Mongoose
  // throws a CastError, Express 4 does not catch it from an async handler, and
  // Node exits.
  const stranger = await browser.newContext();
  const anon = await stranger.newPage();
  try {
    for (const bad of ["not-an-id", "../../etc/passwd", "1", "%00"]) {
      const res = await anon.request.get(`${API}/public/versions/${encodeURIComponent(bad)}`);
      expect(res.status(), `${bad} should be a 404`).toBe(404);
    }
    // The server is still alive afterwards, which is the actual assertion.
    const health = await anon.request.get("http://localhost:5002/healthz");
    expect(health.ok()).toBe(true);
  } finally {
    await stranger.close();
  }
});

test("only the author can publish a version", async ({ page, browser }) => {
  await signIn(page, "ada");
  const history = await api(page, "/code/history/paper.md?docType=prose");
  const adasVersion = history.data.find((v) => v.username === "ada");
  expect(adasVersion).toBeTruthy();

  const other = await browser.newContext();
  const gracePage = await other.newPage();
  try {
    await signIn(gracePage, "grace");
    const res = await api(gracePage, `/code/version/${adasVersion._id}/cite`, {
      method: "POST",
      body: { citable: true },
    });
    expect(res.status).toBe(403);
  } finally {
    await other.close();
  }
});
