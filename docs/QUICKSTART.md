# AnatoView Developer Quickstart

Get the full AnatoView development stack running in 5 steps.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Docker Desktop** | 4.x+ | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Node.js** | 20 LTS | `brew install node@20` or [nodejs.org](https://nodejs.org/) |
| **mkcert** | latest | `brew install mkcert` |
| **Git** | 2.x+ | `brew install git` |

> **macOS users:** All `brew install` commands require [Homebrew](https://brew.sh/).

---

## Step 1: Clone and Install

```bash
git clone https://github.com/YOUR_ORG/anatoview.git
cd anatoview
npm install
```

## Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` — for local development the defaults work out of the box.
The only value you might want to set now:

```bash
# Generate a development JWT secret
JWT_SECRET=$(openssl rand -hex 32)
```

## Step 3: Generate LTI Keys (optional)

> **Canvas not required.** AnatoView works without Canvas LTI for local
> development. The seed script creates dev users and the frontend
> auto-logs in as a dev instructor. You can skip this step and come back
> to it when you have Canvas credentials.

```bash
bash scripts/generate-lti-keys.sh
```

This creates an RSA 4096-bit key pair at:
- `infrastructure/keys/private.pem` (gitignored)
- `infrastructure/keys/public.pem`

## Step 4: Generate Local SSL Certificates

```bash
# Install the local CA (one time)
mkcert -install

# Generate certs for localhost
mkdir -p infrastructure/nginx/certs
mkcert -cert-file infrastructure/nginx/certs/localhost.pem \
       -key-file infrastructure/nginx/certs/localhost-key.pem \
       localhost 127.0.0.1 ::1
```

> **Note:** mkcert creates certificates trusted by your browser.
> No "Your connection is not private" warnings.

## Step 5: Start the Stack

```bash
# Start all 7 services (nginx, web, api, worker, postgres, redis, localstack)
make up

# Wait for services to be ready (~15-20s on first run)
# Then run database migrations
make migrate

# Seed the database with 7 animals, 110 structures, 8 SVG models, and dev users
make seed
```

That's it! The full stack is now running.

Open **https://localhost** &mdash; you'll be auto-logged in as **Dev Instructor**.

---

## Accessing the App

| Service | URL | Notes |
|---------|-----|-------|
| **AnatoView App** | [https://localhost](https://localhost) | Main application (React frontend via nginx) |
| **API Health** | [http://localhost/api/health](http://localhost/api/health) | JSON health check endpoint |
| **Adminer (DB GUI)** | [http://localhost:8080](http://localhost:8080) | Start with `docker compose --profile tools up -d adminer` |
| **LocalStack S3** | [http://localhost:4566](http://localhost:4566) | S3-compatible API for model SVGs |
| **Prisma Studio** | Run command below | Visual database browser |

### Development Without Canvas

AnatoView runs fully without a Canvas LMS connection. When no LTI tokens
are present, the frontend automatically calls `POST /api/auth/dev-login`
and logs in as one of the seeded dev users:

| User | Role | Email |
|------|------|-------|
| Dev Instructor | `instructor` | instructor@anatoview.dev |
| Dev Student | `student` | student@anatoview.dev |

The dev-login endpoint is **disabled in production** (`NODE_ENV=production`).

To switch roles, open the browser console and run:

```js
// Log in as student instead
fetch('/api/auth/dev-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ role: 'student' }),
})
  .then(r => r.json())
  .then(console.log);
// Then hard-refresh the page
```

**Auth hydration:** If you refresh the page, the app automatically calls `GET /api/auth/me` to re-hydrate user and course state from the stored JWT &mdash; no need to re-login.

When you're ready to connect Canvas, follow the
[Canvas registration guide](../scripts/canvas-registration.md) and set
`LTI_CLIENT_ID`, `CANVAS_BASE_URL`, and `FRONTEND_URL` in your `.env`.

### Start Adminer (Database GUI)

```bash
docker compose --profile tools up -d adminer
# Then open http://localhost:8080
#   System:   PostgreSQL
#   Server:   postgres
#   Username: anatoview
#   Password: secret
#   Database: anatoview
```

### Start Prisma Studio

```bash
docker compose exec api npx prisma studio
# Opens at http://localhost:5555 (forwarded from container)
```

---

## Key Features to Explore

Once the stack is running, here's what you can do:

### As an Instructor (default dev user)

1. **Dashboard** &mdash; see your labs, stats, and quick actions
2. **Create Lab** &mdash; 6-step wizard: pick animal, organ systems, structures, configure grading, set rubric, publish
3. **Specimen Library** &mdash; browse all 7 animals and 110 anatomical structures
4. **Grade Center** &mdash; view student attempts, override grades, sync to Canvas
5. **Analytics** &mdash; score distributions, per-structure difficulty charts

### As a Student (switch via dev-login)

1. **Dashboard** &mdash; see assigned labs
2. **Lab Preview** &mdash; view instructions, structure list, and start button
3. **Dissection Lab** &mdash; interactive SVG viewer with layer controls, answer input, hints, and timer
4. **Results Page** &mdash; post-submission score card with per-structure breakdown, correct/incorrect indicators, hints used, time spent

### UI Features

- **Dark Mode** &mdash; toggle via the moon/sun icon in the sidebar footer; persists across sessions
- **Toast Notifications** &mdash; success/error feedback for key actions
- **Responsive Layout** &mdash; sidebar collapses on mobile, dissection view stacks vertically
- **Error Boundary** &mdash; graceful error recovery if a component crashes

### Real-time Updates

Open the Grade Center in one tab and submit a lab attempt in another. The Grade Center receives live updates via Socket.IO &mdash; look for the green "LIVE" indicator.

---

## Common Development Commands

```bash
# ── Docker ────────────────────────────
make up              # Start all services
make down            # Stop all services
make reset           # Nuke volumes, rebuild, migrate, seed
make logs            # Tail logs from all services

# ── Database ──────────────────────────
make migrate         # Run Prisma migrations
make seed            # Seed DB + upload SVGs to LocalStack S3
npm run db:reset     # Reset DB (drop + recreate + migrate + seed)
npm run db:studio    # Open Prisma Studio

# ── Testing ───────────────────────────
make test            # Run API unit tests (32+ grading tests)
make test-e2e        # Run Playwright E2E tests (4 spec files)
npm run test:e2e:ui  # Playwright E2E with interactive UI
npm run test:e2e:headed  # E2E in headed browser

# ── TypeScript ────────────────────────
cd apps/web && npx tsc --noEmit    # Check frontend types
cd apps/api && npx tsc --noEmit    # Check backend types

# ── Shell ─────────────────────────────
make shell           # Bash shell in API container
npm run shell:db     # psql shell in Postgres
```

---

## Project Structure

```
anatoview/
├── apps/
│   ├── api/                    # Express + Prisma backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # 13-model database schema
│   │   │   └── seed.ts         # Seed script (7 animals, 110 structures, S3 upload)
│   │   └── src/
│   │       ├── config/         # Database, Redis, LTI, S3, Socket.IO config
│   │       ├── middleware/     # Auth, RBAC, error handling
│   │       ├── routes/         # REST API routes
│   │       ├── services/       # Grading, LTI, storage services
│   │       └── worker/         # Bull queue job processors
│   │
│   └── web/                    # Vite + React + MUI frontend
│       └── src/
│           ├── api/            # API client (axios), React Query hooks, Socket.IO client
│           ├── components/
│           │   ├── dissection/ # DissectionViewer, LayerPanel, AnswerInput, HintDrawer,
│           │   │               #   AnatomyToolbar, DissectionProgress, StructureLabel,
│           │   │               #   StructurePopover, StructureSearch
│           │   ├── grading/    # AttemptReview, ClassAnalytics, GradeOverrideField,
│           │   │               #   LiveIndicator, StructureGradeRow
│           │   ├── labs/       # Lab Builder wizard (6 steps)
│           │   ├── layout/     # AppShell (responsive sidebar, dark mode toggle)
│           │   ├── shared/     # RoleGuard, ErrorBoundary, SnackbarProvider
│           │   └── specimens/  # AnimalFormDialog (CRUD for specimens)
│           ├── pages/          # Dashboard, LabBuilder, LabView, DissectionLab,
│           │                   #   LabResults, GradeCenter, Analytics,
│           │                   #   SpecimenLibrary, SpecimenManage, Unauthorized
│           ├── stores/         # Zustand (useAppStore, useDissectionStore)
│           └── theme/          # MUI theme with light/dark mode (createAppTheme)
│
├── packages/
│   ├── shared/                 # Shared types and utilities
│   └── lti/                    # LTI 1.3 helpers
│
├── infrastructure/
│   ├── keys/                   # LTI RSA keys (gitignored)
│   ├── localstack/             # S3 bucket initialization
│   ├── models/                 # SVG dissection models (8 models, 7 animals)
│   │   ├── cat/
│   │   │   ├── cardiovascular/ # Cat heart (20 structures)
│   │   │   └── digestive/      # Cat GI tract (15 structures)
│   │   ├── rat/cardiovascular/ # Rat heart (14 structures)
│   │   ├── pig/cardiovascular/ # Fetal pig heart (18 structures)
│   │   ├── frog/cardiovascular/ # Frog heart (12 structures)
│   │   ├── worm/cardiovascular/ # Earthworm (10 structures)
│   │   ├── grasshopper/cardiovascular/ # Grasshopper (10 structures)
│   │   └── crayfish/cardiovascular/    # Crayfish (10 structures)
│   ├── nginx/                  # Nginx configs (dev/prod/SPA)
│   └── postgres/               # DB initialization SQL
│
├── scripts/                    # Utility scripts
│   ├── generate-lti-keys.sh    # RSA key pair generator
│   ├── upload-models.sh        # Upload SVGs to LocalStack S3
│   ├── setup-prod-env.sh       # Production .env generator
│   └── canvas-registration.md  # Canvas LTI setup guide
│
├── tests/e2e/                  # Playwright E2E tests (4 spec files)
│   ├── fixtures.ts             # Auth fixtures with JWT injection
│   ├── helpers/                # Auth, seed, global-setup utilities
│   ├── instructorCreatesLab.spec.ts
│   ├── studentCompletesLab.spec.ts
│   ├── studentReviewsResults.spec.ts
│   └── gradePassback.spec.ts
│
├── .github/workflows/
│   ├── ci.yml                  # CI: typecheck, test, build, E2E
│   └── deploy.yml              # CD: build images, SSH deploy on release
│
├── docker-compose.yml          # Development stack (7 services)
├── docker-compose.test.yml     # Test environment overrides
├── docker-compose.prod.yml     # Production overrides
├── .env.example                # Environment variable template
└── Makefile                    # Dev shortcuts
```

---

## Canvas LTI Integration (Local Development)

To test the Canvas LTI launch locally, you'll need an ngrok tunnel:

```bash
# 1. Install ngrok
brew install ngrok

# 2. Start your AnatoView stack
make up

# 3. Start ngrok tunnel (in a separate terminal)
ngrok http 80

# 4. Use the ngrok HTTPS URL to register in Canvas
#    See: scripts/canvas-registration.md
```

The full Canvas registration guide is at
[`scripts/canvas-registration.md`](../scripts/canvas-registration.md).

---

## Database Schema

AnatoView uses Prisma ORM with PostgreSQL. The schema contains 13 models:

| Model | Purpose |
|-------|---------|
| `Institution` | University Canvas instance (LTI client config) |
| `User` | Instructors, TAs, students (synced from Canvas via LTI) |
| `Course` | Canvas course linked to institution |
| `Category` | Animal grouping (mammal, amphibian, annelid, arthropod) |
| `Animal` | Specimen (belongs to a category, has models) |
| `DissectionModel` | SVG model for a specific organ system of an animal |
| `AnatomicalStructure` | Named structure within a model (110 total) |
| `Lab` | Assignment created by instructor |
| `LabStructure` | Join table linking labs to selected structures |
| `LabAttempt` | Student's attempt at a lab (status, score, timestamps) |
| `StructureResponse` | Student's answer for a single structure |
| `DissectionEvent` | Click, hover, zoom, hint events for analytics |
| `GradeSyncLog` | Canvas grade passback audit trail |

---

## Environment Variables Reference

| Variable | Default (Dev) | Required (Prod) | Description |
|----------|--------------|-----------------|-------------|
| `NODE_ENV` | `development` | `production` | Runtime environment |
| `PORT` | `3001` | Optional | API server port |
| `JWT_SECRET` | `dev_jwt_secret_...` | **Yes** | JWT signing key (min 32 chars) |
| `DATABASE_URL` | Docker default | **Yes** | PostgreSQL connection string |
| `REDIS_URL` | Docker default | **Yes** | Redis connection string |
| `CANVAS_BASE_URL` | &mdash; | **Yes** | Canvas instance URL |
| `LTI_CLIENT_ID` | &mdash; | **Yes** | Canvas Developer Key ID |
| `LTI_KEY_ID` | `anatoview-dev-key` | Optional | RSA key identifier |
| `FRONTEND_URL` | `http://localhost` | **Yes** | Public frontend URL (LTI redirects, CORS) |
| `S3_ENDPOINT` | `http://localstack:4566` | Optional | S3 endpoint (blank for AWS) |
| `S3_BUCKET` | `anatoview-assets` | Optional | S3 bucket name |
| `AWS_ACCESS_KEY_ID` | `test` | **Yes** | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | `test` | **Yes** | AWS credentials |
| `AWS_REGION` | `us-east-1` | Optional | AWS region for S3 |

Optional variables (commented out in `.env.example`):
- `LTI_PLATFORM_AUTH_ENDPOINT`, `LTI_PLATFORM_TOKEN_ENDPOINT`, `LTI_PLATFORM_JWKS_ENDPOINT` &mdash; Canvas platform URLs (usually auto-configured)
- `LTI_DB_URL` &mdash; MongoDB connection for ltijs state storage
- `SMTP_*` &mdash; Email notification configuration
- `SENTRY_DSN` &mdash; Error tracking
- `LOG_LEVEL` &mdash; Logging verbosity

---

## Testing

### Unit Tests (Jest)

```bash
make test    # Runs in Docker with PostgreSQL + Redis
```

Includes 32+ grading unit tests covering:
- Answer normalization (lowercase, trim, punctuation removal)
- Levenshtein fuzzy matching with configurable threshold
- Hint penalty calculations
- Partial credit scoring
- Percentage and scale calculations

### E2E Tests (Playwright)

```bash
make test-e2e               # Run all 4 spec files
npm run test:e2e:ui         # Interactive Playwright UI
npm run test:e2e:headed     # Run in headed browser
```

Four spec files cover the full user journey:

| Spec | Tests |
|------|-------|
| `instructorCreatesLab.spec.ts` | Lab Builder wizard flow through publish |
| `studentCompletesLab.spec.ts` | Dissection, answers, hints, submission |
| `studentReviewsResults.spec.ts` | Score card, structure breakdown, navigation (6 tests) |
| `gradePassback.spec.ts` | Canvas sync, retry, sync log verification |

**E2E auth mechanism:** Tests inject auth state via `window.__E2E_INJECT_USER__` and `window.__E2E_ACCESS_TOKEN__` using Playwright's `addInitScript`. This bypasses the normal LTI/dev-login flow so tests run deterministically without a Canvas connection.

---

## Troubleshooting

### Docker services won't start

```bash
# Check which services are running
docker compose ps

# View logs for a specific service
docker compose logs api --tail=50

# Full reset (nuclear option)
make reset
```

### Database migration errors

```bash
# Check migration status
docker compose exec api npx prisma migrate status

# Reset and re-migrate (destroys data)
npm run db:reset
```

### Prisma Client out of sync

```bash
# Regenerate after schema changes
docker compose exec api npx prisma generate

# Then restart the API
docker compose restart api
```

### Port conflicts

If ports 80, 443, 3000, 3001, 5432, 6379, or 8080 are already in use:

```bash
# Find what's using a port
lsof -i :80

# Stop the conflicting process, or change ports in docker-compose.yml
```

### Hot Reload not working

The Vite dev server and ts-node-dev both support hot reload via volume mounts.
If changes aren't reflected:

```bash
# Restart the specific service
docker compose restart web   # Frontend
docker compose restart api   # Backend
```

### Socket.IO connection issues

If real-time updates aren't working in the Grade Center:

```bash
# Check that the API is healthy
curl http://localhost/api/health

# Check nginx is proxying WebSocket correctly
docker compose logs nginx --tail=20

# Verify Socket.IO endpoint is accessible
curl http://localhost/api/socket.io/?EIO=4&transport=polling
```

### TypeScript errors after pulling changes

```bash
# Regenerate Prisma client (needed after schema changes)
docker compose exec api npx prisma generate

# Check both apps compile
cd apps/web && npx tsc --noEmit
cd apps/api && npx tsc --noEmit
```
