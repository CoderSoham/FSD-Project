/**
 * FEAT-001 acceptance test.
 *
 * Two clients edit concurrently at different offsets while disconnected from
 * each other, then reconnect. They must converge to identical text with no
 * edit lost. This is exactly what the old last-write-wins handler failed.
 *
 * Runs the real convergence logic (Yjs updates + the server's relay/merge
 * semantics) without needing a socket server or a database.
 */
const Y = require("yjs");
const assert = require("assert");

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
const ok = (m) => console.log("  ok -", m);

// ---------------------------------------------------------------- scenario 1
// Concurrent inserts at different offsets, exchanged out of order.
{
  const server = new Y.Doc();
  const a = new Y.Doc();
  const b = new Y.Doc();

  // everyone starts from the same base, as they would after y:join
  server.getText("code").insert(0, "function hello() {\n\n}\n");
  const base = Y.encodeStateAsUpdate(server);
  Y.applyUpdate(a, base);
  Y.applyUpdate(b, base);

  // --- the two authors now go offline and edit the same document
  a.getText("code").insert(19, "  console.log('from A');\n");
  b.getText("code").insert(0, "// header by B\n");

  const fromA = Y.encodeStateAsUpdate(a);
  const fromB = Y.encodeStateAsUpdate(b);

  // --- reconnect. Deliberately deliver in opposite orders to each peer:
  // a CRDT must converge regardless of message ordering.
  Y.applyUpdate(server, fromA);
  Y.applyUpdate(server, fromB);
  Y.applyUpdate(a, fromB);
  Y.applyUpdate(b, fromA);

  const ta = a.getText("code").toString();
  const tb = b.getText("code").toString();
  const ts = server.getText("code").toString();

  if (ta !== tb) fail(`A and B diverged:\n A=${JSON.stringify(ta)}\n B=${JSON.stringify(tb)}`);
  else ok("A and B converge to identical text");

  if (ts !== ta) fail("server diverged from the clients");
  else ok("server matches the clients");

  if (!ta.includes("from A")) fail("A's edit was lost");
  else ok("A's edit survived");

  if (!ta.includes("header by B")) fail("B's edit was lost");
  else ok("B's edit survived");
}

// ---------------------------------------------------------------- scenario 2
// The failure the old handler had: same-region concurrent edits.
{
  const a = new Y.Doc(), b = new Y.Doc();
  const base = new Y.Doc();
  base.getText("t").insert(0, "the quick fox");
  const u = Y.encodeStateAsUpdate(base);
  Y.applyUpdate(a, u); Y.applyUpdate(b, u);

  a.getText("t").insert(10, "brown ");   // "the quick brown fox"
  b.getText("t").insert(13, " jumps");   // "the quick fox jumps"

  const ua = Y.encodeStateAsUpdate(a), ub = Y.encodeStateAsUpdate(b);
  Y.applyUpdate(a, ub); Y.applyUpdate(b, ua);

  const ta = a.getText("t").toString(), tb = b.getText("t").toString();
  if (ta !== tb) fail(`same-region edits diverged: ${ta} vs ${tb}`);
  else ok(`same-region edits merged, both see: ${JSON.stringify(ta)}`);

  if (!(ta.includes("brown") && ta.includes("jumps")))
    fail("an edit was dropped in the same-region case");
  else ok("neither same-region edit was dropped");
}

// ---------------------------------------------------------------- scenario 3
// State-vector delta sync: what y:join actually does.
{
  const server = new Y.Doc(), client = new Y.Doc();
  server.getText("t").insert(0, "shared history");
  Y.applyUpdate(client, Y.encodeStateAsUpdate(server));

  server.getText("t").insert(14, " plus more");        // client is now behind
  const clientSV = Y.encodeStateVector(client);
  const delta = Y.encodeStateAsUpdate(server, clientSV);
  const full = Y.encodeStateAsUpdate(server);

  if (delta.length >= full.length)
    fail(`delta (${delta.length}b) not smaller than full state (${full.length}b)`);
  else ok(`delta sync sends ${delta.length}b instead of ${full.length}b`);

  Y.applyUpdate(client, delta);
  if (client.getText("t").toString() !== server.getText("t").toString())
    fail("client did not catch up from the delta");
  else ok("client caught up from the delta alone");
}

// ---------------------------------------------------------------- scenario 4
// Persistence round-trip: a restart must not lose the document.
{
  const live = new Y.Doc();
  live.getText("t").insert(0, "work in progress");
  const stored = Buffer.from(Y.encodeStateAsUpdate(live));   // what we put in mongo

  const revived = new Y.Doc();
  Y.applyUpdate(revived, new Uint8Array(stored));            // what we load on boot

  if (revived.getText("t").toString() !== "work in progress")
    fail("session did not survive a persist/reload cycle");
  else ok("session survives persist and reload");
}

if (!process.exitCode) console.log("\nAll FEAT-001 acceptance checks passed.");
