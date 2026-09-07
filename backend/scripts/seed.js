/**
 * Seed a development database with users who are already friends.
 *
 * A fresh database is useless for trying the app: you cannot message anyone,
 * cannot open a room with anyone, and cannot test the collaborative editor
 * because there is nobody to collaborate with. Registering two accounts and
 * sending an invitation by hand before every test is friction that stops you
 * testing at all.
 *
 * This creates four accounts, all mutual friends, plus a document with a
 * branch and some history so the version UI has something in it.
 *
 * Every account uses the same password, printed below. This is only ever run
 * against a throwaway database.
 */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const User = require("../models/user");
const CodeVersion = require("../models/codeVersion");

const PASSWORD = "devpassword";

// example.com is reserved for documentation and examples, and unlike a made-up
// TLD such as .local it passes the server's Joi email validation.
const PEOPLE = [
  { username: "ada", mail: "ada@example.com" },
  { username: "grace", mail: "grace@example.com" },
  { username: "alan", mail: "alan@example.com" },
  { username: "katherine", mail: "katherine@example.com" },
];

const hash = (content) => crypto.createHash("sha256").update(content, "utf8").digest("hex");

const seed = async () => {
  const existing = await User.countDocuments();
  if (existing > 0) return { skipped: true, users: existing };

  const hashed = await bcrypt.hash(PASSWORD, 10);
  const users = await User.insertMany(
    PEOPLE.map((p) => ({ ...p, password: hashed, friends: [] }))
  );

  // Everyone is friends with everyone, so any account can call any other.
  await Promise.all(
    users.map((u) =>
      User.findByIdAndUpdate(u._id, {
        friends: users.filter((o) => String(o._id) !== String(u._id)).map((o) => o._id),
      })
    )
  );

  // A document with real history: two commits on main, a branch, and an edit
  // on it -- enough to exercise history, diff and merge without setting it up
  // by hand every time.
  const [ada, grace] = users;
  const v1Content = "# Convergence\n\n## Introduction\n\nPrior work is limited.\n";
  const v1 = await CodeVersion.create({
    filename: "paper.md", docType: "prose", language: "markdown",
    content: v1Content, contentHash: hash(v1Content),
    userId: String(ada._id), username: ada.username, branch: "main",
  });

  const v2Content = v1Content.replace("Prior work is limited.", "Prior work is limited in scope.");
  const v2 = await CodeVersion.create({
    filename: "paper.md", docType: "prose", language: "markdown",
    content: v2Content, contentHash: hash(v2Content),
    userId: String(ada._id), username: ada.username, branch: "main",
    parentVersionId: v1._id,
  });

  const v3Content = v1Content + "\n## Results\n\nWe measured a 12% shift.\n";
  await CodeVersion.create({
    filename: "paper.md", docType: "prose", language: "markdown",
    content: v3Content, contentHash: hash(v3Content),
    userId: String(grace._id), username: grace.username, branch: "results",
    parentVersionId: v1._id,
  });

  return { skipped: false, users: users.length, tip: v2._id };
};

const describe = (result) => {
  if (result.skipped) {
    console.log(`\n  Database already has ${result.users} users; not seeding.\n`);
    return;
  }
  console.log("\n  Seeded a development database.\n");
  console.log("  Sign in as any of these. They are all friends with each other:\n");
  PEOPLE.forEach((p) => console.log(`    ${p.mail.padEnd(22)} ${PASSWORD}`));
  console.log("\n  Open two browser profiles and sign in as two different people");
  console.log("  to try calls, screen share and the collaborative editor.\n");
  console.log("  'paper.md' has history on main and a 'results' branch to merge.\n");
};

module.exports = { seed, describe, PASSWORD, PEOPLE };

// Allow running standalone against whatever MONGO_URI points at.
if (require.main === module) {
  (async () => {
    require("dotenv").config();
    await mongoose.connect(process.env.MONGO_URI);
    describe(await seed());
    await mongoose.disconnect();
  })().catch((err) => {
    console.error("Seeding failed:", err.message);
    process.exit(1);
  });
}
