# ArenaHub

ArenaHub is a full platform for sports arena management with scheduling, POS, finance, inventory, website management, and a dedicated superadmin control layer.

It runs with a modern React frontend and a Node.js backend using a local JSON database, making it easy to start, test, and evolve.

## Highlights

- Complete arena operation flow in one app
- Superadmin mode with dedicated routes and controls
- Initial setup wizard for first superadmin creation
- Backup and restore features for full system state
- Public site + internal management interface
- Local JSON persistence for fast local development

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express, TypeScript runtime via tsx
- Data storage: backend/db.json
- Charts & UI: Recharts, Motion, Lucide icons

## Project Structure

- src: frontend application
- backend: API server and JSON database
- dist: frontend production build output

## Environment Variables

Frontend (.env)

- VITE_API_URL: Backend API base URL
- VITE_FRONTEND_PORT: Frontend dev server port

Backend (backend/.env)

- BACKEND_PORT: Backend API/server port

## Getting Started

1. Install dependencies

npm install

2. Configure env files

- .env
- backend/.env

3. Start the app

npm run dev

4. Open in browser

http://localhost:3000

## First Run Setup

When no superadmin exists, ArenaHub opens setup mode automatically.

You can:

- Create the first superadmin account
- Restore a previous backup before initial login

## Main Features

- Dashboard with operational metrics
- Scheduling and court management
- Client management
- POS workflow and inventory integration
- Financial controls and records
- News and site management
- Superadmin panel:
  - User management
  - Backup and restore
  - System operations

## Scripts

- npm run dev: Start backend + frontend middleware flow
- npm run build: Build frontend for production
- npm run preview: Preview production build
- npm run lint: TypeScript type check

## Notes

- db.json is intentionally ignored from git to avoid committing runtime data.
- .env files are ignored by default for security and portability.

---

ArenaHub was designed to be practical for daily arena operations while staying flexible for future product growth.
