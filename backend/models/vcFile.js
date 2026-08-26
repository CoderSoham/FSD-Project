const mongoose = require('mongoose');

const vcFileSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  filename: { type: String, required: true },
  // Name on disk. Kept separate from `filename` (what the user called it) so a
  // download can set a friendly name while the stored path stays opaque.
  storedName: { type: String },
  url: { type: String, required: true },
  mimetype: { type: String },
  size: { type: Number },
  // Who may fetch this file.
  //
  // Rooms are ephemeral -- serverStore keeps activeRooms in memory and a room
  // ceases to exist when the call ends. Files outlive the call, so "is the
  // requester in the room" is unanswerable a day later. The access list is
  // therefore captured at upload time and stored with the file.
  allowedUserIds: { type: [String], default: [] },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('VCFile', vcFileSchema); 