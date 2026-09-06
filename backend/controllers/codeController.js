const CodeVersion = require('../models/codeVersion');
const resolveIdentity = require('../middleware/identity');
const { threeWayMerge } = require('../utils/threeWayMerge');
const { findCommonAncestor, tipOf } = require('../utils/versionGraph');
const { hashContent, formatCitation } = require('../utils/citation');
const { isObjectId, cleanBranchName } = require('../utils/validate');
const { buildFastImportStream } = require('../utils/gitExport');

// POST /api/code/save
const saveCodeVersion = async (req, res) => {
  const { filename, language, content, parentVersionId, docType } = req.body;
  const branch = cleanBranchName(req.body.branch) || 'main';
  if (!filename || !language || !content) {
    return res.status(400).json({ error: 'filename, language and content are required' });
  }
  if (parentVersionId && !isObjectId(parentVersionId)) {
    return res.status(400).json({ error: 'parentVersionId is not a valid id' });
  }
  if (docType && !['code', 'prose'].includes(docType)) {
    return res.status(400).json({ error: 'docType must be code or prose' });
  }
  // Authorship is taken from the verified token so a version can never be
  // attributed to someone who did not write it.
  const { userId, username } = await resolveIdentity(req);
  const version = await CodeVersion.create({
    filename,
    docType: docType || 'code',
    language,
    content,
    contentHash: hashContent(content),
    userId,
    username,
    parentVersionId: parentVersionId || null,
    branch,
  });
  res.status(201).json(version);
};

// GET /api/code/history/:filename
const getCodeHistory = async (req, res) => {
  const { filename } = req.params;
  const { docType } = req.query;
  const query = { filename };
  if (docType) query.docType = docType;
  const versions = await CodeVersion.find(query).sort({ timestamp: -1 });
  res.json(versions);
};

// GET /api/code/version/:versionId
const getCodeVersion = async (req, res) => {
  const { versionId } = req.params;
  if (!isObjectId(versionId)) return res.status(400).json({ error: 'Not a valid version id' });
  const version = await CodeVersion.findById(versionId);
  if (!version) return res.status(404).json({ error: 'Version not found' });
  res.json(version);
};

