const { test, expect } = require("@playwright/test");
const { signIn, openCodeEditor, typeInEditor, api } = require("./helpers");

/**
 * Saving, branching, merging and comparing, driven through the interface.
 *
 * The backend suites already prove the three-way merge is correct against a
 * version DAG. What they cannot prove is that a person can reach any of it: the
 * collaborative editor was fully tested and completely unreachable for exactly
 * that reason.
 *
 * Every test uses its own filename. Versions are keyed by filename and the
 * database is shared across the run, so a shared name would make each test
 * depend on the order the others ran in.
 */

const uniqueName = (label) => `${label}-${Date.now()}-${Math.floor(Math.random() * 1e4)}.js`;

/**
 * The branch selector.
 *
 * By id, not by label. getByLabel matches on a substring, so "Branch" also
 * finds "Branch to merge in" and "Branch to compare against", and the locator
 * resolves to three elements.
 */
const branchSelect = (page) => page.locator("#cp-branch");

/** Create a branch through the interface and wait for the switch to land. */
async function createBranch(page, name) {
  await page.getByLabel("New branch name").fill(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(branchSelect(page)).toHaveValue(name);
}

/** The id of the newest version on this document, which a branch points at. */
async function tipVersionId(page, filename) {
  const res = await api(page, `/code/history/${filename}`);
  expect(res.status).toBe(200);
  expect(res.data.length, "expected at least one saved version").toBeGreaterThan(0);
  return res.data[0]._id;
}

/** The version history sidebar, opened if it is not already showing. */
async function showHistory(page) {
  const button = page.getByRole("button", { name: "History" });
  if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
  await page.waitForSelector(".code-panel__history");
}

async function saveVersion(page) {
  await page.getByRole("button", { name: "Save version" }).click();
  await expect(page.getByRole("button", { name: /save version/i })).toBeEnabled();
}

test("a saved version appears in the history with the author's name", async ({ page }) => {
  const filename = uniqueName("save");
  await signIn(page, "ada");
  await openCodeEditor(page, { filename });

  await showHistory(page);
  await expect(page.getByText(/no versions saved yet/i)).toBeVisible();

  await typeInEditor(page, "const answer = 42;\n");
  await saveVersion(page);

  const history = page.locator(".code-panel__history");
  await expect(history.locator(".version-list__item")).toHaveCount(1);
  await expect(history.getByText("ada")).toBeVisible();
  await expect(history.getByText("current")).toBeVisible();
});

test("the second version becomes current and the first can be diffed against it", async ({ page }) => {
  const filename = uniqueName("diff");
  await signIn(page, "ada");
  await openCodeEditor(page, { filename });
  await showHistory(page);

  await typeInEditor(page, "const answer = 41;\n");
  await saveVersion(page);

  await typeInEditor(page, "// corrected\n");
  await saveVersion(page);

  const history = page.locator(".code-panel__history");
  await expect(history.locator(".version-list__item")).toHaveCount(2);

  // Only one version is current, and it is the newest, which is the first row.
  await expect(history.locator(".version-list__item--current")).toHaveCount(1);
  await expect(history.locator(".version-list__item").first()).toHaveClass(/current/);

  // The older row offers a diff against the one after it; the newest has
  // nothing newer to compare with.
  await expect(history.getByRole("button", { name: "View diff" })).toHaveCount(1);
  await history.getByRole("button", { name: "View diff" }).click();

  await expect(page.locator(".diff-pane")).toBeVisible();
  await expect(page.locator(".diff-pane")).toContainText("corrected");

  await page.locator(".diff-pane").getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".monaco-editor")).toBeVisible();
});

test("you cannot branch from a document with no versions", async ({ page }) => {
  // A branch points at a version. With nothing saved there is nothing to point
  // at, and the button says so rather than failing on the server.
  const filename = uniqueName("nobranch");
  await signIn(page, "ada");
  await openCodeEditor(page, { filename });

  await page.getByLabel("New branch name").fill("results");
  const create = page.getByRole("button", { name: "Create", exact: true });
  await expect(create).toBeDisabled();
  await expect(create).toHaveAttribute("title", /save a version/i);
});

test("a new branch is created, selected, and starts with no history of its own", async ({ page }) => {
  const filename = uniqueName("branch");
  await signIn(page, "ada");
  await openCodeEditor(page, { filename });
  await showHistory(page);

  await typeInEditor(page, "const shared = true;\n");
  await saveVersion(page);

  await page.getByLabel("New branch name").fill("results");
  await page.getByRole("button", { name: "Create", exact: true }).click();

  // Creating a branch switches to it, which is what git does and what anyone
  // who has used git will expect.
  await expect(branchSelect(page)).toHaveValue("results");
  await expect(page.locator(".panel__title-meta")).toHaveText("results");

  // The name field is cleared, so a second branch does not inherit the first.
  await expect(page.getByLabel("New branch name")).toHaveValue("");
});

