const { mergeDigIn } = require("node-diff3");

/**
 * Line-based three-way merge.
 *
 * The previous `mergeBranches` copied the source branch's content into the
 * target wholesale. It recorded that a merge happened but reconciled nothing,
 * so every edit made on the target since the branch point was silently thrown
 * away. Losing work quietly is worse than refusing to merge.
 *
 * A three-way merge diffs both sides against the version they diverged from.
 * Changes that touch different regions are applied from both sides; changes
 * that overlap are surfaced as conflicts rather than resolved by guessing.
 *
 * Line granularity is deliberate. Character-level merging produces results that
 * are technically minimal and unreadable to a human reviewing a document.
 */

const CONFLICT_START = "<<<<<<<";
const CONFLICT_MID = "=======";
const CONFLICT_END = ">>>>>>>";

const toLines = (text) => String(text == null ? "" : text).split("\n");

/**
 * @param {string} base    content at the common ancestor
 * @param {string} ours    content at the target branch tip
 * @param {string} theirs  content at the source branch tip
 * @param {{ourLabel?: string, theirLabel?: string}} labels
 * @returns {{content: string, conflicted: boolean, conflictCount: number}}
 */
const threeWayMerge = (base, ours, theirs, labels = {}) => {
  const ourLabel = labels.ourLabel || "ours";
  const theirLabel = labels.theirLabel || "theirs";

  // Identical sides need no merge, and an unchanged side is a fast-forward.
  if (ours === theirs) return { content: ours, conflicted: false, conflictCount: 0 };
  if (base === ours) return { content: theirs, conflicted: false, conflictCount: 0 };
  if (base === theirs) return { content: ours, conflicted: false, conflictCount: 0 };

  const result = mergeDigIn(toLines(ours), toLines(base), toLines(theirs));

  // Annotate the bare markers node-diff3 emits so a reader can tell which side
  // is which -- an unlabelled conflict block is guesswork.
  let conflictCount = 0;
  const lines = result.result.map((line) => {
    if (line === CONFLICT_START) {
      conflictCount += 1;
      return `${CONFLICT_START} ${ourLabel}`;
    }
    if (line === CONFLICT_END) return `${CONFLICT_END} ${theirLabel}`;
    if (line === CONFLICT_MID) return CONFLICT_MID;
    return line;
  });

  return {
    content: lines.join("\n"),
    conflicted: Boolean(result.conflict),
    conflictCount,
  };
};

module.exports = { threeWayMerge, CONFLICT_START, CONFLICT_MID, CONFLICT_END };
