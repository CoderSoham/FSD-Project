import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";
import { getSocket } from "../../realtimeCommunication/socketConnection";

/**
 * Opens a shared Yjs document over the app's existing authenticated socket.
 *
 * Deliberately knows nothing about editors. It owns the transport -- sync,
 * awareness, reconnect -- and hands back the doc so a caller can bind whatever
 * it likes: Monaco for code, ProseMirror for prose. Both document types then
 * share one implementation of the hard part.
 *
 * Replaces a whole-document broadcast on every keystroke, which was
 * last-write-wins: two people typing in the same paragraph overwrote each
 * other, and a dropped connection diverged permanently. A CRDT converges no
 * matter the order updates arrive in, and survives going offline.
 *
 * Returns { doc, awareness, destroy }. Call destroy() on unmount.
 */
export const connectCollabSession = ({ sessionId, user }) => {
  const socket = getSocket();
  if (!socket || !sessionId) return null;

  const doc = new Y.Doc();
  const awareness = new Awareness(doc);

  awareness.setLocalStateField("user", {
    name: user?.username || user?.mail || "anonymous",
    // stable per-user colour so a cursor keeps its identity across sessions
    color: `hsl(${(String(user?.userId || user?.mail || "?")
      .split("")
      .reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7))}, 70%, 50%)`,
  });

  const bytes = (d) =>
    d instanceof Uint8Array ? d : new Uint8Array(d?.data ? d.data : d);

  // --- outbound: local edits and cursor moves
  const onDocUpdate = (update, origin) => {
    if (origin === "remote") return; // never echo what we just received
    socket.emit("y:update", { sessionId, update });
  };
  const onAwarenessUpdate = ({ added, updated, removed }, origin) => {
    if (origin === "remote") return;
    const changed = added.concat(updated, removed);
    socket.emit("y:awareness", {
      sessionId,
      update: encodeAwarenessUpdate(awareness, changed),
    });
  };
  doc.on("update", onDocUpdate);
  awareness.on("update", onAwarenessUpdate);

  // --- inbound
  const onRemoteUpdate = (msg) => {
    if (msg?.sessionId !== sessionId) return;
    Y.applyUpdate(doc, bytes(msg.update), "remote");
  };
  const onRemoteAwareness = (msg) => {
    if (msg?.sessionId !== sessionId) return;
    applyAwarenessUpdate(awareness, bytes(msg.update), "remote");
  };
  socket.on("y:update", onRemoteUpdate);
  socket.on("y:awareness", onRemoteAwareness);

  // --- initial sync. Send what we have; the server replies with only the
  // delta we're missing, then we send back whatever it's missing.
  socket.emit(
    "y:join",
    { sessionId, stateVector: Y.encodeStateVector(doc) },
    (reply) => {
      if (!reply) return;
      if (reply.update) Y.applyUpdate(doc, bytes(reply.update), "remote");
      if (reply.awareness) applyAwarenessUpdate(awareness, bytes(reply.awareness), "remote");
      if (reply.stateVector) {
        const ours = Y.encodeStateAsUpdate(doc, bytes(reply.stateVector));
        if (ours.length) socket.emit("y:update", { sessionId, update: ours });
      }
    }
  );

  // Re-sync after a reconnect, which is the whole point of using a CRDT.
  const onReconnect = () => {
    socket.emit("y:join", { sessionId, stateVector: Y.encodeStateVector(doc) }, (reply) => {
      if (reply?.update) Y.applyUpdate(doc, bytes(reply.update), "remote");
    });
  };
  socket.on("connect", onReconnect);

  const destroy = () => {
    socket.emit("y:leave", { sessionId });
    socket.off("y:update", onRemoteUpdate);
    socket.off("y:awareness", onRemoteAwareness);
    socket.off("connect", onReconnect);
    doc.off("update", onDocUpdate);
    awareness.off("update", onAwarenessUpdate);
    awareness.destroy();
    doc.destroy();
  };

  return { doc, awareness, destroy };
};
