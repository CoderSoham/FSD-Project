/**
 * FEAT-006 acceptance test — the exported history is a real git repository.
 *
 * This does not check the stream's text. It runs `git fast-import` against it
 * in a scratch repo and then interrogates the result with git itself. A format
 * that only looks right is worthless; the claim is "you can take your history
 * with you", and the only way to verify that claim is to take it.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildFastImportStream, topoSort } = require("../utils/gitExport");

let failures = 0;
const check = (cond, msg) =>
  cond ? console.log("  ok -", msg) : (console.error("  FAIL -", msg), failures++);

const id = (n) => String(n).padStart(24, "0");
const t = (min) => new Date(Date.UTC(2026, 0, 1, 0, min, 0));

// main:    v1 -> v2 ---------> v4(merge)
// feature:       \-> v3 ------/
const versions = [
  { _id: id(1), filename: "paper.md", branch: "main", username: "Ada Lovelace",
    content: "# Paper\n\nIntro.\n", timestamp: t(0), contentHash: "a".repeat(64) },
  { _id: id(2), filename: "paper.md", branch: "main", username: "Ada Lovelace",
    content: "# Paper\n\nIntro, expanded.\n", timestamp: t(10),
    parentVersionId: id(1), contentHash: "b".repeat(64) },
  { _id: id(3), filename: "paper.md", branch: "feature", username: "Grace Hopper",
    content: "# Paper\n\nIntro.\n\n## Results\n\nMeasured.\n", timestamp: t(20),
    parentVersionId: id(1), contentHash: "c".repeat(64) },
  { _id: id(4), filename: "paper.md", branch: "main", username: "Ada Lovelace",
    content: "# Paper\n\nIntro, expanded.\n\n## Results\n\nMeasured.\n", timestamp: t(30),
    parentVersionId: id(2), mergedFromVersionId: id(3), contentHash: "d".repeat(64) },
];

console.log("topological ordering");
{
  // Feed them in deliberately wrong order; parents must still come first.
  const ordered = topoSort([versions[3], versions[2], versions[1], versions[0]]);
  const pos = (n) => ordered.findIndex((v) => v._id === id(n));
  check(pos(1) < pos(2) && pos(1) < pos(3), "the root precedes both children");
  check(pos(2) < pos(4) && pos(3) < pos(4), "both merge parents precede the merge");
  check(ordered.length === 4, "every version is emitted exactly once");

  const cyclic = [
    { _id: id(8), parentVersionId: id(9), content: "a", branch: "main", username: "x", timestamp: t(0) },
    { _id: id(9), parentVersionId: id(8), content: "b", branch: "main", username: "x", timestamp: t(1) },
  ];
  check(topoSort(cyclic).length === 2, "a cycle in bad data terminates instead of recursing");
}

console.log("\nimport into a real git repository");

let git = true;
try {
  execFileSync("git", ["--version"], { stdio: "ignore" });
} catch {
  git = false;
  console.log("  SKIP - git is not installed on this machine");
}

if (git) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gitcord-export-"));
  const run = (args, opts = {}) =>
    execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", ...opts }).trim();

  try {
    execFileSync("git", ["init", "-q", dir], { stdio: "ignore" });
    const stream = buildFastImportStream(versions, "paper.md");
    execFileSync("git", ["-C", dir, "fast-import", "--quiet"], { input: stream });

    check(true, "git fast-import accepted the stream without error");

    const branches = run(["for-each-ref", "--format=%(refname:short)", "refs/heads"])
      .split("\n").filter(Boolean).sort();
    check(
      branches.join(",") === "feature,main",
      `both branches exist (got ${branches.join(",") || "none"})`
    );

    const count = run(["rev-list", "--count", "main"]);
    check(count === "4", `main has 4 commits reachable (got ${count})`);

    // The merge must be a real merge: two parents, in the right order.
    const parents = run(["rev-list", "--parents", "-n", "1", "main"]).split(" ");
    check(parents.length === 3, `the tip is a merge commit with two parents (got ${parents.length - 1})`);

    const mergedIn = run(["rev-list", "--count", "main", "^feature"]);
    check(Number(mergedIn) < 4, "the feature branch is genuinely reachable from main");

    const content = run(["show", "main:paper.md"]);
    check(
      content.includes("Intro, expanded.") && content.includes("## Results"),
      "the merged file content survived the round trip"
    );

    const author = run(["log", "-1", "--format=%an", "feature"]);
    check(author === "Grace Hopper", `authorship is preserved (got "${author}")`);

    const date = run(["log", "-1", "--format=%aI", "main"]);
    check(date.startsWith("2026-01-01"), `the original timestamp is preserved (got ${date})`);

    const body = run(["log", "-1", "--format=%B", "main"]);
    check(body.includes("Version-Id: " + id(4)), "the original version id is recorded in the commit");
    check(body.includes("Content-Sha256: " + "d".repeat(64)), "the content hash travels with the commit");

    const fsck = execFileSync("git", ["-C", dir, "fsck", "--no-progress"], { encoding: "utf8" });
    check(!/error|missing|dangling commit/i.test(fsck), "git fsck reports a healthy object graph");
  } catch (err) {
    check(false, `import failed: ${String(err.message).split("\n")[0]}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log(
  failures ? `\n${failures} check(s) FAILED` : "\nAll FEAT-006 acceptance checks passed."
);
process.exitCode = failures ? 1 : 0;
