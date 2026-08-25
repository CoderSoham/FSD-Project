const mongoose = require("mongoose");

/**
 * Persisted CRDT state for a live editing session.
 *
 * The old handler kept session content in a module-level object, so a restart
 * or a second server instance lost every in-flight edit. Yjs state is a single
 * binary blob that can be encoded, stored, and reloaded, so the live document
 * survives the process.
 *
 * This is distinct from CodeVersion. This is the *working copy*; CodeVersion
 * records are the named history a user chooses to save.
 */
const codeSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  state: { type: Buffer, required: true },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CodeSession", codeSessionSchema);
