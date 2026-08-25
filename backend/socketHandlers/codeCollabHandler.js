const Y = require("yjs");
const awarenessProtocol = require("y-protocols/awareness");
const CodeSession = require("../models/codeSession");

/**
 * Collaborative editing backed by a Yjs CRDT.
 *
 * The previous implementation broadcast the whole document on every keystroke
 * and kept `{ sessionId: { code } }` in memory. That is last-write-wins: two
 * people typing in the same paragraph clobber each other, a dropped connection
 * diverges with no way back, and a restart loses everything.
 *
 * A CRDT converges without anyone arbitrating. Concurrent edits merge
 * deterministically, every client ends at the same state regardless of message
 * order, and edits made while offline reconcile on reconnect.
 *
 * Sync rides the existing authenticated socket. The old client opened a second,
 * tokenless connection to a hardcoded localhost URL, which `authSocket` refused
 * outright -- collaborative editing could never actually connect.
 */

const SAVE_DEBOUNCE_MS = 2000;

/** sessionId -> { doc, awareness, sockets:Set, saveTimer } */
const sessions = new Map();

const asUint8 = (data) => {
  if (data instanceof Uint8Array) return data;
  if (Buffer.isBuffer(data)) return new Uint8Array(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data && data.data) return new Uint8Array(data.data); // socket.io binary envelope
  return null;
};

const persist = (sessionId, session) => {
  clearTimeout(session.saveTimer);
  session.saveTimer = setTimeout(async () => {
    try {
      const state = Buffer.from(Y.encodeStateAsUpdate(session.doc));
      await CodeSession.findOneAndUpdate(
        { sessionId },
        { state, updatedAt: new Date() },
        { upsert: true }
      );
    } catch (err) {
      console.error("codeCollab: failed to persist session", sessionId, err.message);
    }
  }, SAVE_DEBOUNCE_MS);
};

const loadSession = async (sessionId) => {
  const existing = sessions.get(sessionId);
  if (existing) return existing;

  const doc = new Y.Doc();
  try {
    const saved = await CodeSession.findOne({ sessionId });
    if (saved && saved.state) {
      Y.applyUpdate(doc, new Uint8Array(saved.state));
    }
  } catch (err) {
    console.error("codeCollab: failed to load session", sessionId, err.message);
  }

  const awareness = new awarenessProtocol.Awareness(doc);
  awareness.setLocalState(null); // the server is not a participant, only a relay

  const session = { doc, awareness, sockets: new Set(), saveTimer: null };
  sessions.set(sessionId, session);
  return session;
};

const codeCollabHandler = (socket, io) => {
  const joined = new Set();

  const room = (sessionId) => `code:${sessionId}`;

  socket.on("y:join", async ({ sessionId, stateVector }, ack) => {
    if (!sessionId) return;
    const session = await loadSession(sessionId);

    socket.join(room(sessionId));
    session.sockets.add(socket.id);
    joined.add(sessionId);

    // Two-way sync. The client sends what it already has; we reply with only
    // the delta it is missing, then ask for whatever we are missing in turn.
    const clientSV = asUint8(stateVector);
    const diff = clientSV
      ? Y.encodeStateAsUpdate(session.doc, clientSV)
      : Y.encodeStateAsUpdate(session.doc);

    const payload = {
      update: Buffer.from(diff),
      stateVector: Buffer.from(Y.encodeStateVector(session.doc)),
      awareness: Buffer.from(
        awarenessProtocol.encodeAwarenessUpdate(
          session.awareness,
          Array.from(session.awareness.getStates().keys())
        )
      ),
    };

    if (typeof ack === "function") ack(payload);
    else socket.emit("y:sync", { sessionId, ...payload });
  });

  socket.on("y:update", ({ sessionId, update }) => {
    const session = sessions.get(sessionId);
    const bytes = asUint8(update);
    if (!session || !bytes) return;

    // `socket` as origin so the broadcast below can be attributed, and so a
    // client never receives its own update echoed back.
    Y.applyUpdate(session.doc, bytes, socket.id);
    socket.to(room(sessionId)).emit("y:update", { sessionId, update: Buffer.from(bytes) });
    persist(sessionId, session);
  });

  socket.on("y:awareness", ({ sessionId, update }) => {
    const session = sessions.get(sessionId);
    const bytes = asUint8(update);
    if (!session || !bytes) return;

    awarenessProtocol.applyAwarenessUpdate(session.awareness, bytes, socket.id);
    socket.to(room(sessionId)).emit("y:awareness", { sessionId, update: Buffer.from(bytes) });
  });

  const leave = (sessionId) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    session.sockets.delete(socket.id);
    socket.leave(room(sessionId));

    // Drop this connection's cursor so it does not linger as a ghost.
    const clientIds = Array.from(session.awareness.getStates().keys()).filter(
      (id) => session.awareness.meta.get(id) && session.awareness.meta.get(id).origin === socket.id
    );
    if (clientIds.length) {
      awarenessProtocol.removeAwarenessStates(session.awareness, clientIds, socket.id);
    }

    if (session.sockets.size === 0) {
      // Last one out: flush immediately rather than waiting on the debounce,
      // then release the doc so idle sessions do not accumulate in memory.
      clearTimeout(session.saveTimer);
      const state = Buffer.from(Y.encodeStateAsUpdate(session.doc));
      CodeSession.findOneAndUpdate(
        { sessionId },
        { state, updatedAt: new Date() },
        { upsert: true }
      ).catch((err) => console.error("codeCollab: final persist failed", err.message));
      session.doc.destroy();
      sessions.delete(sessionId);
    }
  };

  socket.on("y:leave", ({ sessionId }) => {
    joined.delete(sessionId);
    leave(sessionId);
  });

  socket.on("disconnect", () => {
    joined.forEach(leave);
    joined.clear();
  });
};

module.exports = codeCollabHandler;
module.exports._sessions = sessions; // exposed for tests
