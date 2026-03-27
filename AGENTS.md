# AGENTS.md - StreamTrack Operational Guide

This is the primary context file for all agents working in this repository.
Goal: give fast, accurate project understanding without forcing a full codebase read.
Status tracking lives in `specs/IMPLEMENTATION_PLAN.md`.

## 1) Product Snapshot

- Product name: StreamTrack.
- Domain: streaming discovery + watchlist tracking.
- Core promise: find what to watch based on user mood and available subscriptions.
- User problem solved: platform fragmentation across providers.
- Primary interaction modes:
- Search by title.
- Discover by vibe.
- Browse trending.
- Manage watchlist lifecycle.

## 2) Tech Stack (Current, Not Aspirational)

- Monorepo managed with Bun workspaces.
- Frontend: Angular 21 standalone components.
- Frontend test runner: Vitest (`@analogjs/vitest-angular`).
- Frontend styling: Tailwind CSS v4 + CSS variables in `frontend/src/styles.css`.
- Backend: Express 4 on Bun runtime.
- Backend database layer: Mongoose.
- Database: MongoDB.
- Authentication: Firebase Auth (client + Firebase Admin verification).
- External content provider: TMDB API.
- Icons: Lucide Angular.

## 3) Repository Layout

- Root scripts and workspace config in `package.json`.
- Frontend app in `frontend/`.
- Backend API in `backend/`.
- Specs and plan docs in `specs/`.
- Agent skills in `.agent/` and `.agents/` directories.

## 4) Runbook (Most Common Commands)

- Install all deps from root: `bun install`.
- Start both apps from root: `bun run dev`.
- Start frontend only: `cd frontend && bun run start`.
- Start backend only: `cd backend && bun run dev`.
- Build all: `bun run build`.
- Typecheck all: `bun run typecheck`.
- Lint all: `bun run lint`.
- Test all: `bun run test`.

## 5) Ports, URLs, and Local Environment

- Frontend dev server: `http://localhost:4200`.
- Backend API server: `http://localhost:3000`.
- Frontend API base URL (dev): `http://localhost:3000/api`.
- Health endpoint: `GET /health`.
- API info endpoint: `GET /api`.

## 6) Environment Variables

- Root `.env` is used for backend runtime settings.
- Backend expected keys:
- `PORT` (default 3000).
- `MONGO_URI` (default `mongodb://localhost:27017/streamtrack`).
- `TMDB_API_KEY` (required for content features).
- `FIREBASE_SERVICE_ACCOUNT_PATH` (required for token verification).
- Frontend Firebase config lives in `frontend/src/environments/environment.ts`.

## 7) Security and Auth Model

- Frontend authenticates users via Firebase client SDK.
- Frontend obtains Firebase ID token for API calls.
- Backend validates Firebase ID token via Firebase Admin.
- Backend routes requiring auth use `authMiddleware`.
- Auth header contract: `Authorization: Bearer <id_token>`.
- If Firebase Admin is not initialized, token verification fails.
- This means all protected routes will return 401 when Firebase credentials are missing.

## 8) Backend Architecture Summary

- Entry point: `backend/src/index.ts`.
- Route modules:
- `auth.routes.ts`.
- `user.routes.ts`.
- `content.routes.ts`.
- `discover.routes.ts`.
- `watchlist.routes.ts`.
- Service modules:
- `firebase.service.ts`.
- `tmdb.service.ts`.
- `vibe.service.ts`.
- Data model:
- `models/User.ts`.

## 9) Data Model (MongoDB)

- Single primary collection: `User`.
- User fields:
- `firebaseUid` (unique index).
- `email`.
- `name`.
- `photoURL`.
- `services: string[]`.
- `genres: number[]`.
- `watchlist: IWatchlistItem[]`.
- `customVibes: ICustomVibe[]`.
- `createdAt`, `updatedAt` via timestamps.
- Embedded watchlist item fields:
- `contentId`, `title`, `type`, `posterPath`.
- `status` (`want|watching|watched`).
- `rating`, `notes`, `addedAt`, `updatedAt`.
- Embedded custom vibe fields:
- `id`, `name`, `genres`, `minRating`, `color`, `createdAt`.
- Custom vibes max count: 5 per user.

