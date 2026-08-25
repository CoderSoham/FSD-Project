const mongoose = require('mongoose');

const codeVersionSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  language: { type: String, required: true },
  content: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  parentVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CodeVersion', default: null },
  branch: { type: String, default: 'main' },
});

module.exports = mongoose.model('CodeVersion', codeVersionSchema); 