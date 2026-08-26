/**
 * End-to-end integration test.
 *
 * Everything else in this suite tests pure functions. This boots the real
 * Express app against a real MongoDB and drives the actual HTTP surface, so it
 * catches the class of failure unit tests structurally cannot: a route wired to
 * the wrong handler, a middleware that throws, a mongoose field that does not
 * round-trip, an auth check that lets the wrong person through.
 *
 * Runs only when MONGOMS is available; skipped otherwise so `npm test` still
 * works on a machine without it.
 */
const assert = require("assert");
const http = require("http");

let failures = 0;
const check = (cond, msg) =>
  cond ? console.log("  ok -", msg) : (console.error("  FAIL -", msg), failures++);

const request = (server, method, path, { token, body } = {}) =>
  new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: server.address().port,
        method,
        path,
        headers: {
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (d) => (data += d));
        res.on("end", () => {
          let parsed = data;
          try { parsed = JSON.parse(data); } catch { /* plain text or a stream */ }
          resolve({ status: res.statusCode, body: parsed, raw: data });
        });
      }
    );
    req.on("error", () => resolve({ status: 0, body: null, raw: "" }));
    if (payload) req.write(payload);
    req.end();
  });

(async () => {
  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = require("mongodb-memory-server"));
  } catch {
    console.log("  SKIP - mongodb-memory-server not installed");
    return;
  }

  let mongo;
  try {
    mongo = await MongoMemoryServer.create();
  } catch (err) {
    console.log("  SKIP - could not start an in-memory MongoDB:", String(err.message).split("\n")[0]);
    return;
  }

  process.env.MONGO_URI = mongo.getUri();
  process.env.TOKEN_KEY = "test-signing-key-not-a-real-secret";
  process.env.PUBLIC_BASE_URL = "https://example.org";

  const mongoose = require("mongoose");
  await mongoose.connect(process.env.MONGO_URI);

  // Build the app the same way server.js does, without binding its port.
  const express = require("express");
  const app = express();
  app.set("publicBaseUrl", process.env.PUBLIC_BASE_URL);
  app.use(express.json());
  app.use("/api/auth", require("../routes/authRoutes"));
  app.use("/api/code", require("../routes/codeRoutes"));
  app.use("/api/files", require("../routes/fileRoutes"));
  app.use("/api/public", require("../routes/publicRoutes"));

  const server = http.createServer(app).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));

  try {
    console.log("auth");
    const reg = await request(server, "POST", "/api/auth/register", {
      body: { username: "ada", mail: "ada@example.org", password: "correct horse battery" },
    });
    check([200, 201].includes(reg.status), `register succeeds (got ${reg.status})`);
    const token = reg.body?.userDetails?.token || reg.body?.token;
    check(Boolean(token), "registration returns a JWT");

    const reg2 = await request(server, "POST", "/api/auth/register", {
      body: { username: "grace", mail: "grace@example.org", password: "correct horse battery" },
    });
    const token2 = reg2.body?.userDetails?.token || reg2.body?.token;

    console.log("\nauthentication is enforced");
    const noAuth = await request(server, "GET", "/api/code/history/paper.md");
    check(noAuth.status === 403 || noAuth.status === 401,
      `code routes reject an unauthenticated request (got ${noAuth.status})`);

    console.log("\nversions");
    const v1 = await request(server, "POST", "/api/code/save", {
      token, body: { filename: "paper.md", language: "markdown", docType: "prose",
                     content: "# Paper\n\nIntro.\n", branch: "main" },
    });
    check(v1.status === 201, `a version saves (got ${v1.status})`);
    check(v1.body?.username === "ada", `authorship comes from the token (got ${v1.body?.username})`);
    check(/^[0-9a-f]{64}$/.test(v1.body?.contentHash || ""), "the content hash is stored");
    check(v1.body?.branch === "main", "the branch is honoured");
    check(v1.body?.docType === "prose", "docType round-trips");

    // Forged authorship must be ignored, not trusted.
    const forged = await request(server, "POST", "/api/code/save", {
      token, body: { filename: "paper.md", language: "markdown", content: "x",
                     userId: "somebody-else", username: "Somebody Else" },
    });
    check(forged.body?.username === "ada",
      `REGRESSION: a claimed username in the body is ignored (got ${forged.body?.username})`);

    console.log("\nbranch and merge");
    const branch = await request(server, "POST", "/api/code/branch", {
      token, body: { filename: "paper.md", branch: "results", fromVersionId: v1.body._id },
    });
    check(branch.status === 201, `a branch is created (got ${branch.status})`);

    await request(server, "POST", "/api/code/save", {
      token, body: { filename: "paper.md", language: "markdown", docType: "prose",
                     content: "# Paper\n\nIntro, expanded.\n", branch: "main",
                     parentVersionId: v1.body._id },
    });
    await request(server, "POST", "/api/code/save", {
      token: token2, body: { filename: "paper.md", language: "markdown", docType: "prose",
                     content: "# Paper\n\nIntro.\n\n## Results\n\nMeasured.\n", branch: "results",
                     parentVersionId: branch.body._id },
    });

    const merge = await request(server, "POST", "/api/code/merge", {
      token, body: { filename: "paper.md", sourceBranch: "results", targetBranch: "main" },
    });
    check(merge.status === 201, `merge succeeds (got ${merge.status})`);
    check(Boolean(merge.body?.mergedFromVersionId), "the merge records its second parent");
    check(
      merge.body?.content?.includes("expanded") && merge.body?.content?.includes("Measured"),
      "REGRESSION: both branches' edits survive the merge"
    );
    check(merge.body?.hasConflicts === false, "a clean merge is not flagged as conflicted");

    const self = await request(server, "POST", "/api/code/merge", {
      token, body: { filename: "paper.md", sourceBranch: "main", targetBranch: "main" },
    });
    check(self.status === 400, `merging a branch into itself is refused (got ${self.status})`);

    console.log("\ncitation");
    const notYet = await request(server, "GET", `/api/public/versions/${v1.body._id}`);
    check(notYet.status === 404, `an unpublished version is not public (got ${notYet.status})`);

    const wrongUser = await request(server, "POST", `/api/code/version/${v1.body._id}/cite`, {
      token: token2, body: { citable: true },
    });
    check(wrongUser.status === 403,
      `only the author can publish a version (got ${wrongUser.status})`);

    const cite = await request(server, "POST", `/api/code/version/${v1.body._id}/cite`, {
      token, body: { citable: true },
    });
    check(cite.status === 200, `the author can publish (got ${cite.status})`);
    check(cite.body?.citation?.url?.startsWith("https://example.org/v/"),
      "the citation URL uses the configured public base");

    const pub = await request(server, "GET", `/api/public/versions/${v1.body._id}`);
    check(pub.status === 200, `a published version is readable with no token (got ${pub.status})`);
    check(pub.body?.content?.includes("Intro"), "the public payload carries the content");
    check(pub.body?.userId === undefined, "the public payload does not leak the author's user id");

    console.log("\nexport");
    const exp = await request(server, "GET", "/api/code/export/paper.md", { token });
    check(exp.status === 200, `export returns a stream (got ${exp.status})`);
    check(exp.raw.includes("commit refs/heads/main"), "the stream contains commits on main");
    check(exp.raw.includes("merge :"), "the stream contains a real merge commit");

    const missing = await request(server, "GET", "/api/code/export/nothing.md", { token });
    check(missing.status === 404, `exporting an unknown document 404s (got ${missing.status})`);
  } catch (err) {
    check(false, `threw: ${err.message}`);
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongo.stop();
  }

  console.log(
    failures ? `\n${failures} check(s) FAILED` : "\nAll integration checks passed."
  );
  process.exitCode = failures ? 1 : 0;
})();
