/**
 * Export a document's version history as a `git fast-import` stream.
 *
 * Researchers need their work to be able to leave the platform. Knowing it can
 * leave is what makes them willing to put it in.
 *
 * The mapping is close to exact, which is the whole reason to do it this way
 * rather than inventing a format:
 *
 *   CodeVersion        ->  commit
 *   parentVersionId    ->  first parent
 *   mergedFromVersionId->  second parent (a real merge commit)
 *   username           ->  author and committer
 *   timestamp          ->  author date
 *   branch             ->  ref
 *   content            ->  the file blob
 *
 * The result is a real repository: `git init && git fast-import < stream`.
 * "Our history is git-compatible" is a far easier thing for a research group
 * to trust than "we built versioning on MongoDB".
 */

const DEFAULT_EMAIL = "noreply@gitcord.local";

/** fast-import wants byte counts, not character counts. */
const dataBlock = (text) => {
  const buf = Buffer.from(text == null ? "" : String(text), "utf8");
  return `data ${buf.length}\n${buf.toString("utf8")}\n`;
};

const refFor = (branch) =>
  `refs/heads/${String(branch || "main").replace(/[^\w./-]+/g, "-")}`;

/** Git identity line. The name is escaped so a stray '<' cannot break the format. */
const identity = (username, email) =>
  `${String(username || "unknown").replace(/[<>\n]/g, " ").trim() || "unknown"} <${email || DEFAULT_EMAIL}>`;

const gitTime = (timestamp) =>
  `${Math.floor(new Date(timestamp || Date.now()).getTime() / 1000)} +0000`;

/**
 * Order versions so every parent is emitted before its children.
 *
 * fast-import resolves marks in order, so a commit that references a parent
 * mark not yet defined is a hard error. Timestamp order is almost right but
 * not guaranteed -- clocks and merges can invert it -- so this is a proper
 * topological sort with a timestamp tiebreak for determinism.
 */
const topoSort = (versions) => {
  const byId = new Map(versions.map((v) => [String(v._id), v]));
  const visited = new Set();
  const out = [];

  const visit = (id, stack) => {
    const key = String(id);
    if (visited.has(key) || !byId.has(key)) return;
    if (stack.has(key)) return; // cycle in bad data: stop rather than recurse forever
    stack.add(key);
    const v = byId.get(key);
    if (v.parentVersionId) visit(v.parentVersionId, stack);
    if (v.mergedFromVersionId) visit(v.mergedFromVersionId, stack);
    stack.delete(key);
    visited.add(key);
    out.push(v);
  };

  [...versions]
    .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
    .forEach((v) => visit(v._id, new Set()));

  return out;
};

/**
 * @param {Array} versions   every CodeVersion for one filename
 * @param {string} filename  path the content lives at inside the repo
 * @returns {string} a fast-import stream
 */
const buildFastImportStream = (versions, filename) => {
  if (!versions || versions.length === 0) return "";

  const ordered = topoSort(versions);
  const marks = new Map(); // version id -> mark number
  const path = String(filename || "document.txt").replace(/^\/+/, "");
  const primary = (ordered[ordered.length - 1] || {}).branch || "main";

  // fast-import ignores lines beginning with '#'. Without this the importer
  // ends up on an unborn 'master' with an empty working tree and no obvious
  // reason why, because the branches we create are named after the document's.
  const lines = [
    `# git fast-import stream exported from GitCord`,
    `# document: ${path}`,
    `#`,
    `#   git init my-paper && cd my-paper`,
    `#   git fast-import < this-file`,
    `#   git checkout ${primary}`,
    `#`,
  ];
  let mark = 0;

  ordered.forEach((v) => {
    const id = String(v._id);
    const commitMark = ++mark;
    const parentMark = v.parentVersionId ? marks.get(String(v.parentVersionId)) : null;
    const mergeMark = v.mergedFromVersionId ? marks.get(String(v.mergedFromVersionId)) : null;

    const message =
      (v.mergedFromVersionId
        ? `Merge into ${v.branch || "main"}`
        : `Version ${String(v.contentHash || id).slice(0, 12)}`) +
      `\n\nBranch: ${v.branch || "main"}\nVersion-Id: ${id}` +
      (v.contentHash ? `\nContent-Sha256: ${v.contentHash}` : "") +
      (v.hasConflicts ? `\nUnresolved-Conflicts: ${v.conflictCount || 0}` : "");

    lines.push(`commit ${refFor(v.branch)}`);
    lines.push(`mark :${commitMark}`);
    lines.push(`author ${identity(v.username)} ${gitTime(v.timestamp)}`);
    lines.push(`committer ${identity(v.username)} ${gitTime(v.timestamp)}`);
    lines.push(dataBlock(message).trimEnd());

    // `from` is only valid on the first commit of a ref or when re-pointing it.
    if (parentMark) lines.push(`from :${parentMark}`);
    if (mergeMark) lines.push(`merge :${mergeMark}`);

    lines.push(`M 100644 inline ${path}`);
    lines.push(dataBlock(v.content).trimEnd());
    lines.push("");

    marks.set(id, commitMark);
  });

  return lines.join("\n") + "\n";
};

module.exports = { buildFastImportStream, topoSort, refFor, identity, dataBlock };
