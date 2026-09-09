/**
 * Where the API lives.
 *
 * This was written out in four places in three different ways: two NODE_ENV
 * branches in api.js, a REACT_APP_BACKEND_URL lookup in the room chat panel
 * whose only fallback was localhost, and a bare hardcoded localhost in the
 * socket client. The socket one had no production branch at all, so a deployed
 * build asked every visitor's own machine for port 5002.
 *
 * One value, set in one place. REACT_APP_API_ORIGIN wins when it is set, which
 * is how a deployment points the frontend at its own backend without a code
 * change. Create React App inlines REACT_APP_* at build time, so this is fixed
 * when the bundle is produced, not read at runtime.
 */
const fallback =
  process.env.NODE_ENV === "production"
    ? "https://fsd-project-api.vercel.app"
    : "http://localhost:5002";

const trimSlash = (url) => String(url || "").replace(/\/+$/, "");

/** Scheme and host only, no path. What socket.io wants. */
export const API_ORIGIN = trimSlash(process.env.REACT_APP_API_ORIGIN || fallback);

/** The REST prefix. What axios and fetch want. */
export const API_BASE = `${API_ORIGIN}/api`;
