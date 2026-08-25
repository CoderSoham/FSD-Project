# FSD-Project — a collaboration workspace for research groups

Discord-style communication with git-style document history. Built for
academics and research groups who need to talk, screen-share and video-call
while working on shared documents — and need a trustworthy record of who
changed what.

The communication half is a Discord-style app: accounts, a friends graph built
on invitations, one-to-one messaging with persisted history, and group video
rooms over WebRTC with screen sharing and call recording.

The collaboration half is version control over the documents themselves:
real-time collaborative editing, versions with parents and branches, diffs
between any two versions, merges, inline comments anchored to a version, and
file sharing inside a room.

**Live:** https://fsd-project-mu.vercel.app · **API:** https://fsd-project-api.vercel.app

> Built as the Full Stack Development course project, MIT World Peace University,
> Oct–Nov 2024.

---

## What it does

| | |
|---|---|
| **Accounts** | Register and log in. Passwords hashed with bcrypt, sessions carried as JWTs, request bodies validated by Joi schemas before they reach a controller. |
| **Friends** | Invite by email, accept or reject. Pending invitations and the friends list update live over the socket — no refresh. |
| **Presence** | Online/offline state is derived from active socket connections and pushed to everyone who has you as a friend. |
| **Direct messages** | One-to-one chat backed by MongoDB. Conversation history loads on open and new messages arrive over the socket. |
| **Video rooms** | Create a room, others join. Peer-to-peer audio/video over WebRTC, with per-participant mic and camera toggles. |
| **Screen share** | Swaps the outgoing video track on the live connection, so no renegotiation is needed. |
| **Call recording** | Records the room stream via RecordRTC and saves it to your machine as an `.mp4`. Entirely local — nothing is uploaded. |
| **Collaborative editing** | A Monaco editor shared over sockets, with live `codeChange` broadcast and cursor presence for everyone in the session. |
| **Document versions** | Every save creates a version carrying its parent, forming a history you can walk rather than a flat list of saves. |
| **Branches and merges** | Branch a document from any version, work independently, and merge back. Useful when two authors take a section in different directions. |
| **Version diffs** | Any two versions rendered side by side via `react-diff-viewer`. |
| **Inline comments** | Comments anchored to a position in a specific version, so review feedback stays attached to the text it refers to. |
| **File sharing** | Upload files into a room; they appear in the room's file list alongside its messages. |

> **Authorship comes from the JWT, never the request body.** A version can only
> be attributed to the account that actually saved it. The history is the
> product here — if it could be forged it would be worthless.

## How it fits together

```
frontend (React 17 + Redux)            backend (Express + Socket.IO)
  authPages/        login, register        routes/           auth, invitations,
  Dashboard/                                                 code, files
    FriendsSideBar/ friends, invites       controllers/      register, login, invite,
    Messenger/      direct chat                              code, codeComment, file
    Room/           video grid, chat       socketHandlers/   9 room handlers
  shared/components/                                         + codeCollabHandler
    CodeEditorPanel monaco + diffs         middleware/       auth, identity
  realtimeCommunication/                   models/           user, message, conversation,
    socketConnection  socket lifecycle                       friendInvitation, codeVersion,
    webRTCHandler     simple-peer wrapper                    codeComment, vcFile, vcMessage
    roomHandler       room state
  store/            5 slices, thunks              MongoDB Atlas
```

**REST handles the things that need to be durable** — registration, login,
invitations. **Sockets handle everything live** — presence, messages, room
membership, and WebRTC signalling. The socket connection authenticates with the
same JWT the REST client uses.

### Socket events

| Handler | Purpose |
|---|---|
| `newConnectionHandler` | Register the socket, broadcast presence, push friends + pending invitations |
| `disconnectHandler` | Tear down, mark offline, remove from any active room |
| `directMessageHandler` | Persist a message, deliver to the recipient if connected |
| `directChatHistoryHandler` | Load and stream a conversation's history |
| `roomCreateHandler` | Open a new room with the creator as first participant |
| `roomJoinHandler` | Add a participant and tell existing members to prepare connections |
| `roomLeaveHandler` | Remove a participant, notify the rest |
| `roomInitializeConnectionHandler` | Trigger peer-connection setup for a new arrival |
| `roomSignalingDataHandler` | Relay SDP offers/answers and ICE candidates between peers |

The server never touches media. It relays signalling only; audio and video flow
directly between browsers.

## Tech

**Frontend** — React 17, Redux Toolkit + thunk, React Router 5, MUI 5,
socket.io-client, simple-peer, RecordRTC, axios
**Backend** — Node, Express 4, Socket.IO 4, Mongoose 6, bcryptjs, jsonwebtoken,
Joi via express-joi-validation
**Data** — MongoDB Atlas · **Hosting** — Vercel (frontend and API deployed separately)

## Running it locally

You need Node 16+ and a MongoDB connection string (Atlas free tier is fine).

```bash
git clone https://github.com/CoderSoham/FSD-Project.git
cd FSD-Project
```

**Backend:**

```bash
cd backend && npm install && cp .env.example .env
```

Fill in `.env` — see [backend/.env.example](backend/.env.example) for the three
keys. Generate the JWT secret with `openssl rand -base64 48`. Then:

```bash
npm start
```

**Frontend**, in a second terminal:

```bash
cd frontend && npm install && npm start
```

Opens on `http://localhost:3000` and talks to the API on `:5002`. To try video,
open a second browser profile or an incognito window and register a second
account — WebRTC needs two real peers.

## Known limitations

These are real and worth knowing before you judge the code:

- **Collaborative editing is last-write-wins.** `codeCollabHandler` broadcasts
  whole-document `codeChange` events and keeps session state in memory. Two
  people typing in the same region will clobber each other, and a server restart
  drops the live session. Proper concurrent editing needs CRDTs or OT — Yjs is
  the obvious route.
- **Merge takes the source branch wholesale.** `mergeBranches` creates a version
  in the target carrying the source's content, parented to the target's tip. It
  records the merge in the graph but does not reconcile competing edits, so it
  is a fast-forward, not a three-way merge.
- **Uploaded files are served from a public static path.** `/uploads` is
  `express.static` with unguessable-ish filenames but no access check, so anyone
  with a URL can fetch a research document. The upload route is authenticated;
  the download path is not.
- **STUN only, no TURN.** `webRTCHandler.js` configures Google's public STUN
  server and leaves the TURN branch as a TODO. Peers behind symmetric NAT or a
  restrictive corporate firewall will fail to connect. A production deployment
  needs a TURN relay (coturn, or a hosted service).
- **Mesh topology.** Every participant opens a peer connection to every other
  one, so connections grow as O(n²). Fine for a handful of people, unworkable
  past roughly six. An SFU (mediasoup, LiveKit) is the fix.
- **Recording is client-side and unencrypted.** RecordRTC captures the local
  stream and `file-saver` writes it to disk. There is no consent prompt for the
  other participants.
- **No tests.** `npm test` in the backend is still the npm-init placeholder.
- **CORS is pinned to the deployed frontend origin** in `server.js`, so a local
  frontend talking to the deployed API will be rejected. Run both locally or
  both deployed.

## Security note

An earlier version of this repository committed `backend/.env`, exposing a
MongoDB connection string and the JWT signing secret. Those credentials have
been rotated and the file removed from history. `.env` is now gitignored;
[backend/.env.example](backend/.env.example) documents the required keys without
values.

## Licence

No licence yet — see the repository owner before reuse.
