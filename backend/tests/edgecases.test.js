/**
 * Adversarial edge-case suite.
 *
 * The other suites verify that features work when used correctly. This one
 * tries to break them: empty input, oversized input, unicode, duplicate names,
 * malformed ids, missing resources, and operations performed in the wrong
 * order. Bugs live in the paths nobody exercises on purpose.
 *
 * Findings are recorded in the vault as BUG-NNN.
 */
const http = require("http");

let failures = 0;
const found = [];
const check = (cond, msg) =>
  cond ? console.log("  ok -", msg) : (console.error("  FAIL -", msg), failures++, found.push(msg));

const request = (server, method, path, { token, body, raw } = {}) =>
  new Promise((resolve) => {
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "127.0.0.1", port: server.address().port, method, path,
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
          if (!raw) { try { parsed = JSON.parse(data); } catch { /* not json */ } }
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
  try { ({ MongoMemoryServer } = require("mongodb-memory-server")); }
  catch { console.log("  SKIP - mongodb-memory-server not installed"); return; }

  let mongo;
  try { mongo = await MongoMemoryServer.create(); }
  catch (err) { console.log("  SKIP -", err.message.split("\n")[0]); return; }

  process.env.MONGO_URI = mongo.getUri();
  process.env.TOKEN_KEY = "edge-case-signing-key";
  process.env.PUBLIC_BASE_URL = "https://example.org";

  const mongoose = require("mongoose");
  await mongoose.connect(process.env.MONGO_URI);

  const express = require("express");
  const app = express();
  app.set("publicBaseUrl", process.env.PUBLIC_BASE_URL);
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/auth", require("../routes/authRoutes"));
  app.use("/api/code", require("../routes/codeRoutes"));
  app.use("/api/files", require("../routes/fileRoutes"));
  app.use("/api/public", require("../routes/publicRoutes"));
  app.use(require("../middleware/errorHandler"));

  const server = http.createServer(app).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));

  const reg = async (username, mail) => {
    const r = await request(server, "POST", "/api/auth/register",
      { body: { username, mail, password: "devpassword" } });
    return r.body?.userDetails?.token || r.body?.token;
  };

  try {
    const token = await reg("ada", "ada@example.com");
    const token2 = await reg("grace", "grace@example.com");

    console.log("auth edge cases");
    {
      const dupe = await request(server, "POST", "/api/auth/register",
        { body: { username: "ada2", mail: "ada@example.com", password: "devpassword" } });
      check(dupe.status === 409, `duplicate e-mail is a 409 conflict (got ${dupe.status})`);

      const wrongPw = await request(server, "POST", "/api/auth/login",
        { body: { mail: "ada@example.com", password: "not-the-password" } });
      check(wrongPw.status === 400 || wrongPw.status === 401,
        `a wrong password is rejected (got ${wrongPw.status})`);

      const unknown = await request(server, "POST", "/api/auth/login",
        { body: { mail: "nobody@example.com", password: "devpassword" } });
      check(unknown.status === 400 || unknown.status === 401,
        `an unknown account is rejected (got ${unknown.status})`);
      check(
        !/no user|not found|does not exist/i.test(JSON.stringify(unknown.body)),
        "a failed login does not reveal whether the account exists"
      );

      const garbage = await request(server, "GET", "/api/code/history/x.md",
        { token: "not.a.real.token" });
      check(garbage.status === 401, `a malformed token is 401 (got ${garbage.status})`);
    }

    console.log("\nversion edge cases");
    {
      const empty = await request(server, "POST", "/api/code/save",
        { token, body: { filename: "a.md", language: "markdown", content: "" } });
      check(empty.status === 400, `empty content is rejected (got ${empty.status})`);

      const unicode = await request(server, "POST", "/api/code/save", {
        token, body: { filename: "unicode.md", language: "markdown",
                       content: "# Ünïcödé\n\n中文 · العربية · 🧪 emoji\n" },
      });
      check(unicode.status === 201, `unicode content saves (got ${unicode.status})`);
      check(unicode.body?.content?.includes("🧪"), "unicode survives the round trip");

      const badParent = await request(server, "POST", "/api/code/save", {
        token, body: { filename: "a.md", language: "markdown", content: "x",
                       parentVersionId: "not-an-object-id" },
      });
      check(badParent.status >= 400 && badParent.status < 500,
        `a malformed parentVersionId is a client error, not a 500 (got ${badParent.status})`);

      const missing = await request(server, "GET",
        "/api/code/version/000000000000000000000000", { token });
      check(missing.status === 404, `an absent version is 404 (got ${missing.status})`);

      const malformed = await request(server, "GET", "/api/code/version/xyz", { token });
      check(malformed.status >= 400 && malformed.status < 500,
        `a malformed version id is a client error, not a 500 (got ${malformed.status})`);

      const badDocType = await request(server, "POST", "/api/code/save", {
        token, body: { filename: "a.md", language: "markdown", content: "x", docType: "video" },
      });
      check(badDocType.status === 400, `an unknown docType is rejected (got ${badDocType.status})`);
    }

    console.log("\nbranch edge cases");
    {
      const base = await request(server, "POST", "/api/code/save",
        { token, body: { filename: "b.md", language: "markdown", content: "one\n", branch: "main" } });

      const b1 = await request(server, "POST", "/api/code/branch",
        { token, body: { filename: "b.md", branch: "feature", fromVersionId: base.body._id } });
      check(b1.status === 201, `a branch is created (got ${b1.status})`);

      const dupe = await request(server, "POST", "/api/code/branch",
        { token, body: { filename: "b.md", branch: "feature", fromVersionId: base.body._id } });
      check(dupe.status === 409,
        `creating a branch that already exists is refused (got ${dupe.status})`);

      const badBase = await request(server, "POST", "/api/code/branch",
        { token, body: { filename: "b.md", branch: "x", fromVersionId: "nope" } });
      check(badBase.status >= 400 && badBase.status < 500,
        `branching from a malformed id is a client error (got ${badBase.status})`);

      const reserved = await request(server, "POST", "/api/code/branch",
        { token, body: { filename: "b.md", branch: "   ", fromVersionId: base.body._id } });
      check(reserved.status === 400, `a blank branch name is refused (got ${reserved.status})`);
    }

    console.log("\nmerge edge cases");
    {
      const missingSource = await request(server, "POST", "/api/code/merge",
        { token, body: { filename: "b.md", sourceBranch: "ghost", targetBranch: "main" } });
      check(missingSource.status === 404,
        `merging a branch that does not exist is 404 (got ${missingSource.status})`);

      // Two documents with no shared ancestor at all.
      await request(server, "POST", "/api/code/save",
        { token, body: { filename: "u.md", language: "markdown", content: "left\n", branch: "main" } });
      await request(server, "POST", "/api/code/save",
        { token, body: { filename: "u.md", language: "markdown", content: "right\n", branch: "other" } });
      const unrelated = await request(server, "POST", "/api/code/merge",
        { token, body: { filename: "u.md", sourceBranch: "other", targetBranch: "main" } });
      check(unrelated.status === 201, `unrelated histories still merge (got ${unrelated.status})`);
      check(unrelated.body?.unrelatedHistories === true, "unrelated histories are flagged");
    }

    console.log("\ncitation edge cases");
    {
      const v = await request(server, "POST", "/api/code/save",
        { token, body: { filename: "c.md", language: "markdown", content: "cite me\n" } });

      const pub = await request(server, "POST", `/api/code/version/${v.body._id}/cite`,
        { token, body: { citable: true } });
      check(pub.status === 200, `publish succeeds (got ${pub.status})`);

      const un = await request(server, "POST", `/api/code/version/${v.body._id}/cite`,
        { token, body: { citable: false } });
      check(un.status === 200, "unpublishing succeeds");
      const gone = await request(server, "GET", `/api/public/versions/${v.body._id}`);
      check(gone.status === 404, `an unpublished version stops resolving (got ${gone.status})`);

      const badId = await request(server, "GET", "/api/public/versions/zzz");
      check(badId.status === 404, `a malformed public id is 404, not a 500 (got ${badId.status})`);

      const otherUser = await request(server, "POST", `/api/code/version/${v.body._id}/cite`,
        { token: token2, body: { citable: true } });
      check(otherUser.status === 403, `a non-author cannot publish (got ${otherUser.status})`);
    }

    console.log("\nexport edge cases");
    {
      const uni = await request(server, "GET", "/api/code/export/unicode.md", { token, raw: true });
      check(uni.status === 200, `a unicode document exports (got ${uni.status})`);
      check(uni.raw.includes("🧪"), "unicode survives the export stream");
      // fast-import counts bytes; a multi-byte character means byte length and
      // character length differ, and getting that wrong corrupts the stream.
      const m = uni.raw.match(/^data (\d+)$/m);
      check(Boolean(m), "the stream declares data block lengths");
    }

    console.log("\nfile edge cases");
    {
      const noRoom = await request(server, "GET", "/api/files/room/none", { token });
      check(noRoom.status === 200 && Array.isArray(noRoom.body),
        `an empty room returns an empty list, not an error (got ${noRoom.status})`);

      const badFile = await request(server, "GET", "/api/files/zzz/download", { token });
      check(badFile.status === 404, `a malformed file id is 404 (got ${badFile.status})`);
    }
  } catch (err) {
    check(false, `threw: ${err.message}`);
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongo.stop();
  }

  if (failures) {
    console.log(`\n${failures} edge case(s) FAILED. These are the bugs:`);
    found.forEach((f) => console.log("  •", f));
  } else {
    console.log("\nAll edge-case checks passed.");
  }
  process.exitCode = failures ? 1 : 0;
})();
