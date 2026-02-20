# AnatoView

**Virtual Dissection Lab Platform for Pre-Veterinary Anatomy Courses**

AnatoView is a web-based anatomy laboratory platform that enables pre-veterinary students to complete interactive virtual dissections, identify anatomical structures, and receive instant graded feedback &mdash; all integrated with Canvas LMS for seamless grade passback.

---

## What It Does

- **Interactive virtual dissections** of 7 animals (cat, rat, fetal pig, frog, earthworm, grasshopper, crayfish) using SVG anatomical models with 110 labeled structures across 8 dissection models
- **Four dissection modes:** Explore (free browsing with hover labels), Identify (type structure names for instant scoring), Quiz (click the correct location), and Practical (timed exam, no hints)
- **Instructor lab builder** &mdash; a 6-step wizard to select an animal, pick organ systems and structures, configure grading rubrics with accepted aliases and hint penalties, and publish directly to Canvas
- **Auto-grading** with Levenshtein fuzzy matching, configurable hint penalties, partial credit, and category weighting
- **Student results review** &mdash; post-submission score card with per-structure breakdown, color-coded correct/incorrect indicators, hint usage, time tracking, and instructor feedback
- **Canvas LMS integration** via LTI 1.3 &mdash; single sign-on, deep linking for assignments, and automatic grade passback through the Assignment and Grade Services (AGS) API
- **Grade center** with per-student drill-down, instructor grade overrides, class analytics (score distributions, per-structure difficulty), CSV export, and bulk Canvas sync
- **Real-time updates** via Socket.IO &mdash; instructors see live submission notifications and grade changes in the Grade Center without refreshing
- **Dark mode** with system-level persistence and smooth theme transitions
- **Global error handling** with error boundaries and toast notifications

---

## Architecture

```
                     ┌─────────────────────────┐
                     │       CANVAS LMS         │
                     │  LTI 1.3 <──> AnatoView  │
                     └────────────┬────────────┘
                                  │ HTTPS / JWT
         ┌────────────────────────▼────────────────────────┐
         │            Docker Network                        │
         │  ┌────────────────────────────────────────────┐  │
         │  │  nginx :80/:443  (reverse proxy + SSL)     │  │
         │  │  /           → web:3000   (React + Vite)   │  │
         │  │  /api/*      → api:3001   (Express)        │  │
         │  │  /lti/*      → api:3001   (LTI 1.3)       │  │
         │  │  /socket.io  → api:3001   (WebSocket)      │  │
         │  └────────────────────────────────────────────┘  │
         │                                                  │
         │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
         │  │ web      │ │ api      │ │ worker           │  │
         │  │ React    │ │ Express  │ │ Bull queue       │  │
         │  │ MUI      │ │ Socket.IO│ │ Grade passback   │  │
         │  └──────────┘ └────┬─────┘ └───────┬──────────┘  │
         │                    │               │              │
         │  ┌──────────┐ ┌────▼────┐ ┌────────▼──────────┐  │
         │  │localstack│ │postgres │ │  redis            │  │
         │  │ S3 mock  │ │ :5432   │ │  :6379            │  │
         │  └──────────┘ └─────────┘ └───────────────────┘  │
         └──────────────────────────────────────────────────┘
```

| Service | Technology | Purpose |
|---------|-----------|---------|
| **nginx** | nginx:alpine | Reverse proxy, SSL termination, WebSocket proxy, rate limiting |
| **web** | React 18 + Vite + MUI + Konva | Interactive frontend with SVG dissection viewer |
| **api** | Express + TypeScript + Prisma + Socket.IO | REST API, LTI 1.3, auto-grading, real-time events |
| **worker** | Bull + Redis | Background Canvas grade passback queue |
| **postgres** | PostgreSQL 15 | Primary database (13 Prisma models) |
| **redis** | Redis 7 | Sessions, caching, job queue |
| **localstack** | LocalStack | S3-compatible storage for SVG models (dev) |

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Vite, Material UI 5, react-konva, TanStack Query, Zustand, react-hook-form + Zod, recharts, socket.io-client |
| **Backend** | Node.js 20, Express, TypeScript, Prisma ORM, ltijs (LTI 1.3), Bull (job queue), jsonwebtoken, socket.io |
| **Database** | PostgreSQL 15 with uuid-ossp and pgcrypto extensions |
| **Infrastructure** | Docker Compose, nginx, Redis 7, LocalStack (S3), GitHub Actions CI/CD |
| **Testing** | Jest + Supertest (API, 32+ unit tests), Playwright (E2E, 4 spec files) |

