const asyncHandler = require('../middleware/asyncHandler');
const express = require('express');
const auth = require('../middleware/auth');
const { saveCodeVersion, getCodeHistory, getCodeVersion, createBranch, getBranches, mergeBranches, setCitable, getCitation, exportHistory } = require('../controllers/codeController');
const codeCommentController = require('../controllers/codeCommentController');
const router = express.Router();

router.post('/save', auth, asyncHandler(saveCodeVersion));
router.get('/history/:filename', auth, asyncHandler(getCodeHistory));
router.get('/version/:versionId', auth, asyncHandler(getCodeVersion));
router.post('/branch', auth, asyncHandler(createBranch));
router.get('/branches/:filename', auth, asyncHandler(getBranches));
router.post('/merge', auth, asyncHandler(mergeBranches));
router.post('/version/:versionId/cite', auth, asyncHandler(setCitable));
router.get('/version/:versionId/citation', auth, asyncHandler(getCitation));
router.get('/export/:filename', auth, asyncHandler(exportHistory));
router.post('/comments', auth, asyncHandler(codeCommentController.addComment));
router.get('/comments', auth, asyncHandler(codeCommentController.getComments));
router.delete('/comments/:id', auth, asyncHandler(codeCommentController.deleteComment));

module.exports = router; 