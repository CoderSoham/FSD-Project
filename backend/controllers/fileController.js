const resolveIdentity = require('../middleware/identity');
const path = require('path');
const VCFile = require('../models/vcFile');
const VCMessage = require('../models/vcMessage');

// POST /api/files/upload
const uploadFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const { roomId } = req.body;
  const { userId, username } = await resolveIdentity(req);
  const fileMeta = {
    roomId,
    userId,
    username,
    filename: req.file.originalname,
    url: `/uploads/${req.file.filename}`,
    mimetype: req.file.mimetype,
    size: req.file.size,
  };
  let fileDoc = null;
  let messageDoc = null;
  if (roomId && userId && username) {
    fileDoc = await VCFile.create(fileMeta);
    messageDoc = await VCMessage.create({
      roomId,
      userId,
      username,
      content: fileMeta.url,
      type: 'file',
      fileMeta,
    });
  }
  res.status(201).json({
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    url: `/uploads/${req.file.filename}`,
    file: fileDoc,
    message: messageDoc,
  });
};

// GET /api/files/room/:roomId
const getRoomFiles = async (req, res) => {
  const { roomId } = req.params;
  const files = await VCFile.find({ roomId }).sort({ timestamp: 1 });
  res.json(files);
};

// GET /api/files/room/:roomId/messages
const getRoomMessages = async (req, res) => {
  const { roomId } = req.params;
  const messages = await VCMessage.find({ roomId }).sort({ timestamp: 1 });
  res.json(messages);
};

// POST /api/files/room/:roomId/messages
const postRoomMessage = async (req, res) => {
  const { roomId } = req.params;
  const { content, type = 'text' } = req.body;
  const { userId, username } = await resolveIdentity(req);
  if (!roomId || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const message = await VCMessage.create({
    roomId,
    userId,
    username,
    content,
    type,
    timestamp: new Date(),
  });
  res.status(201).json(message);
};

module.exports = { uploadFile, getRoomFiles, getRoomMessages, postRoomMessage }; 