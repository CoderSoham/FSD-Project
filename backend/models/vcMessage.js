const mongoose = require('mongoose');

const vcMessageSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  content: { type: String }, // text or file URL
  type: { type: String, enum: ['text', 'file'], default: 'text' },
  fileMeta: {
    filename: String,
    url: String,
    mimetype: String,
    size: Number,
  },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('VCMessage', vcMessageSchema); 