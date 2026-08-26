const mongoose = require('mongoose');

const codeVersionSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  // 'code' versions store source text; 'prose' versions store Markdown.
  //
  // Prose is serialised to Markdown rather than ProseMirror JSON specifically
  // so that diffs, three-way merges and conflict blocks stay readable. A
  // line-based merge over pretty-printed JSON would technically work and would
  // be useless to a human reviewing a paper.
  docType: { type: String, enum: ['code', 'prose'], default: 'code', index: true },
  language: { type: String, required: true },
  content: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  parentVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CodeVersion', default: null },
  // A merge has two parents. Without this the graph cannot represent that a
  // merge happened, which makes the history a lie and blocks a faithful export.
  mergedFromVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CodeVersion', default: null },
  hasConflicts: { type: Boolean, default: false },
  conflictCount: { type: Number, default: 0 },
  branch: { type: String, default: 'main' },
});

module.exports = mongoose.model('CodeVersion', codeVersionSchema); 