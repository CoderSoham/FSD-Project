const path = require("path");

/**
 * May this user fetch this file?
 *
 * The rule is deliberately narrow: the uploader, or someone recorded on the
 * file's access list at upload time. Room membership is not consulted at
 * download time because rooms do not persist -- serverStore holds them in
 * memory and drops them when the call ends, so a file outlives any room it
 * was shared in.
 */
const canAccessFile = (file, userId) => {
  if (!file || !userId) return false;
  const uid = String(userId);
  if (String(file.userId) === uid) return true;
  return (file.allowedUserIds || []).map(String).includes(uid);
};

/**
 * Resolve a stored filename to an absolute path inside the upload directory.
 * Returns null if the result would escape it.
 *
 * `storedName` is generated server-side, but it has passed through a database
 * and once originated near client input, so it is treated as untrusted.
 */
const resolveStoredPath = (uploadDir, storedName) => {
  if (!storedName) return null;
  const abs = path.join(uploadDir, path.basename(String(storedName)));
  return abs.startsWith(uploadDir + path.sep) ? abs : null;
};

module.exports = { canAccessFile, resolveStoredPath };
