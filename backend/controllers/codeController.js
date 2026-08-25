const CodeVersion = require('../models/codeVersion');

// POST /api/code/save
const saveCodeVersion = async (req, res) => {
  const { filename, language, content, userId, username, parentVersionId } = req.body;
  if (!filename || !language || !content || !userId || !username) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const version = await CodeVersion.create({
    filename,
    language,
    content,
    userId,
    username,
    parentVersionId: parentVersionId || null,
  });
  res.status(201).json(version);
};

// GET /api/code/history/:filename
const getCodeHistory = async (req, res) => {
  const { filename } = req.params;
  const versions = await CodeVersion.find({ filename }).sort({ timestamp: -1 });
  res.json(versions);
};

// GET /api/code/version/:versionId
const getCodeVersion = async (req, res) => {
  const { versionId } = req.params;
  const version = await CodeVersion.findById(versionId);
  if (!version) return res.status(404).json({ error: 'Version not found' });
  res.json(version);
};

// POST /api/code/branch
const createBranch = async (req, res) => {
  const { filename, branch, fromVersionId } = req.body;
  if (!filename || !branch || !fromVersionId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const fromVersion = await CodeVersion.findById(fromVersionId);
  if (!fromVersion) return res.status(404).json({ error: 'Base version not found' });
  const newVersion = await CodeVersion.create({
    filename,
    language: fromVersion.language,
    content: fromVersion.content,
    userId: fromVersion.userId,
    username: fromVersion.username,
    parentVersionId: fromVersionId,
    branch,
  });
  res.status(201).json(newVersion);
};

// GET /api/code/branches/:filename
const getBranches = async (req, res) => {
  const { filename } = req.params;
  const branches = await CodeVersion.distinct('branch', { filename });
  res.json(branches);
};

// POST /api/code/merge
const mergeBranches = async (req, res) => {
  const { filename, sourceBranch, targetBranch, userId, username } = req.body;
  if (!filename || !sourceBranch || !targetBranch || !userId || !username) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  // Get latest version from source branch
  const sourceVersion = await CodeVersion.findOne({ filename, branch: sourceBranch }).sort({ timestamp: -1 });
  if (!sourceVersion) return res.status(404).json({ error: 'Source branch not found' });
  // Get latest version from target branch
  const targetVersion = await CodeVersion.findOne({ filename, branch: targetBranch }).sort({ timestamp: -1 });
  // Create a new version in target branch with source content
  const mergedVersion = await CodeVersion.create({
    filename,
    language: sourceVersion.language,
    content: sourceVersion.content,
    userId,
    username,
    parentVersionId: targetVersion ? targetVersion._id : null,
    branch: targetBranch,
  });
  res.status(201).json(mergedVersion);
};

module.exports = {
  saveCodeVersion,
  getCodeHistory,
  getCodeVersion,
  createBranch,
  getBranches,
  mergeBranches,
}; 