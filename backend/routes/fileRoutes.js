const asyncHandler = require('../middleware/asyncHandler');
const express = require('express');
const auth = require('../middleware/auth');
const multer = require('multer');
const { UPLOAD_DIR, uploadFile, downloadFile, getRoomFiles, getRoomMessages, postRoomMessage } = require('../controllers/fileController');

const router = express.Router();

// Set up multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// POST /api/files/upload
router.post('/upload', auth, upload.single('file'), asyncHandler(uploadFile));

router.get('/:fileId/download', auth, asyncHandler(downloadFile));
router.get('/room/:roomId', auth, asyncHandler(getRoomFiles));
router.get('/room/:roomId/messages', auth, asyncHandler(getRoomMessages));
router.post('/room/:roomId/messages', auth, asyncHandler(postRoomMessage));

module.exports = router; 