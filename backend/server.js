const express = require("express");
const http = require("http");
const cors = require("cors");
const { corsOptions } = require("./config/origins");
const mongoose = require("mongoose");
require("dotenv").config();


const socketServer = require("./socketServer");
const authRoutes = require("./routes/authRoutes");
const friendInvitationRoutes = require("./routes/friendInvitationRoutes");
const fileRoutes = require("./routes/fileRoutes");
const codeRoutes = require("./routes/codeRoutes");
const publicRoutes = require("./routes/publicRoutes");
const errorHandler = require("./middleware/errorHandler");

const PORT = process.env.PORT || process.env.API_PORT || 5002;

const app = express();
// Used to build absolute citation URLs; a citation with a localhost link is useless.
app.set("publicBaseUrl", process.env.PUBLIC_BASE_URL || "https://fsd-project-mu.vercel.app");
app.use(cors(corsOptions));

// Documents travel in the body, so the default 100kb is too small, but it
// still needs a ceiling. Anything over this returns a sentence, not a stack.
app.use(express.json({ limit: '2mb' }));

app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Says what is actually wrong rather than just 'ok'.
app.get('/healthz', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const db = states[mongoose.connection.readyState] || 'unknown';
  res.status(db === 'connected' ? 200 : 503).json({ api: 'ok', database: db });
});

// Anything that touches the database fails fast with a readable reason.
app.use((req, res, next) => {
  if (req.method === 'OPTIONS' || mongoose.connection.readyState === 1) return next();
  res.status(503).json({
    error: 'The database is unavailable, so this request cannot be served. ' +
           'If you are running locally, check that MONGO_URI points at a reachable database.',
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/friend-invitation", friendInvitationRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/code", codeRoutes);
app.use("/api/public", publicRoutes);

// Must be last. Everything above hands its failures here.
app.use(errorHandler);
// Uploads are NOT served statically. They are research documents; a static
// mount hands them to anyone who learns a filename. Every fetch goes through
// GET /api/files/:fileId/download, which checks the file's access list.

const server = http.createServer(app);
socketServer.registerSocketServer(server);

// The server listens whether or not the database is reachable.
//
// This used to sit inside the connect().then(), so any database problem left
// nothing listening on the port at all -- the browser got a connection refused
// and the user got "Registration failed" with no way to tell a paused cluster
// from a typo in their password. An app that cannot reach its database should
// say so, not vanish.
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/gitcord";

const connectToDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    console.log("Connected to MongoDB");
  } catch (err) {
    const host = (String(MONGO_URI).match(/@([^/?]+)/) || [])[1] || "unknown host";
    console.error(`\n  MongoDB is not reachable at ${host}`);
    console.error(`  ${err.message.split("\n")[0]}`);
    if (/ENOTFOUND|querySrv/.test(err.message)) {
      console.error("\n  An SRV lookup failure usually means an Atlas cluster is paused or deleted.");
      console.error("  Resume it in Atlas, or point MONGO_URI at another database.");
      console.error("  For local work with no Atlas at all: npm run dev:db\n");
    }
    console.error("  The API is still listening; database-backed routes will return 503.\n");
    setTimeout(connectToDatabase, 15000); // keep trying, so a resume needs no restart
  }
};

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server is listening on ${PORT}`);
});
connectToDatabase();

module.exports = (req, res) => {
  app(req, res);
};