// POST /api/code/branch
const createBranch = async (req, res) => {
  const { filename, fromVersionId } = req.body;
  const branch = cleanBranchName(req.body.branch);
  if (!filename || !branch || !fromVersionId) {
    return res.status(400).json({ error: 'filename, a non-blank branch name, and fromVersionId are required' });
  }
  if (!isObjectId(fromVersionId)) {
    return res.status(400).json({ error: 'fromVersionId is not a valid id' });
  }

  // Without this, branching onto a name that already exists quietly appends a
  // version to that branch instead of starting a new one. The user asked for
  // something new and got someone else's history rewritten.
  const clash = await CodeVersion.exists({ filename, branch });
  if (clash) {
    return res.status(409).json({ error: `Branch '${branch}' already exists for this document` });
  }

  const fromVersion = await CodeVersion.findById(fromVersionId);
  if (!fromVersion) return res.status(404).json({ error: 'Base version not found' });
  const newVersion = await CodeVersion.create({
    filename,
    docType: fromVersion.docType,
    language: fromVersion.language,
    content: fromVersion.content,
    contentHash: hashContent(fromVersion.content),
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
  const { filename, sourceBranch, targetBranch } = req.body;
  if (!filename || !sourceBranch || !targetBranch) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (sourceBranch === targetBranch) {
    return res.status(400).json({ error: 'Cannot merge a branch into itself' });
  }
  const { userId, username } = await resolveIdentity(req);

  const sourceVersion = await tipOf(filename, sourceBranch);
  if (!sourceVersion) return res.status(404).json({ error: 'Source branch not found' });
  const targetVersion = await tipOf(filename, targetBranch);
  if (!targetVersion) return res.status(404).json({ error: 'Target branch not found' });

  // The version the two branches diverged from. Without it we could only
  // overwrite one side with the other, which is what this used to do.
  const baseId = await findCommonAncestor(targetVersion._id, sourceVersion._id);
  const baseVersion = baseId ? await CodeVersion.findById(baseId) : null;

  const { content, conflicted, conflictCount } = threeWayMerge(
    baseVersion ? baseVersion.content : '',
    targetVersion.content,
    sourceVersion.content,
    { ourLabel: targetBranch, theirLabel: sourceBranch }
  );

  const mergedVersion = await CodeVersion.create({
    filename,
    docType: sourceVersion.docType,
    language: sourceVersion.language,
    content,
    contentHash: hashContent(content),
    userId,
    username,
    parentVersionId: targetVersion._id,
    mergedFromVersionId: sourceVersion._id,
    hasConflicts: conflicted,
    conflictCount,
    branch: targetBranch,
  });

  // 201 either way -- the merge version exists and is the thing to open. The
  // flag tells the client whether a human still has to resolve it.
  res.status(201).json({
    ...mergedVersion.toObject(),
    baseVersionId: baseId,
    unrelatedHistories: !baseId,
  });
};

// POST /api/code/version/:versionId/cite   { citable: true|false }
// Publishing is an explicit act. A version is private until an author decides
// otherwise -- the same rule as file access: durable artefacts carry their own
// permission rather than inheriting it from a room that no longer exists.
const setCitable = async (req, res) => {
  const { versionId } = req.params;
  const { citable } = req.body;
  if (!isObjectId(versionId)) return res.status(404).json({ error: 'Not found' });

  const version = await CodeVersion.findById(versionId);
  if (!version) return res.status(404).json({ error: 'Not found' });

  const { userId } = await resolveIdentity(req);
  if (String(version.userId) !== String(userId)) {
    return res.status(403).json({ error: 'Only the author of a version can publish it' });
  }
  if (version.hasConflicts && citable) {
    return res.status(400).json({ error: 'Resolve the merge conflicts before citing this version' });
  }

  version.citable = Boolean(citable);
  version.citedAt = version.citable ? new Date() : null;
  if (!version.contentHash) version.contentHash = hashContent(version.content);
  await version.save();

  res.json({
    ...version.toObject(),
    citation: version.citable ? formatCitation(version, req.app.get('publicBaseUrl')) : null,
  });
};

// GET /api/code/version/:versionId/citation  (authenticated preview)
const getCitation = async (req, res) => {
  const { versionId } = req.params;
  if (!isObjectId(versionId)) return res.status(404).json({ error: 'Not found' });
  const version = await CodeVersion.findById(versionId);
  if (!version) return res.status(404).json({ error: 'Not found' });
  if (!version.contentHash) version.contentHash = hashContent(version.content);
  res.json(formatCitation(version, req.app.get('publicBaseUrl')));
};

// GET /api/public/versions/:versionId   -- no authentication
// Serves only versions an author published. Everything else 404s, including
// versions that exist but are private: confirming existence is a disclosure.
const getPublicVersion = async (req, res) => {
  const { versionId } = req.params;
  if (!isObjectId(versionId)) return res.status(404).json({ error: 'Not found' });

  const version = await CodeVersion.findOne({ _id: versionId, citable: true })
    .select('filename docType language content username branch timestamp contentHash citedAt');
  if (!version) return res.status(404).json({ error: 'Not found' });

  res.json({
    ...version.toObject(),
    citation: formatCitation(version, req.app.get('publicBaseUrl')),
  });
};

// GET /api/code/export/:filename   -> a git fast-import stream
//
// The point is that the history can leave. A group that knows it can take its
// work out is a group willing to put its work in.
const exportHistory = async (req, res) => {
  const { filename } = req.params;
  const versions = await CodeVersion.find({ filename }).sort({ timestamp: 1 });
  if (!versions.length) return res.status(404).json({ error: 'No history for that document' });

  // Only export history the requester actually authored or can already read.
  // Every version of a document is visible to anyone who can open it, so this
  // mirrors the read path rather than adding a second permission model.
  const stream = buildFastImportStream(versions, filename);
  const safe = String(filename).replace(/[^\w.-]+/g, '_');

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}.fast-import"`);
  res.send(stream);
};

module.exports = {
  exportHistory,
  setCitable,
  getCitation,
  getPublicVersion,
  saveCodeVersion,
  getCodeHistory,
  getCodeVersion,
  createBranch,
  getBranches,
  mergeBranches,
}; 