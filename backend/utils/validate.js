/**
 * Shared input checks.
 *
 * The ObjectId pattern was written out three separate times in three
 * controllers, which is exactly why several other routes never got it. One
 * copy, used everywhere.
 */

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const isObjectId = (value) => OBJECT_ID.test(String(value || ''));

/**
 * Normalise a branch name, or return null if it is not usable.
 *
 * The old check was `!branch`, which accepts "   ". A whitespace branch name
 * gets created, shows as a blank row in the branch list, and collides with any
 * other blank name once the git export sanitises it into a ref.
 */
const cleanBranchName = (value) => {
  const name = String(value == null ? '' : value).trim();
  if (!name) return null;
  if (name.length > 100) return null;
  return name;
};

module.exports = { isObjectId, cleanBranchName, OBJECT_ID };
