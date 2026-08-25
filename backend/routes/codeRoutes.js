const express = require('express');
const { saveCodeVersion, getCodeHistory, getCodeVersion, createBranch, getBranches, mergeBranches } = require('../controllers/codeController');
const codeCommentController = require('../controllers/codeCommentController');
const router = express.Router();

router.post('/save', saveCodeVersion);
router.get('/history/:filename', getCodeHistory);
router.get('/version/:versionId', getCodeVersion);
router.post('/branch', createBranch);
router.get('/branches/:filename', getBranches);
router.post('/merge', mergeBranches);
router.post('/comments', codeCommentController.addComment);
router.get('/comments', codeCommentController.getComments);
router.delete('/comments/:id', codeCommentController.deleteComment);

module.exports = router; 