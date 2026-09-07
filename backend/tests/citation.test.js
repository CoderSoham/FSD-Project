/**
 * FEAT-005 acceptance test: content hashing and citation formatting.
 *
 * The claim being verified: a reader who follows a citation can confirm the
 * text they are looking at is the text that was cited, without trusting this
 * server. That only holds if the hash is computed from content alone and is
 * stable.
 */
const { hashContent, shortHash, formatCitation } = require("../utils/citation");

let failures = 0;
const check = (cond, msg) =>
  cond ? console.log("  ok -", msg) : (console.error("  FAIL -", msg), failures++);

console.log("content hashing");
{
  const a = hashContent("# Title\n\nBody text.");
  const b = hashContent("# Title\n\nBody text.");
  const c = hashContent("# Title\n\nBody text!");

  check(a === b, "the same content always hashes the same");
  check(a !== c, "a one-character change produces a different hash");
  check(/^[0-9a-f]{64}$/.test(a), "the hash is a sha256 hex digest");
  check(hashContent("") === hashContent(null), "empty and null hash identically");
  check(
    a === require("crypto").createHash("sha256").update("# Title\n\nBody text.", "utf8").digest("hex"),
    "REGRESSION: a reader can recompute the hash independently"
  );
  check(shortHash(a).length === 12, "the short form is 12 characters");
}

console.log("\ncitation formatting");
{
  const version = {
    _id: "652f1c9e8a1b2c3d4e5f6071",
    filename: "On Convergence.md",
    username: "Ada Lovelace",
    branch: "main",
    timestamp: new Date("2026-03-14T09:30:00Z"),
    contentHash: hashContent("body"),
  };
  const c = formatCitation(version, "https://example.org");

  check(c.url === "https://example.org/v/652f1c9e8a1b2c3d4e5f6071", "the URL points at the version");
  check(c.text.includes("Ada Lovelace"), "the reference names the author");
  check(c.text.includes("On Convergence.md"), "the reference names the document");
  check(c.text.includes("2026-03-14"), "the reference carries the date");
  check(c.text.includes(c.shortHash), "the reference carries the short hash");
  check(c.bibtex.includes("@misc{"), "a BibTeX entry is produced");
  check(c.bibtex.includes(version.contentHash), "BibTeX carries the full hash for verification");
  check(
    /@misc\{[a-z0-9]+,/.test(c.bibtex),
    "the BibTeX key is sanitised to safe characters"
  );

  const trailing = formatCitation(version, "https://example.org/");
  check(trailing.url === c.url, "a trailing slash on the base URL does not double up");
}

console.log(
  failures ? `\n${failures} check(s) FAILED` : "\nAll FEAT-005 acceptance checks passed."
);
process.exitCode = failures ? 1 : 0;
