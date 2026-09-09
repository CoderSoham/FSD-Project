# GitCord

A collaboration workspace for research groups. Discord-style communication with
git-style history over the documents themselves.

The idea is straightforward. A research group needs to talk, screen share and
video call while working on a shared paper or a shared analysis, and it needs a
record of who changed what that holds up later. Chat tools give you the first
half. Version control gives you the second. Nothing gives you both in one place,
so people end up with a Discord server, a Google Doc, and a repository that
disagrees with both.

**Live:** https://fsd-project-mu.vercel.app
**API:** https://fsd-project-api.vercel.app

## What it does

### Talking to people

Register and log in, invite people by email, and accept or reject invitations.
Presence comes from live socket connections, so the friends list shows who is
actually around without a refresh. Direct messages persist in MongoDB and
history loads when you open a conversation.

Video rooms are peer to peer over WebRTC. Create a room, others join, and each
person can toggle their own microphone and camera. Screen sharing swaps the
outgoing video track on the connection that is already open, so nothing has to
be renegotiated. You can record a call, which happens entirely in your browser
and writes an mp4 to your machine. Nothing is uploaded.

### Working on documents

The code editor is Monaco bound to a Yjs CRDT. Two people typing in the same
file at the same time both keep their edits, and an edit made while your
connection is down reconciles when it comes back. Cursors are carried by
awareness, so you can see where someone else is working.

There is a second editor for prose, built on TipTap, running on the same
transport and the same version model. Papers get written in a prose editor and
analysis gets written in a code editor, and neither has to pretend to be the
other.

### Keeping the history

Every save creates a version that records its parent, so the history is a graph
you can walk rather than a pile of saves. From there:

**Branches and merges.** Branch from any version, and merge back with a real
three way merge. The common ancestor is found by walking the version graph.
Edits that do not overlap are kept from both sides. Edits that do overlap become
labelled conflict blocks, because a merge tool that silently picks a winner is
worse than one that admits it cannot decide.

**Diffs.** Any two versions side by side, or the tips of two branches against
each other.

**Comments.** Anchored to a range of lines in a specific version, so review
feedback stays attached to the text it was about.

**Citable versions.** Publish a version to a stable public URL. The page carries
a plain reference, a BibTeX entry, and a sha256 of the content, so a reader
following a citation can confirm the text in front of them is the text that was
cited. It is off by default. Until an author publishes a version, it cannot be
reached without an account, and an unpublished version is indistinguishable from
one that does not exist.

**Export.** The whole version graph comes out as a `git fast-import` stream.
`git init` followed by `git fast-import` gives you a real repository with the
branches, merge commits, authors and dates intact. This matters more than it
sounds: work that cannot leave a tool is hostage to it.

**File sharing.** Upload into a room and the file appears alongside its
messages. Downloads go through an authenticated route that checks an access
list captured at upload time. Nothing is served from a public path, and a
request for a file you cannot see returns the same 404 as a file that does not
exist.

> Authorship comes from the JWT, never from the request body. A version can only
> be attributed to the account that actually saved it. The history is the whole
> point here, and a history that can be forged is worth nothing.

Prose is stored as Markdown rather than as editor JSON. That choice is what
keeps diffs, merges and conflict blocks readable for prose as well as code, and
it means the work leaves in a format that will outlive this project.

## How it fits together

```
frontend (React 17 + Redux)            backend (Express + Socket.IO)
  authPages/        login, register      routes/          auth, invitations,
  Dashboard/                                              code, files, public
    FriendsSideBar/ friends, invites     controllers/     register, login, invite,
    Messenger/      direct chat                           code, codeComment, file
    Room/           video grid, chat     socketHandlers/  9 room handlers
  shared/components/                                      + codeCollabHandler
    CodeEditorPanel monaco + collab      middleware/      auth, identity,
    ProseEditorPanel tiptap                               asyncHandler, errorHandler
    editor/         history, branches,   utils/           threeWayMerge, versionGraph,
                    comments, diffs                       citation, gitExport
  realtimeCommunication/                 models/          user, message, conversation,
    socketConnection, webRTCHandler,                      friendInvitation, codeVersion,
    roomHandler                                           codeComment, vcFile, vcMessage
  store/            5 slices, thunks           MongoDB
```

REST handles what has to be durable: registration, login, invitations, versions,
files. Sockets handle what has to be live: presence, messages, room membership,
CRDT updates, and WebRTC signalling. Both authenticate with the same JWT.