---

## Prerequisites

| Requirement | Version | Install |
|-------------|---------|---------|
| Docker Desktop | 4.x+ | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Node.js | 20 LTS | `brew install node@20` or [nodejs.org](https://nodejs.org/) |
| mkcert | latest | `brew install mkcert` |

---

## Local Development Setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_ORG/anatoview.git
cd anatoview
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

The defaults work out of the box for local development. Optionally generate a JWT secret:

```bash
# Add to .env
JWT_SECRET=$(openssl rand -hex 32)
```

### 3. Generate LTI keys (optional)

> **Canvas is not required for local development.** The seed script creates
> dev users and the app auto-logs in as a dev instructor. Skip this step if
> you don't have Canvas credentials yet.

```bash
bash scripts/generate-lti-keys.sh
```

Creates an RSA 4096-bit key pair at `infrastructure/keys/private.pem` and `public.pem`.

### 4. Generate local SSL certificates

HTTPS is needed for the local dev environment:

```bash
mkcert -install
mkdir -p infrastructure/nginx/certs
mkcert -cert-file infrastructure/nginx/certs/localhost.pem \
       -key-file infrastructure/nginx/certs/localhost-key.pem \
       localhost 127.0.0.1 ::1
```

### 5. Start the stack

```bash
make up        # starts all 7 Docker containers
make migrate   # runs Prisma database migrations
make seed      # seeds 7 animals, 110 structures, 8 dissection models, dev users, uploads SVGs
```

Open **https://localhost** &mdash; you'll be auto-logged in as **Dev Instructor** (no Canvas needed).

---

## Accessing Services

| Service | URL |
|---------|-----|
| AnatoView App | https://localhost |
| API Health Check | http://localhost/api/health |
| Adminer (DB GUI) | `docker compose --profile tools up -d adminer` then http://localhost:8080 |
| Prisma Studio | `docker compose exec api npx prisma studio` |
| LocalStack S3 | http://localhost:4566 |

---

## Development Without Canvas

AnatoView works fully without a Canvas LMS connection. On startup, the frontend automatically calls `POST /api/auth/dev-login` and logs in as a seeded dev instructor. The dev-login endpoint is disabled when `NODE_ENV=production`.

| Dev User | Role | Email |
|----------|------|-------|
| Dev Instructor | `instructor` | instructor@anatoview.dev |
| Dev Student | `student` | student@anatoview.dev |

The app also supports auth hydration on page refresh &mdash; if a JWT exists in storage, `GET /api/auth/me` is called to re-hydrate user and course state without re-authenticating.

When you're ready to connect Canvas, see [`scripts/canvas-registration.md`](scripts/canvas-registration.md) and set `LTI_CLIENT_ID`, `CANVAS_BASE_URL`, and `FRONTEND_URL` in your `.env`.

---

## Dissection Models

AnatoView ships with 8 SVG dissection models covering 7 animals and 110 anatomical structures:

| Animal | Organ System | Structures | Notes |
|--------|-------------|:----------:|-------|
| Domestic Cat | Cardiovascular | 20 | Four-chambered heart, major vessels |
| Domestic Cat | Digestive | 15 | GI tract from esophagus to rectum |
| Norway Rat | Cardiovascular | 14 | Comparative mammalian anatomy |
| Fetal Pig | Cardiovascular | 18 | Includes fetal-specific: ductus arteriosus, foramen ovale, umbilical vessels |
| Leopard Frog | Cardiovascular | 12 | Three-chambered heart, sinus venosus, conus arteriosus |
| Earthworm | Cardiovascular | 10 | Aortic arches, dorsal/ventral vessels |
| Grasshopper | Cardiovascular | 10 | Open circulatory system, dorsal heart tube |
| Crayfish | Cardiovascular | 10 | Open circulatory system, single-chambered heart |

All models are stored in `infrastructure/models/` and uploaded to S3 during seeding.

---

## Common Commands

```bash
# Docker
make up              # Start all services
make down            # Stop all services
make reset           # Full reset: nuke volumes, rebuild, migrate, seed
make logs            # Tail logs from all services
make shell           # Bash shell in the API container

# Database
make migrate         # Run Prisma migrations
make seed            # Seed DB + upload SVGs to LocalStack S3
npm run db:reset     # Drop + recreate + migrate + seed
npm run db:studio    # Open Prisma Studio

# Testing
make test            # Run API unit tests (Jest)
make test-e2e        # Run Playwright E2E tests
npm run test:e2e:ui  # Playwright with interactive UI
```

---

## Project Structure

```
anatoview/
├── apps/
│   ├── api/                        # Express + Prisma backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # 13-model database schema
│   │   │   └── seed.ts             # Seed script (7 animals, 110 structures, S3 upload)
│   │   └── src/
│   │       ├── config/             # Database, Redis, LTI, S3, Socket.IO config
│   │       ├── middleware/         # JWT auth, RBAC, Zod validation
│   │       ├── routes/             # REST API (animals, labs, attempts, grades, LTI)
│   │       ├── services/           # Grading engine, LTI grade passback, storage
│   │       └── worker/             # Bull queue consumer for Canvas sync
│   │
│   └── web/                        # Vite + React + MUI frontend
│       └── src/
│           ├── api/                # API client, React Query hooks, Socket.IO client
│           ├── components/
│           │   ├── dissection/     # DissectionViewer, LayerPanel, AnswerInput, HintDrawer,
│           │   │                   #   AnatomyToolbar, DissectionProgress, StructureLabel,
│           │   │                   #   StructurePopover, StructureSearch
│           │   ├── grading/        # AttemptReview, ClassAnalytics, GradeOverrideField,
│           │   │                   #   LiveIndicator, StructureGradeRow
│           │   ├── labs/           # Lab Builder wizard (6 steps)
│           │   ├── layout/         # AppShell (responsive sidebar, dark mode toggle)
│           │   ├── shared/         # RoleGuard, ErrorBoundary, SnackbarProvider
│           │   └── specimens/      # AnimalFormDialog (CRUD for specimens)
│           ├── pages/              # Dashboard, LabBuilder, LabView, DissectionLab,
│           │                       #   LabResults, GradeCenter, Analytics,
│           │                       #   SpecimenLibrary, SpecimenManage, Unauthorized
│           ├── stores/             # Zustand (useAppStore, useDissectionStore)
│           └── theme/              # MUI theme with light/dark mode support
│
├── packages/
│   ├── shared/                     # Shared TypeScript types and Zod schemas
│   └── lti/                        # LTI 1.3 utilities
│
├── infrastructure/
│   ├── keys/                       # LTI RSA keys (gitignored)
│   ├── localstack/                 # S3 bucket init script
│   ├── models/                     # SVG dissection models (8 models, 7 animals)
│   │   ├── cat/cardiovascular/     # Cat heart (20 structures)
│   │   ├── cat/digestive/          # Cat digestive (15 structures)
│   │   ├── rat/cardiovascular/     # Rat heart (14 structures)
│   │   ├── pig/cardiovascular/     # Fetal pig heart (18 structures)
│   │   ├── frog/cardiovascular/    # Frog heart (12 structures)
│   │   ├── worm/cardiovascular/    # Earthworm (10 structures)
│   │   ├── grasshopper/cardiovascular/  # Grasshopper (10 structures)
│   │   └── crayfish/cardiovascular/     # Crayfish (10 structures)
│   ├── nginx/                      # nginx configs (dev, prod, SPA)
│   └── postgres/                   # DB init SQL (extensions, test DB)
│
├── scripts/
│   ├── generate-lti-keys.sh        # RSA key pair generator
│   ├── upload-models.sh            # Upload SVGs to LocalStack S3
│   ├── setup-prod-env.sh           # Interactive production .env generator
│   └── canvas-registration.md      # Canvas LTI admin setup guide
│
├── tests/e2e/                      # Playwright E2E tests
│   ├── instructorCreatesLab.spec.ts
│   ├── studentCompletesLab.spec.ts
│   ├── studentReviewsResults.spec.ts
│   └── gradePassback.spec.ts
│
├── .github/workflows/
│   ├── ci.yml                      # CI: typecheck, test, build, E2E
│   └── deploy.yml                  # CD: build images, SSH deploy on release
│
├── docker-compose.yml              # Development stack (7 services)
├── docker-compose.test.yml         # Test environment overrides
├── docker-compose.prod.yml         # Production overrides
├── .env.example                    # Environment variable template
├── Makefile                        # Dev shortcuts
├── FRAMEWORK.md                    # Complete architecture reference
└── package.json                    # npm workspaces root
```

---

## Database Schema

AnatoView uses Prisma ORM with PostgreSQL. The schema contains 13 models:

| Model | Purpose |
|-------|---------|
| `Institution` | University Canvas instance (LTI client config) |
| `User` | Instructors, TAs, students (synced from Canvas via LTI) |
| `Course` | Canvas course linked to institution |
| `Category` | Animal grouping (mammal, amphibian, annelid, arthropod) |
| `Animal` | Specimen (cat, rat, fetal pig, frog, earthworm, grasshopper, crayfish) |
| `DissectionModel` | SVG model for a specific organ system of an animal |
| `AnatomicalStructure` | Named structure within a model (110 total across all models) |
| `Lab` | Assignment created by instructor (structures, rubric, settings) |
| `LabStructure` | Join table linking labs to selected anatomical structures |
| `LabAttempt` | Student's attempt at a lab (status, score, timestamps) |
| `StructureResponse` | Student's answer for a single structure |
| `DissectionEvent` | Click, hover, zoom, hint events for analytics |
| `GradeSyncLog` | Canvas grade passback audit trail |

---

## Real-time Updates (Socket.IO)

AnatoView uses Socket.IO for real-time communication between the API server and web clients. WebSocket connections are authenticated with the same JWT used for REST API calls.

| Event | Direction | Purpose |
|-------|-----------|---------|
| `attempt:progress` | client &rarr; server | Student answers a structure |
| `attempt:progress:update` | server &rarr; room | Broadcast progress to instructor |
| `attempt:submitted` | server &rarr; room | Notify instructor of submission |
| `grade:updated` | server &rarr; room | Notify after grade override |

**Rooms:** Instructors join `lab:{labId}` rooms when viewing the Grade Center. The `LiveIndicator` component shows a green pulsing dot when connected and auto-refreshes data on incoming events.

**nginx:** The `/socket.io` path is proxied to the API server with WebSocket upgrade support.

---

## Canvas LTI Integration

AnatoView integrates with Canvas LMS via the LTI 1.3 standard:

| Endpoint | Purpose |
|----------|---------|
| `GET /lti/jwks` | JSON Web Key Set for Canvas to verify AnatoView's signatures |
| `POST /lti/login` | OIDC login initiation (Canvas redirects here first) |
| `POST /lti/launch` | LTI resource link launch (SSO + course/user sync) |
| `POST /lti/deep-link` | Deep linking response (returns selected lab to Canvas) |

**Supported LTI Advantage Services:**
- Assignment and Grade Services (AGS) &mdash; automatic grade passback to Canvas gradebook
- Names and Role Provisioning Services (NRPS) &mdash; course roster sync

On LTI launch, the API includes course context (`course_id`, `course_name`, `institution_id`) in the redirect hash so the frontend Zustand store hydrates course state automatically.

For Canvas admin setup instructions, see [`scripts/canvas-registration.md`](scripts/canvas-registration.md).

For local development with Canvas, use [ngrok](https://ngrok.com/) to tunnel HTTPS to your local machine.

---

## Grading System

The auto-grading pipeline runs when a student submits a lab attempt:

1. **Normalize** answers (lowercase, trim, remove punctuation)
2. **Exact match** against the correct name, latin name, and rubric aliases
3. **Fuzzy match** via Levenshtein distance (configurable threshold, default &le; 2)
4. **Hint penalty** deduction (hints used &times; penalty rate per structure)
5. **Partial credit** if enabled in the rubric
6. **Category weighting** if the rubric specifies weights by organ system
7. **Write results** to the database (attempt score + per-structure grades)
8. **Emit real-time event** via Socket.IO (`attempt:submitted` to lab room)
9. **Enqueue Canvas sync** via Bull queue (processed by the worker container)

After grading, students are redirected to the **Results page** (`/lab/:id/results`) showing their score card, per-structure breakdown table with correct/incorrect indicators, hints used, time spent, and any instructor feedback.

Instructors can override individual structure grades and re-sync to Canvas from the Grade Center.

---

## Frontend Features

### Dark Mode

The app supports light and dark themes with a toggle in the sidebar. Theme preference is persisted to `localStorage` and applied globally via a dynamic `ThemeProvider`. The theme system includes:
- Refined color palettes optimized for both modes
- Custom shadow system (softer, layered shadows)
- Glass-effect AppBar with `backdrop-filter: blur(12px)`
- Smooth transitions on all interactive elements

### Error Handling

- **Error Boundary** wraps all page content and catches render errors with a friendly recovery UI
- **Toast Notifications** via a global `SnackbarProvider` with queue-based message display
- **API error states** with contextual alerts on every data-fetching page

### Responsive Design

- Sidebar collapses to a temporary drawer on mobile (`md` breakpoint)
- DissectionLab stacks the canvas and sidebar vertically on small screens
- Stat cards, lab grids, and filter bars adapt to `xs`/`sm`/`md` breakpoints

---

## Testing

### Unit / integration tests (Jest)

```bash
make test
```

Runs inside Docker against a test PostgreSQL database with Redis. Includes 32+ grading unit tests covering normalization, fuzzy matching, hint penalties, partial credit, and percentage calculations.

### E2E tests (Playwright)

```bash
make test-e2e
```

Four spec files cover the core user flows:
- **Instructor creates a lab** &mdash; full Lab Builder wizard through publish
- **Student completes a lab** &mdash; dissection, answers, hints, submission, scoring
- **Student reviews results** &mdash; score card, structure breakdown table, navigation
- **Grade passback** &mdash; Canvas sync, retry on failure, sync log verification

E2E tests use a custom fixture system that injects auth state via `window.__E2E_INJECT_USER__` and `window.__E2E_ACCESS_TOKEN__`, bypassing the normal login flow.

---

## Production Deployment

### 1. Generate production environment

```bash
bash scripts/setup-prod-env.sh
```

Interactive script that prompts for Canvas URL, LTI credentials, JWT secret, database URL, Redis URL, and AWS S3 credentials. Writes a `.env.prod` file with `600` permissions. See `.env.example` for the complete variable reference.

### 2. Generate SSL certificate

```bash
certbot certonly --standalone -d anatoview.youruni.edu
```

The production nginx config at `infrastructure/nginx/nginx.prod.conf` expects Let's Encrypt certificates at `/etc/letsencrypt/live/`.

### 3. Build and start production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  --env-file .env.prod up -d
```

Production differences from development:
- **Web** serves a static Vite build via nginx (no Vite dev server)
- **API** runs compiled JavaScript (`node dist/index.js`) as a non-root user
- **Worker** runs compiled JavaScript (`node dist/worker/index.js`)
- **LocalStack** is disabled &mdash; real AWS S3 is used
- **Adminer** is disabled
- **nginx** redirects HTTP to HTTPS, adds security headers, proxies WebSocket, and rate-limits API/LTI endpoints

### 4. Run migrations in production

```bash
docker compose exec api npx prisma migrate deploy
docker compose exec -e NODE_ENV=production api npm run db:seed
```

### CI/CD

AnatoView uses two GitHub Actions workflows:

**CI (`.github/workflows/ci.yml`)** &mdash; runs on every push to `main` and every PR:

1. **Typecheck** &mdash; `tsc --noEmit` for both API and web (generates Prisma client first)
2. **Unit tests** &mdash; Jest against PostgreSQL + Redis GitHub Actions services, uploads coverage artifact
3. **Build** &mdash; Multi-stage Docker images tagged with git SHA (pushes on `main` only)
4. **E2E tests** &mdash; Full Docker stack with Playwright, uploads report artifact (PRs only)

**Deploy (`.github/workflows/deploy.yml`)** &mdash; triggered on GitHub Release or manual dispatch:

1. Builds and pushes production Docker images to GitHub Container Registry
2. SSHs to the production server and runs a rolling restart
3. Executes `prisma migrate deploy` and health-check verification

Required GitHub environment secrets for deploy: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_DIR`.

### Deployment options

| Option | Notes |
|--------|-------|
| VPS (DigitalOcean, Linode) | Simplest &mdash; `docker compose up` on a $12/mo droplet |
| AWS ECS | Managed containers with RDS + ElastiCache |
| Railway / Render | Managed Docker, easiest for small teams |
| University server | Many institutions have Linux servers that support Docker |

---

## Role-Based Access

| Capability | Instructor | TA | Student | Admin |
|------------|:----------:|:--:|:-------:|:-----:|
| Create / edit labs | Yes | | | Yes |
| View all attempts | Yes | Yes | Own only | Yes |
| Override grades | Yes | | | Yes |
| Sync grades to Canvas | Yes | | | Yes |
| View analytics | Yes | Yes | | Yes |
| Manage specimens | Yes | | | Yes |
| Admin panel | | | | Yes |

---

## Environment Variables

| Variable | Dev Default | Required in Prod | Description |
|----------|------------|:----------------:|-------------|
| `NODE_ENV` | `development` | **Yes** | Runtime environment (`production`) |
| `PORT` | `3001` | | API server port |
| `JWT_SECRET` | `dev_jwt_secret...` | **Yes** | JWT signing key (min 32 chars) |
| `DATABASE_URL` | Docker default | **Yes** | PostgreSQL connection string |
| `REDIS_URL` | Docker default | **Yes** | Redis connection string |
| `CANVAS_BASE_URL` | &mdash; | **Yes** | Canvas instance URL |
| `LTI_CLIENT_ID` | &mdash; | **Yes** | Canvas Developer Key client ID |
| `LTI_KEY_ID` | `anatoview-dev-key` | | RSA key identifier |
| `FRONTEND_URL` | `http://localhost` | **Yes** | Public frontend URL (for LTI redirects and CORS) |
| `S3_ENDPOINT` | `http://localstack:4566` | | S3 endpoint (blank for AWS) |
| `S3_BUCKET` | `anatoview-assets` | | S3 bucket name |
| `AWS_ACCESS_KEY_ID` | `test` | **Yes** | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | `test` | **Yes** | AWS credentials |
| `AWS_REGION` | `us-east-1` | | AWS region for S3 |

See `.env.example` for the complete template including optional LTI platform endpoints, SMTP, and monitoring variables.

---

## Additional Documentation

- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) &mdash; Comprehensive user guide for students and instructors
- [`docs/QUICKSTART.md`](docs/QUICKSTART.md) &mdash; Detailed developer setup with troubleshooting
- [`FRAMEWORK.md`](FRAMEWORK.md) &mdash; Complete architecture reference and build prompts
- [`scripts/canvas-registration.md`](scripts/canvas-registration.md) &mdash; Canvas LTI admin setup guide
- [`.env.example`](.env.example) &mdash; Environment variable template with descriptions

---

## License

Private &mdash; All rights reserved.
