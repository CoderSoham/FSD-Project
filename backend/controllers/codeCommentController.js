const resolveIdentity = require('../middleware/identity');
const CodeComment = require('../models/codeComment');

// POST /api/code/comments
const addComment = async (req, res) => {
  const { codeVersionId, filename, branch, text, position } = req.body;
  const { userId, username } = await resolveIdentity(req);
  if (!codeVersionId || !filename || !branch || !text || !position) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const comment = await CodeComment.create({
    codeVersionId,
    filename,
    branch,
    userId,
    username,
    text,
    position,
  });
  res.status(201).json(comment);
};

// GET /api/code/comments?filename=...&branch=...&codeVersionId=...
const getComments = async (req, res) => {
  const { filename, branch, codeVersionId } = req.query;
  const query = {};
  if (filename) query.filename = filename;
  if (branch) query.branch = branch;
  if (codeVersionId) query.codeVersionId = codeVersionId;
  const comments = await CodeComment.find(query).sort({ timestamp: 1 });
  res.json(comments);
};

// DELETE /api/code/comments/:id
const deleteComment = async (req, res) => {
  const { id } = req.params;
  const deleted = await CodeComment.findByIdAndDelete(id);
  if (!deleted) return res.status(404).json({ error: 'Comment not found' });
  res.json({ success: true });
};

module.exports = { addComment, getComments, deleteComment }; 