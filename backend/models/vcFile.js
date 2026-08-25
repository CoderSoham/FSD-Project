const mongoose = require('mongoose');

const vcFileSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  filename: { type: String, required: true },
  url: { type: String, required: true },
  mimetype: { type: String },
  size: { type: Number },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('VCFile', vcFileSchema); 