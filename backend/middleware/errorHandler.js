/**
 * The one place an unexpected error turns into a response.
 *
 * Must be mounted after every route, and must keep all four arguments even
 * though `next` looks unused. Express identifies error middleware by arity, so
 * dropping it silently turns this back into an ordinary middleware that never
 * runs.
 *
 * Two rules here. Clients get a sentence they can act on and nothing else, and
 * the real error goes to the server log where it belongs. A stack trace in a
 * response body tells an attacker about your dependencies and file layout.
 */

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  // A bad ObjectId. Common enough to deserve its own message, because "server
  // error" for a typo in a URL sends people looking in the wrong place.
  if (err.name === 'CastError') {
    return res.status(400).json({ error: `'${err.path}' is not a valid id.` });
  }

  if (err.name === 'ValidationError') {
    const fields = Object.keys(err.errors || {}).join(', ');
    return res.status(400).json({
      error: fields ? `Invalid value for: ${fields}.` : 'The request body was not valid.',
    });
  }

  // Mongo duplicate key, which reaches us as a plain driver error.
  if (err.code === 11000) {
    return res.status(409).json({ error: 'That already exists.' });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That request was too large.' });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body was not valid JSON.' });
  }

  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ error: 'Something went wrong. The error has been logged.' });
};

module.exports = errorHandler;
