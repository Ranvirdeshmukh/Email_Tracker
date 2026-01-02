# Email Tracker

An email tracking system with a Chrome extension, tracking server, and analytics dashboard.

## Stack

- **Monorepo**: pnpm workspaces
- **Dashboard**: Next.js (App Router) + TypeScript + Tailwind
- **Server**: Node + Express + TypeScript + SQLite (better-sqlite3)
- **Extension**: Chrome Manifest V3

## Project Structure

```
/
├── apps/
│   ├── dashboard/     # Next.js dashboard (port 3000)
│   ├── server/        # Express API server (port 8080)
│   └── extension/     # Chrome MV3 extension
├── package.json       # Root workspace config
└── pnpm-workspace.yaml
```

## Prerequisites

- Node.js >= 18
- pnpm (`npm install -g pnpm`)

## Installation

```bash
# Install all dependencies
pnpm install
```

## Development

```bash
# Run server + dashboard together
pnpm dev

# Or run individually:
pnpm dev:server    # Server on http://localhost:8080
pnpm dev:dashboard # Dashboard on http://localhost:3000
```

## Loading the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `apps/extension` folder
5. Navigate to https://mail.google.com
6. You should see a floating "Open Dashboard" button

## Configuration

| Component  | Config Location                        | Key Variables                    |
|------------|----------------------------------------|----------------------------------|
| Server     | `apps/server/src/index.ts`             | `PORT = 8080`                    |
| Dashboard  | `apps/dashboard/.env.local`            | `NEXT_PUBLIC_API_BASE`           |
| Extension  | `apps/extension/config.js`             | `API_BASE`, `DASHBOARD_URL`      |

## Smoke Test Checklist

- [ ] **Server health**: `curl http://localhost:8080/health` returns `{"ok":true}`
- [ ] **Database**: `apps/server/data/tracker.db` file is created on server start
- [ ] **Dashboard**: http://localhost:3000 shows "Server OK" when server is running
- [ ] **Dashboard error**: http://localhost:3000 shows error when server is stopped
- [ ] **Extension loads**: Console shows "mailtracker loaded" on mail.google.com
- [ ] **Extension button**: Floating "Open Dashboard" button appears on Gmail
- [ ] **Extension click**: Button opens http://localhost:3000 in new tab

## Scripts

| Command            | Description                              |
|--------------------|------------------------------------------|
| `pnpm dev`         | Run server + dashboard concurrently      |
| `pnpm dev:server`  | Run server only                          |
| `pnpm dev:dashboard` | Run dashboard only                     |
| `pnpm build`       | Build all packages                       |
| `pnpm lint`        | Lint all packages                        |
| `pnpm format`      | Format code with Prettier                |
| `pnpm format:check`| Check formatting                         |

## License

Private
