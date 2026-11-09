# Studora — Student AI Assistant

React + Vite frontend using the same general project organization taught in the EMS frontend: `App.jsx` handles routes, `components/` contains shared layout/route components, and `pages/` contains separate page components.

## Run locally

1. Extract the ZIP and open this folder in VS Code.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the local address printed by Vite.

## Structure

- `src/App.jsx` — application state and React Router routes
- `src/components/Layout.jsx` — shared sidebar/top bar and nested `<Outlet />`
- `src/components/ProtectedRoute.jsx` — shared demo route guard
- `src/pages/` — Login, Dashboard, Documents, Workspace, and History pages
- `src/index.css` — existing Studora styling

The existing UI and demo interactions are preserved. Login, uploaded document metadata, and chat history are currently held in frontend state; Django/API persistence and real AI processing are not connected in this frontend-only ZIP.


## Django document integration

The My Documents page now uploads PDF and TXT files to the Django API at `POST /api/documents/` and loads the authenticated user's saved documents from `GET /api/documents/`. The same upload callback is used by the workspace's document attachment control. Make sure the Django server is running at `http://127.0.0.1:8000/`.

Uploaded files are stored by Django under its configured media folder, and document records/extracted text are stored in SQLite. RAG, ChromaDB, AI summaries, and AI-generated MCQs are not connected yet.
