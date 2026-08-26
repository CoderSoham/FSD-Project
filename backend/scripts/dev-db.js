/**
 * A throwaway MongoDB for local development.
 *
 * There is no mongod on this machine and the Atlas cluster is paused, which
 * between them make the app impossible to run locally. This starts an
 * in-memory MongoDB, prints the URI, and keeps it alive until you stop it.
 *
 *   node scripts/dev-db.js          # then paste the URI into backend/.env
 *   npm run dev                     # or let this launch the server for you
 *
 * Data lives in memory and is gone when the process exits. That is the point:
 * it is for developing against, not for keeping anything.
 */
const { MongoMemoryServer } = require("mongodb-memory-server");
const { spawn } = require("child_process");

const launchServer = process.argv.includes("--with-server");

(async () => {
  let mongo;
  try {
    mongo = await MongoMemoryServer.create();
  } catch (err) {
    console.error("Could not start an in-memory MongoDB:", err.message.split("\n")[0]);
    console.error("It downloads a MongoDB binary on first run, so this needs network access once.");
    process.exit(1);
  }

  const uri = mongo.getUri();
  console.log("\n  Development database ready.\n");
  console.log(`  MONGO_URI=${uri}\n`);

  let child = null;
  if (launchServer) {
    console.log("  Starting the API against it. Ctrl-C stops both.\n");
    child = spawn("node", ["server.js"], {
      stdio: "inherit",
      env: {
        ...process.env,
        MONGO_URI: uri,
        TOKEN_KEY: process.env.TOKEN_KEY || require("crypto").randomBytes(48).toString("base64"),
      },
    });
    child.on("exit", async (code) => {
      await mongo.stop();
      process.exit(code || 0);
    });
  } else {
    console.log("  Paste that into backend/.env, then run `npm start` in another terminal.");
    console.log("  Leave this process running. Ctrl-C stops the database.\n");
  }

  const shutdown = async () => {
    if (child) child.kill("SIGTERM");
    await mongo.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})();
