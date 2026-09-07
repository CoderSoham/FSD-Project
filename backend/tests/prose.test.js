/**
 * FEAT-004 acceptance test: prose documents inherit the versioning stack.
 *
 * The design claim being verified: because prose is versioned as Markdown
 * rather than ProseMirror JSON, every feature built for code applies to it
 * unchanged and stays legible to a human. If this test needed special-casing
 * for prose, the serialisation choice would be wrong.
 */
const { threeWayMerge } = require("../utils/threeWayMerge");

let failures = 0;
const check = (cond, msg) =>
  cond ? console.log("  ok -", msg) : (console.error("  FAIL -", msg), failures++);

const paper = (intro, method, results) =>
  ["# On Convergence", "", "## Introduction", "", intro, "", "## Method", "", method, "", "## Results", "", results].join("\n");

console.log("prose merges through the same path as code");

// Two co-authors editing different sections -- the everyday case.
{
  const base = paper("Prior work is limited.", "We ran a trial.", "Pending.");
  const ours = paper("Prior work is limited in scope and scale.", "We ran a trial.", "Pending.");
  const theirs = paper("Prior work is limited.", "We ran a trial.", "We observed a 12% shift.");

  const r = threeWayMerge(base, ours, theirs, { ourLabel: "main", theirLabel: "results-draft" });
  check(!r.conflicted, "edits to different sections merge without conflict");
  check(r.content.includes("scope and scale"), "the intro edit survives");
  check(r.content.includes("12% shift"), "the results edit survives");
  check(r.content.includes("## Method"), "untouched structure is preserved");
}

// Both rewriting the same sentence -- must conflict, not silently pick one.
{
  const base = paper("Prior work is limited.", "m", "r");
  const ours = paper("Prior work is sparse.", "m", "r");
  const theirs = paper("Prior work is thin.", "m", "r");

  const r = threeWayMerge(base, ours, theirs, { ourLabel: "main", theirLabel: "review" });
  check(r.conflicted, "the same sentence rewritten twice conflicts");
  check(r.content.includes("<<<<<<< main"), "conflict names the branch, in a paper too");
  check(
    r.content.includes("sparse") && r.content.includes("thin"),
    "neither author's wording is discarded"
  );
}

// Markdown structure means the diff is about prose, not about a node tree.
{
  const base = "# Title\n\nOne paragraph.";
  const ours = "# Title\n\nOne paragraph.\n\n## New section\n\nAdded text.";
  const r = threeWayMerge(base, ours, base);
  check(
    r.content.split("\n").some((l) => l === "## New section"),
    "an added heading appears as its own line, so it diffs as one change"
  );
  check(
    !r.content.includes('"type":'),
    "REGRESSION: content is Markdown, not serialised ProseMirror JSON"
  );
}

// A merged prose draft can carry markers; the editor must refuse to save it.
{
  const markers = "# Draft\n\n<<<<<<< main\nour line\n=======\ntheir line\n>>>>>>> review\n";
  const re = (md) => /^<{7}(\s|$)/m.test(md) || /^>{7}(\s|$)/m.test(md);
  check(re(markers), "conflict markers are detectable in saved Markdown");
  check(!re("# Clean draft\n\nNo markers here."), "clean prose is not flagged");
  check(
    !re("Discussing the <<<<<<< operator inline."),
    "markers are only matched at the start of a line, not mid-sentence"
  );
}

console.log(
  failures ? `\n${failures} check(s) FAILED` : "\nAll FEAT-004 acceptance checks passed."
);
process.exitCode = failures ? 1 : 0;