test("a branch name that already exists is refused rather than silently reused", async ({ page }) => {
  // This was BUG-002. Branching to an existing name used to append a version to
  // that branch, so two people could think they had separate branches and be
  // writing into the same one.
  const filename = uniqueName("dupe");
  await signIn(page, "ada");
  await openCodeEditor(page, { filename });
  await showHistory(page);

  await typeInEditor(page, "const base = 1;\n");
  await saveVersion(page);

  const fromVersionId = await tipVersionId(page, filename);
  await createBranch(page, "results");

  // fromVersionId has to be real. Without it the request fails the required
  // fields check with a 400 and never reaches the duplicate check, so the test
  // would pass for entirely the wrong reason.
  const again = await api(page, "/code/branch", {
    method: "POST",
    body: { filename, branch: "results", fromVersionId },
  });
  expect(again.status).toBe(409);
  expect(String(again.data.error)).toMatch(/already exists/i);
});

test("a whitespace branch name never reaches the server", async ({ page }) => {
  // BUG-003. The old guard was `if (!branch)`, which accepts "   ". The branch
  // was created and then could not be selected or merged.
  const filename = uniqueName("blank");
  await signIn(page, "ada");
  await openCodeEditor(page, { filename });
  await showHistory(page);

  await typeInEditor(page, "const base = 1;\n");
  await saveVersion(page);

  await page.getByLabel("New branch name").fill("   ");
  await expect(page.getByRole("button", { name: "Create", exact: true })).toBeDisabled();

  // And the server refuses it too, in case anything else reaches that route.
  // Everything else in the request is valid, so a 400 can only be about the name.
  const fromVersionId = await tipVersionId(page, filename);
  const res = await api(page, "/code/branch", {
    method: "POST",
    body: { filename, branch: "   ", fromVersionId },
  });
  expect(res.status).toBe(400);
  expect(String(res.data.error)).toMatch(/branch name/i);
});

test("comparing two branches shows what differs between their tips", async ({ page }) => {
  const filename = uniqueName("compare");
  await signIn(page, "ada");
  await openCodeEditor(page, { filename });
  await showHistory(page);

  await typeInEditor(page, "const shared = true;\n");
  await saveVersion(page);

  await createBranch(page, "results");

  await typeInEditor(page, "const onlyOnResults = 1;\n");
  await saveVersion(page);

  await page.getByLabel("Branch to compare against").selectOption("main");
  await page.getByRole("button", { name: "Compare" }).click();

  const diff = page.locator(".diff-pane");
  await expect(diff).toBeVisible();
  await expect(diff).toContainText("onlyOnResults");
  await expect(diff.locator(".diff-pane__head")).toContainText("main to results");
});

test("merging a branch that changed a different line lands without conflicts", async ({ page }) => {
  const filename = uniqueName("merge");
  await signIn(page, "ada");
  await openCodeEditor(page, { filename });
  await showHistory(page);

  // A base, then a branch that appends to it. Appending touches a region main
  // never edited, so the three-way merge should resolve it on its own.
  await typeInEditor(page, "line one\nline two\n");
  await saveVersion(page);

  await createBranch(page, "addition");

  await typeInEditor(page, "line three\n");
  await saveVersion(page);

  await branchSelect(page).selectOption("main");
  await page.getByLabel("Branch to merge in").selectOption("addition");
  await page.getByRole("button", { name: "Merge" }).click();

  // No conflict banner, because nothing conflicted.
  await expect(page.locator(".notice--danger")).toHaveCount(0);

  const merged = await api(page, `/code/history/${filename}`);
  const onMain = merged.data.filter((v) => v.branch === "main");
  expect(onMain[0].content).toContain("line three");
  expect(onMain[0].hasConflicts).toBeFalsy();
});

test("a merge with genuinely conflicting edits says so instead of quietly writing markers", async ({ page }) => {
  const filename = uniqueName("conflict");
  await signIn(page, "ada");
  await openCodeEditor(page, { filename });
  await showHistory(page);

  await typeInEditor(page, "the effect was clear\n");
  await saveVersion(page);

  // Both branches rewrite the same line, which is the case a merge cannot
  // decide on its own.
  await createBranch(page, "revision");

  await page.keyboard.press("Control+a");
  await typeInEditor(page, "the effect was marginal\n");
  await saveVersion(page);

  await branchSelect(page).selectOption("main");
  await page.waitForTimeout(500);
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press("Control+a");
  await typeInEditor(page, "the effect was decisive\n");
  await saveVersion(page);

  await page.getByLabel("Branch to merge in").selectOption("revision");
  await page.getByRole("button", { name: "Merge" }).click();

  const banner = page.locator(".notice--danger");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(/unresolved conflict/i);
  await expect(banner).toContainText("revision");
  // It tells you what to search for, which is the only actionable part.
  await expect(banner).toContainText("<<<<<<<");

  await banner.getByRole("button", { name: "Dismiss" }).click();
  await expect(banner).toHaveCount(0);
});
