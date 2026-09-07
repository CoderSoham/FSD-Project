/**
 * FEAT-003 acceptance test: file access rules and path containment.
 *
 * The regression this guards against: `/uploads` was mounted with
 * express.static, so anyone who learned a filename could fetch an unpublished
 * research document. Upload required a token; download required nothing.
 */
const path = require("path");
const { canAccessFile, resolveStoredPath } = require("../utils/fileAccess");

let failures = 0;
const check = (cond, msg) =>
  cond ? console.log("  ok -", msg) : (console.error("  FAIL -", msg), failures++);

const file = {
  userId: "alice",
  allowedUserIds: ["alice", "bob"],
  storedName: "1720000000-42-paper.pdf",
};

console.log("access rules");
check(canAccessFile(file, "alice"), "uploader can fetch their own file");
check(canAccessFile(file, "bob"), "a user on the access list can fetch it");
check(!canAccessFile(file, "mallory"), "REGRESSION: a stranger cannot fetch it");
check(!canAccessFile(file, null), "an unauthenticated request is refused");
check(!canAccessFile(null, "alice"), "a missing file is refused");
check(
  !canAccessFile({ userId: "alice" }, "bob"),
  "absent access list does not grant access"
);
check(
  canAccessFile({ userId: 1, allowedUserIds: [2] }, "2"),
  "ids compare as strings, so an ObjectId and its string form match"
);

console.log("\npath containment");
const DIR = path.join("/srv", "app", "uploads");
check(
  resolveStoredPath(DIR, "1720000000-42-paper.pdf") ===
    path.join(DIR, "1720000000-42-paper.pdf"),
  "an ordinary stored name resolves inside the upload directory"
);
check(
  resolveStoredPath(DIR, "../../../etc/passwd") === path.join(DIR, "passwd"),
  "traversal is stripped rather than escaping the directory"
);
check(
  resolveStoredPath(DIR, "/etc/shadow") === path.join(DIR, "shadow"),
  "an absolute path is reduced to its basename"
);
check(resolveStoredPath(DIR, "") === null, "an empty stored name resolves to null");
check(resolveStoredPath(DIR, null) === null, "a missing stored name resolves to null");

console.log(
  failures ? `\n${failures} check(s) FAILED` : "\nAll FEAT-003 acceptance checks passed."
);
process.exitCode = failures ? 1 : 0;
