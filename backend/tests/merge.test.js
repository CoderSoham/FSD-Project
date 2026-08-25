/**
 * FEAT-002 acceptance test — three-way merge and the version DAG walk.
 *
 * The regression this guards against: the previous mergeBranches copied the
 * source branch's content into the target verbatim, so every edit made on the
 * target since the branch point vanished with no warning.
 */
const { threeWayMerge } = require("../utils/threeWayMerge");
const { findCommonAncestor, ancestryOf } = require("../utils/versionGraph");

let failures = 0;
const fail = (m) => { console.error("  FAIL -", m); failures++; };
const ok = (m) => console.log("  ok -", m);
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

const doc = (...lines) => lines.join("\n");

console.log("three-way merge");

// --- the regression: separated edits on both sides must both survive
{
  const base = doc("# Paper", "", "intro", "", "method", "", "results");
  const ours = doc("# Paper", "", "intro rewritten by A", "", "method", "", "results");
  const theirs = doc("# Paper", "", "intro", "", "method", "", "results measured by B");

  const r = threeWayMerge(base, ours, theirs, { ourLabel: "main", theirLabel: "feature" });
  check(!r.conflicted, "separated edits merge without conflict");
  check(r.content.includes("rewritten by A"), "our edit survives the merge");
  check(r.content.includes("measured by B"), "their edit survives the merge");
}

// --- overlapping edits must conflict, not silently pick a winner
{
  const base = doc("x", "the shared line", "y");
  const ours = doc("x", "MY version of the line", "y");
  const theirs = doc("x", "THEIR version of the line", "y");

  const r = threeWayMerge(base, ours, theirs, { ourLabel: "main", theirLabel: "feature" });
  check(r.conflicted, "overlapping edits are reported as a conflict");
  check(r.conflictCount === 1, `conflict count is 1 (got ${r.conflictCount})`);
  check(r.content.includes("<<<<<<< main"), "conflict block names our branch");
  check(r.content.includes(">>>>>>> feature"), "conflict block names their branch");
  check(
    r.content.includes("MY version") && r.content.includes("THEIR version"),
    "both sides are preserved inside the conflict block"
  );
}

// --- fast-forward cases
{
  const base = doc("a", "b");
  check(
    threeWayMerge(base, base, doc("a", "b", "c")).content === doc("a", "b", "c"),
    "target unchanged -> takes the source (fast-forward)"
  );
  check(
    threeWayMerge(base, doc("a", "b", "c"), base).content === doc("a", "b", "c"),
    "source unchanged -> keeps the target, does not revert it"
  );
  check(
    threeWayMerge(base, base, base).conflicted === false,
    "identical sides produce no conflict"
  );
}

// --- the exact bug: old behaviour would have returned `theirs` and lost `ours`
{
  const base = doc("l1", "l2", "l3", "l4", "l5", "l6");
  const ours = doc("l1-EDITED-ON-TARGET", "l2", "l3", "l4", "l5", "l6");
  const theirs = doc("l1", "l2", "l3", "l4", "l5", "l6-EDITED-ON-SOURCE");

  const r = threeWayMerge(base, ours, theirs);
  check(
    r.content.includes("EDITED-ON-TARGET"),
    "REGRESSION: target-branch work is not discarded by a merge"
  );
}

console.log("\nversion DAG walk");

// in-memory graph:  A -> B -> C (main)
//                        \-> D -> E (feature)
{
  const graph = {
    A: {}, B: { parentVersionId: "A" }, C: { parentVersionId: "B" },
    D: { parentVersionId: "B" }, E: { parentVersionId: "D" },
  };
  const load = async (id) => graph[id] || null;

  (async () => {
    const lca = await findCommonAncestor("C", "E", load);
    check(lca === "B", `lowest common ancestor of C and E is B (got ${lca})`);

    const anc = await ancestryOf("E", load);
    check(anc.join(">") === "E>D>B>A", `ancestry of E is E>D>B>A (got ${anc.join(">")})`);

    // unrelated histories
    const other = { Z: {} };
    const load2 = async (id) => graph[id] || other[id] || null;
    check((await findCommonAncestor("C", "Z", load2)) === null,
      "unrelated histories report no common ancestor");

    // a merge commit's second parent must be reachable
    const merged = { ...graph, M: { parentVersionId: "C", mergedFromVersionId: "E" } };
    const loadM = async (id) => merged[id] || null;
    const ancM = await ancestryOf("M", loadM);
    check(ancM.includes("E") && ancM.includes("D"),
      "merge commit reaches both parents' history");

    // a cycle from bad data must not hang the walk
    const cyclic = { P: { parentVersionId: "Q" }, Q: { parentVersionId: "P" } };
    const ancC = await ancestryOf("P", async (id) => cyclic[id] || null);
    check(ancC.length === 2, `cycle terminates instead of looping (visited ${ancC.length})`);

    console.log(
      failures ? `\n${failures} check(s) FAILED` : "\nAll FEAT-002 acceptance checks passed."
    );
    process.exitCode = failures ? 1 : 0;
  })();
}
