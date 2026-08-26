const crypto = require("crypto");

/**
 * Citable versions.
 *
 * Versions are already immutable and already have ids, which is most of what a
 * citation needs. What was missing is a way to point at one from outside the
 * app, and a way for the reader to check that what they are looking at is what
 * was cited.
 *
 * The hash is that check. It is computed from the content alone, so anyone
 * holding the text can recompute it without trusting us.
 */

const hashContent = (content) =>
  crypto.createHash("sha256").update(String(content == null ? "" : content), "utf8").digest("hex");

/** Short form for display. Long enough to be unambiguous in one document. */
const shortHash = (hash) => String(hash || "").slice(0, 12);

/**
 * A reference a person can paste into a paper.
 *
 * Deliberately plain text rather than BibTeX or CSL: the common case is
 * dropping it into a footnote or an email, and a format nobody has to install
 * a tool to read is the one that gets used. `bibtex` is offered alongside for
 * people who do want it.
 */
const formatCitation = (version, baseUrl) => {
  const url = `${String(baseUrl || "").replace(/\/+$/, "")}/v/${version._id}`;
  const date = new Date(version.timestamp || Date.now());
  const iso = date.toISOString().slice(0, 10);
  const year = date.getUTCFullYear();
  const title = version.filename || "Untitled";
  const short = shortHash(version.contentHash);

  const text =
    `${version.username}. "${title}" (version ${short}, branch ${version.branch}). ` +
    `${iso}. ${url}`;

  const key = `${String(version.username || "anon").replace(/\W+/g, "").toLowerCase()}${year}${short.slice(0, 6)}`;

  const bibtex = [
    `@misc{${key},`,
    `  author = {${version.username}},`,
    `  title = {${title}},`,
    `  year = {${year}},`,
    `  note = {Version ${short}, branch ${version.branch}, sha256 ${version.contentHash}},`,
    `  url = {${url}}`,
    `}`,
  ].join("\n");

  return { url, text, bibtex, shortHash: short, date: iso };
};

module.exports = { hashContent, shortHash, formatCitation };
