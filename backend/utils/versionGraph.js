const CodeVersion = require("../models/codeVersion");

/**
 * Walking the version DAG.
 *
 * Versions link to their parent through `parentVersionId`, and a merge
 * additionally records `mergedFromVersionId`, so the history is a directed
 * acyclic graph rather than a set of independent lists. That is what makes a
 * real three-way merge possible: given two branch tips we can find the version
 * they diverged from and diff each side against it.
 */

const MAX_WALK = 5000; // guard against a cycle introduced by bad data

/**
 * Ancestors of a version, nearest first, including the version itself.
 * Follows both parent links so merged history is reachable.
 */
const mongoLoader = (id) =>
  CodeVersion.findById(id).select("parentVersionId mergedFromVersionId");

const ancestryOf = async (versionId, load = mongoLoader) => {
  const seen = new Set();
  const order = [];
  const queue = [String(versionId)];

  while (queue.length && order.length < MAX_WALK) {
    const id = queue.shift();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    order.push(id);

    const v = await load(id);
    if (!v) continue;
    if (v.parentVersionId) queue.push(String(v.parentVersionId));
    if (v.mergedFromVersionId) queue.push(String(v.mergedFromVersionId));
  }
  return order;
};

/**
 * Lowest common ancestor of two versions.
 *
 * Returns the first ancestor of `aId` that also appears in `bId`'s ancestry.
 * Because `ancestryOf` returns nearest-first, the first hit is the closest
 * shared version -- the base a three-way merge needs.
 *
 * Returns null when the two share no history, in which case the caller has to
 * treat every line as added on both sides.
 *
 * `load` is injectable so the walk can be tested against an in-memory graph
 * without standing up Mongo.
 */
const findCommonAncestor = async (aId, bId, load = mongoLoader) => {
  if (!aId || !bId) return null;
  const [aAnc, bAnc] = await Promise.all([ancestryOf(aId, load), ancestryOf(bId, load)]);
  const bSet = new Set(bAnc);
  return aAnc.find((id) => bSet.has(id)) || null;
};

/** Latest version on a branch, or null. */
const tipOf = (filename, branch) =>
  CodeVersion.findOne({ filename, branch }).sort({ timestamp: -1 });

module.exports = { ancestryOf, findCommonAncestor, tipOf };
