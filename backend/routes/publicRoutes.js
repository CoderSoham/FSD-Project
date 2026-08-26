const express = require('express');
const { getPublicVersion } = require('../controllers/codeController');

/**
 * The only unauthenticated surface in the application.
 *
 * It serves exactly one thing: a version whose author has explicitly published
 * it. Anything else returns 404, including private versions that do exist --
 * confirming existence is itself a disclosure.
 *
 * Kept in its own router so that "what can an anonymous visitor reach?" is
 * answerable by reading one short file.
 */
const router = express.Router();

router.get('/versions/:versionId', getPublicVersion);

module.exports = router;
