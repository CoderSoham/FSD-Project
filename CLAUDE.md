# FSD-Project / GitCord

Real-time chat and video platform. The collaboration half (git-backed documents,
live editing) is what differentiates it; the Discord-clone half is not.

Vault note: `Obsidian Notes/Portfolio/10 Projects/FSD Project.md`. Roadmap
FEAT-001..006 are all shipped; current work is hardening and UI polish.

## Stack — read before suggesting anything

**Frontend** `frontend/` — React on **Create React App** (`react-scripts`).

| Concern | What is actually used |
|---|---|
| Components & styling | **MUI (`@mui/material`) + Emotion** |
| State | Redux Toolkit, `redux-thunk` |
| Code editing | Monaco (`@monaco-editor/react`) + `y-monaco` |
| Rich text | TipTap + `y-prosemirror` |
| Collaboration | **Yjs CRDT** (`yjs`, `y-protocols`) |
| Realtime | `socket.io-client` |
| Video | `simple-peer` (WebRTC), `recordrtc` |
| Misc UI | `react-rnd`, `react-diff-viewer`, `react-toastify` |

> **There is no Tailwind and no shadcn/ui here.** Do not propose them, do not
> generate `className="flex gap-4"` markup, and do not suggest `tweakcn`.
> Styling goes through MUI's `sx` prop, `styled()`, or the theme — matching what
> the surrounding component already does.

**Backend** `backend/` — Express, MongoDB, JWT auth, nine socket handlers.

## Tooling for this project

Allowed when the task matches — otherwise nothing loads:

- **`frontend-design` plugin** — new or restyled UI. Constrain it to MUI; its
  default instinct is Tailwind.
- **`impeccable`** — a deliberate design pass on existing screens. Run
  `/impeccable init` once so `DESIGN.md` records that the component library is
  MUI, then `audit` / `polish`.
- **`chrome-devtools` MCP** — configured in `.mcp.json` here. Use it for the
  things that only break in a real browser: video tiles not rendering, Yjs
  desync between two clients, socket reconnection. **Not** for backend bugs.
- **`/code-review`** — this repo has git, so reviews work. Use it before pushing.

## Known ground

- CRA is deprecated upstream. Migrating to Vite is a real option but it is a
  separate decision — do not start it as a side effect of another task.
- WebRTC and Yjs bugs are usually **two-client** bugs. A single browser tab will
  not reproduce them; open two contexts.
- `frontend/src/styles/` is currently untracked. Decide whether it belongs in
  git before adding more to it.
- The API was recently hardened against malformed requests and database
  outages — preserve those guards when refactoring routes.
