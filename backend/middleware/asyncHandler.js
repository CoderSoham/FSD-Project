/**
 * Wrap an async route handler so a rejected promise reaches Express.
 *
 * Express 4 has no async support. If an async handler throws or rejects,
 * Express never sees it, the request hangs, and Node treats it as an unhandled
 * rejection, which terminates the process. That is not theoretical: a malformed
 * ObjectId in a request body was enough to take the whole API down.
 *
 * Every async handler must go through this. There is no way to make Express 4
 * do it automatically without patching the router.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