## 10) API Endpoint Inventory

- Public/system:
- `GET /health`.
- `GET /api`.
- Auth:
- `POST /api/auth/register` (auth required).
- `POST /api/auth/login` (auth required).
- `GET /api/auth/me` (auth required).
- User profile preferences:
- `GET /api/user/services` (auth required).
- `PUT /api/user/services` (auth required).
- `GET /api/user/services/available` (public).
- `GET /api/user/genres` (auth required).
- `PUT /api/user/genres` (auth required).
- Content:
- `GET /api/content/search`.
- `GET /api/content/trending`.
- `GET /api/content/upcoming`.
- `GET /api/content/trending/filtered` (auth required).
- `GET /api/content/:type/:id`.
- `GET /api/content/:type/:id/providers`.
- Discover:
- `GET /api/discover/vibes`.
- `GET /api/discover/recommendations` (auth required).
- `GET /api/discover/genres`.
- `GET /api/discover` (auth required).
- `GET /api/discover/tonight` (auth required).
- `GET /api/discover/vibes/custom` (auth required).
- `POST /api/discover/vibes/custom` (auth required).
- `PUT /api/discover/vibes/custom/:id` (auth required).
- `DELETE /api/discover/vibes/custom/:id` (auth required).
- Watchlist:
- `GET /api/watchlist` (auth required).
- `GET /api/watchlist/stats` (auth required).
- `POST /api/watchlist` (auth required).
- `PUT /api/watchlist/:contentId` (auth required).
- `DELETE /api/watchlist/:contentId` (auth required).

## 11) TMDB Integration Notes

- Implemented in `backend/src/services/tmdb.service.ts`.
- Uses a local in-memory LRU cache.
- Cache size configured to 200 entries.
- Default TTL is 10 minutes.
- Uses TMDB base API v3.
- Search endpoint used: `/search/multi`.
- Trending endpoint used: `/trending/{type}/{time}`.
- Discover endpoint used: `/discover/{type}`.
- Detail endpoint used: `/{type}/{id}`.
- Watch provider endpoint used: `/{type}/{id}/watch/providers`.
- Region currently hardcoded to `IN` in service.
- Provider mapping currently includes:
- `netflix` => 8.
- `prime` => 9.
- `jiohotstar` => 337.
- `hbo` => 384.
- `hulu` => 15.
- `apple` => 350.
- `paramount` => 531.

## 12) Vibe System Notes

- Core definitions in `backend/src/services/vibe.service.ts`.
- Predefined vibes:
- `cozy`.
- `intense`.
- `mindless`.
- `thoughtful`.
- `dark`.
- `funny`.
- Each vibe can define:
- primary genre IDs.
- optional excluded genres.
- optional minimum rating.
- optional max runtime (currently not strongly enforced).
- Discover route supports both predefined and custom vibes.
- Custom vibe ID format in API requests: `custom-{id}`.
- Tonight's pick uses local-time slots (morning/evening/night) to pick a primary vibe and prioritize top-rated titles, preferring the user's subscriptions when available.

## 13) Watchlist Behavior Notes

- Watchlist is embedded in User document.
- Add endpoint rejects duplicates by `contentId`.
- Stats endpoint returns counts by status and by type.
- Update endpoint supports partial updates.
- List endpoint optionally filters by `status` query.
- List endpoint sorts by `addedAt` descending.

## 14) Frontend Architecture Summary

- Router config in `frontend/src/app/app.routes.ts`.
- App config providers in `frontend/src/app/app.config.ts`.
- Core layers:
- `core/guards`.
- `core/interceptors`.
- `core/services`.
- Feature pages under `features/`.
- Shared UI under `shared/components/`.
- Shared animation helpers under `shared/animations/`.

## 15) Frontend Route Map

- `/` => Home.
- `/welcome` => Welcome page.
- `/onboarding` => parent route (auth only).
- `/onboarding/providers`.
- `/onboarding/genres`.
- `/onboarding/preview`.
- `/discover` redirects to `/`.
- `/watchlist` (auth only).
- `/search`.
- `/account` (auth only).
- `/login` (guest only).
- `/register` (guest only).

## 16) Frontend Service Layer

