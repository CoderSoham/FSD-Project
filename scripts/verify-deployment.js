#!/usr/bin/env node
/**
 * Check a deployed GitCord API the way a browser would.
 *
 * This exists because a green deployment badge means the build succeeded, not
 * that the product works. Both Vercel projects reported success for weeks while
 * the hosted frontend could not reach the API at all and no socket could ever
 * connect. Nothing in the pipeline drove the deployed thing the way a person
 * would, so nothing noticed.
 *
 * Usage:
 *   node scripts/verify-deployment.js <api-origin> [frontend-origin]
 *
 * Example:
 *   node scripts/verify-deployment.js https://gitcord-api.onrender.com \
 *                                     https://fsd-project-mu.vercel.app
 */

const API = (process.argv[2] || "").replace(/\/+$/, "");
const FRONTEND = (process.argv[3] || "https://fsd-project-mu.vercel.app").replace(/\/+$/, "");

if (!API) {
  console.error("Usage: node scripts/verify-deployment.js <api-origin> [frontend-origin]");
  process.exit(2);
}

const results = [];
const record = (ok, name, detail) => {
  results.push({ ok, name, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `\n          ${detail}` : ""}`);
};

/**
 * One retry on a network level failure.
 *
 * A cold serverless function drops the first connection often enough that
 * without this the report says "down" about something that is merely asleep.
 * A retry costs a second and removes a whole class of false alarm. An HTTP
 * response, including a 5xx, is a real answer and is never retried.
 */
const get = async (path, headers = {}) => {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Without a timeout a single hung request stalls the whole report, which
      // is exactly what a struggling deployment produces.
      const res = await fetch(`${API}${path}`, {
        headers,
        signal: AbortSignal.timeout(10000),
      });
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }
      return { status: res.status, headers: res.headers, body };
    } catch (err) {
      lastErr = err.name === "TimeoutError"
        ? new Error("no response within 10s")
        : err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
};

async function checkLiveness() {
  try {
    const r = await get("/livez");
    record(r.status === 200, "the process is up (/livez)", `HTTP ${r.status}`);
  } catch (err) {
    record(false, "the process is up (/livez)", err.message);
  }
}

async function checkDatabase() {
  try {
    const r = await get("/healthz");
    const db = r.body && r.body.database;
    record(db === "connected", "the database is reachable (/healthz)",
      `HTTP ${r.status}, database=${db}`);
  } catch (err) {
    record(false, "the database is reachable (/healthz)", err.message);
  }
}

async function checkCors() {
  try {
    const r = await get("/livez", { Origin: FRONTEND });
    const allow = r.headers.get("access-control-allow-origin");
    record(allow === FRONTEND, "the frontend origin is allowed by CORS",
      allow ? `Access-Control-Allow-Origin: ${allow}`
            : `no header returned, so a browser at ${FRONTEND} is blocked`);
  } catch (err) {
    record(false, "the frontend origin is allowed by CORS", err.message);
  }

  try {
    const r = await get("/livez", { Origin: "https://not-the-frontend.example" });
    const allow = r.headers.get("access-control-allow-origin");
    record(!allow, "an unknown origin is refused",
      allow ? `it returned ${allow}, which is too permissive` : "no header, correct");
  } catch (err) {
    record(false, "an unknown origin is refused", err.message);
  }
}

async function checkPublicRoute() {
  // The citation route is the only thing reachable without an account, and a
  // made-up id must come back 404 rather than crashing anything.
  try {
    const r = await get(`/api/public/versions/${"0".repeat(24)}`);
    record(r.status === 404, "the public citation route answers", `HTTP ${r.status}`);
  } catch (err) {
    record(false, "the public citation route answers", err.message);
  }
}

/**
 * The one that actually matters on a new host.
 *
 * Everything above works on serverless. A socket handshake does not, because
 * there is no process to hold the connection. If this passes, the move was the
 * point.
 */
async function checkSocket() {
  let io;
  try {
    io = require("socket.io-client");
  } catch {
    try {
      io = require(require.resolve("socket.io-client", { paths: ["./frontend"] }));
    } catch {
      record(false, "socket.io accepts a connection", "socket.io-client not installed; run npm install in frontend/");
      return;
    }
  }

  await new Promise((resolve) => {
    // No token, so the server should refuse us. Being refused still proves a
    // real socket server answered, which is the whole question.
    const socket = io(API, {
      transports: ["websocket"],
      timeout: 15000,
      reconnection: false,
      auth: { token: "not-a-real-token" },
    });

    const done = (ok, detail) => {
      record(ok, "socket.io accepts a connection", detail);
      try { socket.close(); } catch {}
      resolve();
    };

    const timer = setTimeout(
      () => done(false, "no response in 15s, so nothing is holding a socket open"),
      15000
    );

    socket.on("connect", () => {
      clearTimeout(timer);
      done(true, "connected, and the server is holding the connection open");
    });

    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      // An auth rejection is a real socket server talking back.
      const rejected = /auth|token|unauthor/i.test(err.message || "");
      done(rejected, rejected
        ? `the socket server answered and rejected the fake token: "${err.message}"`
        : `could not reach a socket server: "${err.message}"`);
    });
  });
}

(async () => {
  console.log(`\nChecking ${API}`);
  console.log(`Frontend origin assumed to be ${FRONTEND}\n`);

  await checkLiveness();
  await checkDatabase();
  await checkCors();
  await checkPublicRoute();
  await checkSocket();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed\n`);
  process.exit(failed.length ? 1 : 0);
})();
