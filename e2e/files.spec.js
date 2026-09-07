const { test, expect } = require("@playwright/test");
const { signIn, api, API } = require("./helpers");

/**
 * File sharing and who can reach what.
 *
 * Files used to be served straight out of the uploads directory by name, so
 * anyone who could guess a filename could fetch it. Downloads now go through a
 * document id and an access check.
 *
 * The check that matters is the negative one: a stranger must get the same
 * answer for a file that exists and one that does not, because saying "403" for
 * the first tells them the file is there.
 */

/** Upload a small file from inside a signed in page. */
async function upload(page, { roomId, name, body }) {
  return page.evaluate(
    async ({ apiBase, roomId, name, body }) => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const form = new FormData();
      form.append("file", new Blob([body], { type: "text/plain" }), name);
      form.append("roomId", roomId);
      const res = await fetch(`${apiBase}/files/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user.token}` },
        body: form,
      });
      return { status: res.status, data: await res.json().catch(() => null) };
    },
    { apiBase: API, roomId, name, body }
  );
}

const roomId = () => `room-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

test("an uploaded file comes back with the content that went in", async ({ page }) => {
  await signIn(page, "ada");
  const room = roomId();

  const res = await upload(page, { roomId: room, name: "notes.txt", body: "measured a 12% shift" });
  expect(res.status).toBe(201);
  expect(res.data.originalname).toBe("notes.txt");

  // The URL is built from the document id, so knowing the filename gets you
  // nothing.
  expect(res.data.url).toMatch(/^\/api\/files\/[0-9a-f]{24}\/download$/);

  const download = await page.request.get(`http://localhost:5002${res.data.url}`, {
    headers: {
      Authorization: `Bearer ${await page.evaluate(
        () => JSON.parse(localStorage.getItem("user")).token
      )}`,
    },
  });
  expect(download.status()).toBe(200);
  expect(await download.text()).toBe("measured a 12% shift");
});

test("a file with no room is refused, since nobody could reach it anyway", async ({ page }) => {
  await signIn(page, "ada");
  const res = await upload(page, { roomId: "", name: "orphan.txt", body: "x" });
  expect(res.status).toBe(400);
  expect(String(res.data.error)).toMatch(/roomId/i);
});

test("someone outside the room gets a 404, not a 403", async ({ page, browser }) => {
  await signIn(page, "ada");
  const room = roomId();
  const uploaded = await upload(page, { roomId: room, name: "private.txt", body: "not for you" });
  const url = `http://localhost:5002${uploaded.data.url}`;

  const other = await browser.newContext();
  const gracePage = await other.newPage();
  try {
    await signIn(gracePage, "grace");
    const token = await gracePage.evaluate(() => JSON.parse(localStorage.getItem("user")).token);

    const real = await gracePage.request.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const invented = await gracePage.request.get(
      `http://localhost:5002/api/files/${"0".repeat(24)}/download`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // The point is not just that access is denied. It is that both answers are
    // identical, so nothing is learned from the difference.
    expect(real.status()).toBe(404);
    expect(invented.status()).toBe(404);
    expect(await real.text()).toBe(await invented.text());
  } finally {
    await other.close();
  }
});

test("a download needs a token at all", async ({ page, browser }) => {
  await signIn(page, "ada");
  const uploaded = await upload(page, {
    roomId: roomId(),
    name: "auth.txt",
    body: "needs a token",
  });

  const stranger = await browser.newContext();
  const anon = await stranger.newPage();
  try {
    const res = await anon.request.get(`http://localhost:5002${uploaded.data.url}`);
    expect([401, 403]).toContain(res.status());
  } finally {
    await stranger.close();
  }
});

test("a malformed file id is a 404 and leaves the API running", async ({ page }) => {
  await signIn(page, "ada");
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem("user")).token);

  for (const bad of ["nope", "../../../etc/passwd", "12345"]) {
    const res = await page.request.get(
      `http://localhost:5002/api/files/${encodeURIComponent(bad)}/download`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(res.status(), `${bad} should be a 404`).toBe(404);
  }

  const health = await page.request.get("http://localhost:5002/healthz");
  expect(health.ok()).toBe(true);
});

test("a room lists its own files and nobody else's", async ({ page }) => {
  await signIn(page, "ada");
  const mine = roomId();
  const theirs = roomId();

  await upload(page, { roomId: mine, name: "a.txt", body: "a" });
  await upload(page, { roomId: mine, name: "b.txt", body: "b" });
  await upload(page, { roomId: theirs, name: "c.txt", body: "c" });

  const listed = await api(page, `/files/room/${mine}`);
  expect(listed.status).toBe(200);
  const names = listed.data.map((f) => f.filename).sort();
  expect(names).toEqual(["a.txt", "b.txt"]);
});

test("an empty room lists nothing rather than failing", async ({ page }) => {
  await signIn(page, "ada");
  const listed = await api(page, `/files/room/${roomId()}`);
  expect(listed.status).toBe(200);
  expect(listed.data).toEqual([]);
});
