const User = require("../models/user");

/**
 * Resolve who is making this request from the verified JWT.
 *
 * Every controller previously read `userId` and `username` out of `req.body`,
 * which means a client could claim to be anyone. For a tool whose whole purpose
 * is an auditable record of who changed a document and when, forgeable
 * authorship is not a small bug -- it makes the history worthless.
 *
 * The token payload carries `userId` and `mail`; the display name is looked up,
 * falling back to the mail address so a version is never attributed to nobody.
 */
const resolveIdentity = async (req) => {
  const userId = req.user && req.user.userId;
  if (!userId) {
    throw new Error("resolveIdentity called without an authenticated request");
  }
  const user = await User.findById(userId).select("username mail");
  return {
    userId: String(userId),
    username: (user && (user.username || user.mail)) || req.user.mail || "unknown",
  };
};

module.exports = resolveIdentity;
