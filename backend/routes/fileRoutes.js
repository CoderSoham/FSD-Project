const express = require('express');
const multer = require('multer');
const path = require('path');
const { uploadFile, getRoomFiles, getRoomMessages, postRoomMessage } = require('../controllers/fileController');

const router = express.Router();

// Set up multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// POST /api/files/upload
router.post('/upload', upload.single('file'), uploadFile);

router.get('/room/:roomId', getRoomFiles);
router.get('/room/:roomId/messages', getRoomMessages);
router.post('/room/:roomId/messages', postRoomMessage);

module.exports = router; 