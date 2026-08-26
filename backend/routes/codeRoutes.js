const express = require('express');
const auth = require('../middleware/auth');
const { saveCodeVersion, getCodeHistory, getCodeVersion, createBranch, getBranches, mergeBranches, setCitable, getCitation } = require('../controllers/codeController');
const codeCommentController = require('../controllers/codeCommentController');
const router = express.Router();

router.post('/save', auth, saveCodeVersion);
router.get('/history/:filename', auth, getCodeHistory);
router.get('/version/:versionId', auth, getCodeVersion);
router.post('/branch', auth, createBranch);
router.get('/branches/:filename', auth, getBranches);
router.post('/merge', auth, mergeBranches);
router.post('/version/:versionId/cite', auth, setCitable);
router.get('/version/:versionId/citation', auth, getCitation);
router.post('/comments', auth, codeCommentController.addComment);
router.get('/comments', auth, codeCommentController.getComments);
router.delete('/comments/:id', auth, codeCommentController.deleteComment);

module.exports = router; 