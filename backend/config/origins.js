/**
 * Which browser origins may talk to this API.
 *
 * This was the string 'http://localhost:3000', written straight into the cors()
 * call. That is correct for local work and wrong everywhere else: the deployed
 * frontend is a different origin, so the deployed API rejected every request
 * from it. The socket server had the opposite problem and allowed '*'.
 *
 * Set CORS_ORIGINS to a comma separated list to control it per deployment.
 * The defaults cover local development and the current hosted frontend, so
 * neither needs configuration to work.
 */
const trimSlash = (url) => String(url || '').trim().replace(/\/+$/, '');

const DEFAULTS = [
  'http://localhost:3000',
  process.env.PUBLIC_BASE_URL || 'https://fsd-project-mu.vercel.app',
];

const allowedOrigins = (
  process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : DEFAULTS
)
  .map(trimSlash)
  .filter(Boolean);

/**
 * A request with no Origin header is not a browser cross-origin request. curl,
 * server to server calls and uptime checks all arrive this way, and CORS has
 * nothing to protect them from, so they are allowed through. The token check
 * on each route is what actually guards the data.
 */
const isAllowedOrigin = (origin) =>
  !origin || allowedOrigins.includes(trimSlash(origin));

/** Shape that both express cors() and socket.io accept. */
const corsOptions = {
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  credentials: true,
};

module.exports = { allowedOrigins, isAllowedOrigin, corsOptions };
