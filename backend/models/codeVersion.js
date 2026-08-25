const mongoose = require('mongoose');

const codeVersionSchema = new mongoose.Schema({
  filename: { type: String, required: true },
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