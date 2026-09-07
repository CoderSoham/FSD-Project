const resolveIdentity = require('../middleware/identity');
const fs = require('fs');
const path = require('path');
const VCFile = require('../models/vcFile');
const VCMessage = require('../models/vcMessage');
const serverStore = require('../serverStore');
const { canAccessFile, resolveStoredPath } = require('../utils/fileAccess');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

/**
 * The uploads directory is not in the repository, and should not be: it holds
 * other people's files. But nothing created it either, so on a fresh clone
 * multer had nowhere to write and every upload came back as an opaque 500.
 * Create it once, at load.
 */
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * Everyone who may later fetch a file uploaded into this room.
 *
 * Captured at upload time because rooms do not persist -- serverStore holds
 * activeRooms in memory and drops a room when the call ends. Asking "is this
 * user in the room" a week later has no answer, so the answer is recorded now.
 */
const roomAudience = (roomId, uploaderId) => {
  const ids = new Set([String(uploaderId)]);
  try {
    const room = roomId ? serverStore.getActiveRoom(roomId) : null;
    (room?.participants || []).forEach((p) => p?.userId && ids.add(String(p.userId)));
  } catch (err) {
    // A missing room is normal for a file shared outside a live call; the
    // uploader still gets access.
  }
  return Array.from(ids);
};

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
    storedName: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size,
    allowedUserIds: roomAudience(roomId, userId),
  };
  let fileDoc = null;
  let messageDoc = null;
  if (roomId && userId && username) {
    // The download URL is derived from the document id, not the path on disk,
    // so possession of a filename grants nothing.
    fileDoc = await VCFile.create({ ...fileMeta, url: 'pending' });
    fileDoc.url = `/api/files/${fileDoc._id}/download`;
    await fileDoc.save();

    messageDoc = await VCMessage.create({
      roomId,
      userId,
      username,
      content: fileDoc.url,
      type: 'file',
      fileMeta: { ...fileMeta, url: fileDoc.url },
    });
  } else {
    // Nothing to attach it to and nobody but the uploader could reach it.
    fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
    return res.status(400).json({ error: 'roomId is required' });
  }

  res.status(201).json({
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    url: fileDoc.url,
    file: fileDoc,
    message: messageDoc,
  });
};

// GET /api/files/:fileId/download
const downloadFile = async (req, res) => {
  const { fileId } = req.params;
  if (!/^[0-9a-fA-F]{24}$/.test(fileId)) return res.status(404).json({ error: 'Not found' });

  const file = await VCFile.findById(fileId);
  if (!file) return res.status(404).json({ error: 'Not found' });

  const { userId } = await resolveIdentity(req);

  // 404 rather than 403: confirming a file exists is itself a disclosure.
  if (!canAccessFile(file, userId)) return res.status(404).json({ error: 'Not found' });

  const abs = resolveStoredPath(UPLOAD_DIR, file.storedName);
  if (!abs) return res.status(404).json({ error: 'Not found' });
  if (!fs.existsSync(abs)) return res.status(410).json({ error: 'File no longer stored' });

  return res.download(abs, file.filename);
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

module.exports = {
  UPLOAD_DIR, uploadFile, downloadFile, getRoomFiles, getRoomMessages, postRoomMessage }; 