- `AuthService` handles Firebase auth lifecycle and backend sync.
- `DiscoverService` wraps discover/search/trending/tonight endpoints.
- `UserService` manages services + genres preferences.
- `WatchlistService` keeps signal-based local watchlist state.
- `authInterceptor` auto-attaches Firebase token to API calls.

## 17) UI and Design System Reality

- Global tokens are in `frontend/src/styles.css`.
- App uses dark streaming-oriented theme.
- Accent red aligns with Netflix-like palette.
- `Roboto` is currently the active font.
- Tailwind is enabled and mixed with component CSS.
- Animations are used for card, modal, and interactive states.
- Provider icons live under `frontend/public/icons/providers/`.

## 18) Testing and Quality

- Backend tests run with `bun test`.
- Frontend tests run with `vitest --run`.
- Root command executes both test suites.
- Root typecheck and lint commands chain frontend and backend scripts.
- Some historical backend test typing friction is documented in implementation plan.

## 19) Known Constraints and Operational Gotchas

- Firebase admin credentials missing => protected APIs fail.
- TMDB API key missing => content/discovery APIs fail or return empty.
- CORS currently allows `http://localhost:4200` only.
- Provider mapping is explicitly region-sensitive (`IN`).
- Discover and filtered trending can be API-call heavy due provider checks.

## 20) Agent Workflow Expectations

- Read this file first before code edits.
- Read `specs/IMPLEMENTATION_PLAN.md` for active phase context.
- Keep implementation aligned to existing Angular standalone patterns.
- Prefer signal-based state in frontend where state is local/app reactive.
- Keep backend logic in service modules, route modules thin.
- Preserve API response shapes unless migration is planned.

## 21) Skills and Frontend Enforcement

- For frontend changes, use `senior-frontend` skill workflow.
- Required pre-read:
- `.agent/skills/senior-frontend/SKILL.md`.
- `.agent/skills/senior-frontend/references/frontend_best_practices.md`.
- Expected analysis commands:
- `python .agent/skills/senior-frontend/scripts/bundle_analyzer.py frontend`.
- `python .agent/skills/senior-frontend/scripts/frontend_scaffolder.py --analyze`.

## 22) Current Priorities (Condensed)

- Keep API behavior stable.
- Reduce inconsistency between docs and implementation.
- Improve onboarding and home discover quality.
- Maintain watchlist/search reliability.
- Preserve performance and avoid unnecessary architectural churn.

## 23) Definition of Done for Most Changes

- Code compiles and typechecks.
- Lint passes where relevant.
- Tests added/updated for behavior changes.
- No breaking API contract changes without explicit note.
- Update `specs/IMPLEMENTATION_PLAN.md` if sprint status changed.
- Keep this file current when architecture changes materially.

## 24) Practical Quick Start for New Agent

- Step 1: `bun install`.
- Step 2: ensure MongoDB is running.
- Step 3: configure `.env` with TMDB + Firebase admin path.
- Step 4: `bun run dev`.
- Step 5: verify `http://localhost:3000/health`.
- Step 6: verify frontend loads on `http://localhost:4200`.
- Step 7: sign in to validate auth-protected screens and APIs.

## 25) What Was Removed from Specs and Why

- Legacy speculative docs were removed when they duplicated or contradicted code.
- UI concept duplicates were removed to avoid conflicting instructions.
- A React component artifact in `specs/` was removed from active docs scope.
- Remaining specs are intentionally minimal and operational.

## 26) Source of Truth Hierarchy

- First: running code under `frontend/src` and `backend/src`.
- Second: this `AGENTS.md` overview.
- Third: `specs/IMPLEMENTATION_PLAN.md` for phase/status notes.
- Fourth: targeted spec docs that mirror actual API or setup behavior.

## 27) Maintenance Rule

- If code and docs disagree, update docs in same change when possible.
- Keep docs short, explicit, and implementation-backed.
- Avoid adding speculative features to operational docs.

## 28) End Notes

- This repository is already functional and beyond scaffold stage.
- Prefer incremental improvements over rewrites.
- Keep momentum by changing only what the task requires.
- Preserve developer ergonomics: clear routes, stable contracts, predictable scripts.
- When uncertain, verify against code before writing docs.