The server never touches media. It relays signalling only, and audio and video
go directly between browsers.

### Socket events

| Handler | Purpose |
|---|---|
| `newConnectionHandler` | Register the socket, broadcast presence, push friends and pending invitations |
| `disconnectHandler` | Tear down, mark offline, remove from any active room |
| `directMessageHandler` | Persist a message, deliver it if the recipient is connected |
| `directChatHistoryHandler` | Load and stream a conversation's history |
| `roomCreateHandler` | Open a room with the creator as its first participant |
| `roomJoinHandler` | Add a participant and tell existing members to prepare connections |
| `roomLeaveHandler` | Remove a participant and notify the rest |
| `roomInitializeConnectionHandler` | Trigger peer connection setup for a new arrival |
| `roomSignalingDataHandler` | Relay SDP offers, answers and ICE candidates |
| `codeCollabHandler` | Relay Yjs document updates and awareness between everyone in a session |

## Tech

**Frontend.** React 17, Redux Toolkit with thunk, React Router 5, MUI 5,
socket.io-client, simple-peer, RecordRTC, axios, Monaco, TipTap, Yjs with
y-monaco and y-prosemirror.

**Backend.** Node, Express 4, Socket.IO 4, Mongoose 6, bcryptjs, jsonwebtoken,
Joi through express-joi-validation, node-diff3, Yjs.

**Data.** MongoDB. **Hosting.** The frontend is static and goes on any CDN.
The API is a long-running Node service, because socket.io needs a process that
outlives a request. [render.yaml](render.yaml) describes it, and
[backend/Dockerfile](backend/Dockerfile) covers any container host.

## Running it

You need Node 16 or later.

```bash
git clone https://github.com/CoderSoham/GitCord.git
cd GitCord
```

### The quick way, with no database

```bash
cd backend && npm install && npm run dev
```

This starts a throwaway in-memory MongoDB, seeds it, and runs the API against
it. No `.env` needed.

The seed creates four accounts that are already friends with each other, because
a fresh database is useless for actually trying this: you cannot message anyone,
call anyone, or test collaborative editing, and registering two accounts and
exchanging invitations before every test is enough friction to stop you testing
at all.

```
ada@example.com  grace@example.com  alan@example.com  katherine@example.com
password: devpassword
```

It also seeds `paper.md` with history on `main` and a `results` branch, so the
version list, the diff and the merge have something in them. Sign in as two
different people in two browser profiles to exercise the realtime paths.

Everything is discarded when you stop it, which is the point.

### With your own database

```bash
cd backend && npm install && cp .env.example .env
```

Fill in `.env`. See [backend/.env.example](backend/.env.example) for the keys,
and generate the JWT secret with `openssl rand -base64 48`. Then `npm start`,
or `npm run dev:watch` to restart on save.

If the API starts but every request comes back 503, the database is unreachable.
`GET /healthz` says which of the two is unhappy. `GET /livez` answers whenever
the process is up, regardless of the database, and is what a host's health check
should point at.

### The frontend

In a second terminal:

```bash
cd frontend && npm install && npm start
```

It opens on port 3000 and talks to the API on 5002. Set
`REACT_APP_API_ORIGIN` to point it somewhere else; see
[frontend/.env.example](frontend/.env.example).

## Tests

Three layers, because each one catches things the others cannot see.

```bash
cd backend && npm test          # 8 suites
cd frontend && npm run test:ci  # 98 tests
npx playwright test             # 49 tests, starts both servers itself
```

**Backend.** Six acceptance suites, one per feature, plus an integration suite
that boots the real Express app against an in-memory MongoDB and drives the HTTP
surface, plus an adversarial suite of about thirty malformed and hostile
requests: malformed ids, oversized bodies, traversal attempts and unauthorised
access, asserting each one returns a 4xx and leaves the process running.

**Frontend.** React Testing Library over the extracted editor components, the
validators, the API error messages, the Markdown conversion, the citation page,
and the video tile.

**End to end.** Playwright, starting both servers itself against the seeded
in-memory database, so a run needs no setup. It covers two browsers editing one
document and converging, an edit made offline arriving on reconnect, the full
branch and merge flow through the interface, a citation page opening in a
browser that has never signed in, upload and download permissions, video tiles
driven by a real MediaStream from a fake camera, and a design suite that
measures WCAG AA contrast on every visible text node in both themes.

## Licence

Ask before reusing.
