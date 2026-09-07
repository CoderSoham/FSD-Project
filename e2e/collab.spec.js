const { test, expect } = require("@playwright/test");
const { signIn, openCodeEditor, typeInEditor, editorText } = require("./helpers");

/**
 * Collaborative editing, with two real browsers.
 *
 * This is the claim the whole product rests on and the one nothing else can
 * check. The CRDT unit tests prove that Yjs converges, which was never in
 * doubt. What they cannot prove is that the app is wired to it: that opening
 * the editor actually joins a session, that edits reach the server, and that
 * another person sees them.
 *
 * They did not, as it turned out. AppBar rendered the editor without a
 * sessionId, so the effect that opens the session returned early every time.
 * Everything was tested and nothing was connected.
 */

// openCodeEditor, typeInEditor and editorText live in ./helpers, because the
// versioning and citation specs need exactly the same three.

test("two people editing one document see each other's text", async ({ browser }) => {
  const ada = await browser.newContext();
  const grace = await browser.newContext();
  const pageA = await ada.newPage();
  const pageB = await grace.newPage();

  try {
    await signIn(pageA, "ada");
    await signIn(pageB, "grace");

    await openCodeEditor(pageA);
    await openCodeEditor(pageB);

    // Both default to code.js on main, so both derive the same session id.

    await typeInEditor(pageA, "// written by ada\n");

    // Wait for it to travel: A -> server -> B.
    await expect
      .poll(async () => (await editorText(pageB)) || "", { timeout: 15_000 })
      .toContain("written by ada");

    // And the other direction, which proves the relay is not one way.
    await typeInEditor(pageB, "// written by grace\n");

    await expect
      .poll(async () => (await editorText(pageA)) || "", { timeout: 15_000 })
      .toContain("written by grace");

    // Neither edit displaced the other.
    const finalA = await editorText(pageA);
    expect(finalA).toContain("written by ada");
    expect(finalA).toContain("written by grace");
  } finally {
    await ada.close();
    await grace.close();
  }
});

test("an edit made while disconnected arrives after reconnecting", async ({ browser }) => {
  const ada = await browser.newContext();
  const grace = await browser.newContext();
  const pageA = await ada.newPage();
  const pageB = await grace.newPage();

  try {
    await signIn(pageA, "ada");
    await signIn(pageB, "grace");
    await openCodeEditor(pageA);
    await openCodeEditor(pageB);

    // Establish a shared baseline first.
    await typeInEditor(pageA, "// baseline\n");
    await expect
      .poll(async () => (await editorText(pageB)) || "", { timeout: 15_000 })
      .toContain("baseline");

    // Cut B off, then edit on A. A CRDT should reconcile this on reconnect;
    // the old whole-document broadcast could not.
    await pageB.context().setOffline(true);
    await typeInEditor(pageA, "// added while grace was away\n");
    await pageA.waitForTimeout(500);

    await pageB.context().setOffline(false);

    await expect
      .poll(async () => (await editorText(pageB)) || "", { timeout: 25_000 })
      .toContain("added while grace was away");
  } finally {
    await ada.close();
    await grace.close();
  }
});
