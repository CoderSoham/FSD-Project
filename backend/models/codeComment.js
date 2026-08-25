const mongoose = require('mongoose');

const codeCommentSchema = new mongoose.Schema({
  codeVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CodeVersion', required: true },
  filename: { type: String, required: true },
  branch: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  text: { type: String, required: true },
  position: {
    startLine: { type: Number, required: true },
    startColumn: { type: Number, required: true },
    endLine: { type: Number },
    endColumn: { type: Number },
  },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CodeComment', codeCommentSchema); 