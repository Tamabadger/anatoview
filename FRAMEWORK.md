# AnatoView — Full-Stack Development Framework v2.0
### Pre-Vet Anatomy Lab Platform with Canvas LMS Integration
**Stack:** React · TypeScript · PostgreSQL · Material UI · Node.js/Express · Canvas LTI 1.3 · Docker

---

## ⚡ How to Use This Framework with Claude Code

### What is Claude Code?
Claude Code is Anthropic's agentic command-line tool that runs directly in your terminal. You give it instructions in plain English, and it reads, writes, and executes code across your entire project — no copy/pasting required. It's the fastest way to turn this framework into a working application.

### Installation

```bash
# Requires Node.js 18+
npm install -g @anthropic/claude-code

# Verify installation
claude --version

# Start Claude Code in your project folder
cd anatoview
claude
```

### The Golden Workflow

The most effective way to use Claude Code with this framework is **one section at a time**, in order. Each of the 11 prompts at the end of this document maps to a buildable piece of the system. Follow this pattern:

```
1. Open your terminal in the anatoview/ project root
2. Run: claude
3. Paste a prompt from Section 17 of this document
4. Let Claude Code build the files — watch it work in your terminal
5. Run: docker compose up to verify the new piece works
6. Move to the next prompt
```

### Tips for Best Results with Claude Code

**Give Claude Code this file as context first.** At the start of every session, run:
```bash
claude "Read FRAMEWORK.md and use it as the source of truth for all architecture decisions in this project."
```
Save this framework as `FRAMEWORK.md` in your project root so Claude Code can always reference it.

**Be specific about what you want next.** Claude Code works best with clear, scoped instructions. Instead of "build the app," say "build Prompt 3 from FRAMEWORK.md — the Express API routes."

**Use `/add` to give Claude Code files as context.** If you're troubleshooting a bug:
```bash
# Inside the claude session:
/add apps/api/src/routes/labs.ts
"This route is returning 403 even for instructors. Fix the role guard."
```

**Let Claude Code run Docker commands.** Claude Code can execute shell commands. It will automatically run `docker compose up`, `npm install`, and `prisma migrate` for you if you ask it to.

**Check in with Git between prompts.** After each prompt builds successfully:
```bash
git add -A && git commit -m "feat: complete Prompt 3 - Express API routes"
```
This gives you a clean rollback point if something goes wrong in the next step.

### Recommended Session Start Script

Create `FRAMEWORK.md` in your project root (copy this file there), then start every Claude Code session with:

```
Read FRAMEWORK.md completely. This is the AnatoView project — a pre-vet anatomy lab platform.
We are using: React + TypeScript + Material UI (frontend), Node.js/Express + TypeScript (backend),
PostgreSQL (database), Redis (sessions), and Docker Compose for ALL local development.
Never install packages globally or run services locally — everything runs in Docker containers.
The current task is: [paste the specific prompt you want to build]
```

### Troubleshooting Claude Code

| Problem | Solution |
|---------|----------|
| Claude Code modifies wrong files | Use `/add` to give it the exact file to edit |
| Build fails after prompt | Ask: "The build failed. Run `docker compose logs api` and fix the error." |
| Claude Code loses context | Start a new session with the framework context script above |
| Need to redo a section | `git checkout` to the last commit, then re-run the prompt |

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Docker Architecture](#3-docker-architecture)
4. [Repository & Monorepo Setup](#4-repository--monorepo-setup)
5. [Database Schema Design](#5-database-schema-design)
6. [Backend API (Node/Express)](#6-backend-api-nodeexpress)
7. [Canvas LTI & API Integration](#7-canvas-lti--api-integration)
8. [Frontend Architecture (React + MUI)](#8-frontend-architecture-react--mui)
9. [Dissection Engine](#9-dissection-engine)
10. [Grading System](#10-grading-system)
11. [Authentication & Roles](#11-authentication--roles)
12. [File & Asset Management](#12-file--asset-management)
13. [Testing Strategy](#13-testing-strategy)
14. [Deployment & DevOps](#14-deployment--devops)
15. [Phase-by-Phase Build Plan](#15-phase-by-phase-build-plan)
16. [Folder Structure Reference](#16-folder-structure-reference)
17. [Key Libraries & Dependencies](#17-key-libraries--dependencies)
18. [Claude Code Prompts (Step-by-Step)](#18-claude-code-prompts-step-by-step)

---

## 1. Project Overview

**AnatoView** is a web-based anatomy laboratory platform designed for pre-veterinary small animal anatomy courses. It enables:

- **Virtual dissections** of small animals (cat, rat, frog, fetal pig, rabbit, etc.) using interactive SVG/WebGL anatomical models
- **Instructor tools** to create lab assignments, annotate models, and set grading rubrics
- **Student tools** to complete guided dissections, identify structures, answer questions, and submit work
- **Canvas LMS integration** via LTI 1.3 (Deep Linking + Assignments) and Canvas Grade Passback (AGS) so grades flow automatically into the instructor's gradebook
- **Real-time feedback** during dissections with hint systems and structure identification scoring

**Every service — database, API, frontend, Redis — runs in Docker.** There are no local dependencies to install beyond Docker Desktop and Node.js (for Claude Code itself).

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     CANVAS LMS                           │
│   LTI 1.3 Launch ──► AnatoView  ◄── Grade Passback     │
└────────────────┬────────────────────────────────────────┘
                 │ HTTPS / JWT
┌────────────────▼────────────────────────────────────────┐
│         Docker Network: anatoview_network                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  nginx (port 80/443)  ← Reverse Proxy            │   │
│  │  /         → web:3000 (React Vite)               │   │
│  │  /api/*    → api:3001 (Express)                  │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │ web:3000   │  │  api:3001    │  │  worker:3002  │   │
│  │ React/Vite │  │  Express/TS  │  │  Grade Sync   │   │
│  └────────────┘  └──────┬───────┘  └───────┬───────┘   │
│                         │                   │            │
│  ┌──────────────┐  ┌────▼────────┐  ┌──────▼───────┐   │
│  │  localstack  │  │  postgres   │  │    redis     │   │
│  │  (S3 mock)   │  │  :5432      │  │    :6379     │   │
│  └──────────────┘  └─────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions
- **Docker Compose** for all development environments — no "works on my machine" issues
- **LTI 1.3** — The standard for Canvas integration; handles SSO, assignment creation, and grade passback
- **SVG-based dissection models** (Phase 1) with a migration path to **Three.js 3D** (Phase 2)
- **PostgreSQL JSONB** for flexible lab configuration and rubric storage
- **LocalStack** replaces AWS S3 in development so you never need real AWS credentials locally
- **nginx** as reverse proxy in both dev and prod — no CORS issues, single origin

---

## 3. Docker Architecture

This is the heart of the development setup. Every developer (and Claude Code) uses the exact same environment.

### Container Inventory

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `nginx` | nginx:alpine | 80 → 443 | Reverse proxy, SSL termination |
| `web` | node:20-alpine (dev) | 3000 | React Vite dev server with HMR |
| `api` | node:20-alpine (dev) | 3001 | Express API with ts-node-dev |
| `worker` | node:20-alpine (dev) | 3002 | Background grade sync worker |
| `postgres` | postgres:15-alpine | 5432 | Primary database |
| `redis` | redis:7-alpine | 6379 | Sessions, caching, job queue |
| `localstack` | localstack/localstack | 4566 | S3-compatible local storage |
| `adminer` | adminer | 8080 | Database GUI (dev only) |

### `docker-compose.yml` (Development — Full File)

```yaml
version: '3.9'

name: anatoview

networks:
  anatoview_network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  localstack_data:
  node_modules_api:
  node_modules_web:

services:
  # ─── REVERSE PROXY ───────────────────────────────────────────
  nginx:
    image: nginx:alpine
    container_name: anatoview_nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infrastructure/nginx/nginx.dev.conf:/etc/nginx/nginx.conf:ro
      - ./infrastructure/nginx/certs:/etc/nginx/certs:ro
    depends_on:
      - web
      - api
    networks:
      - anatoview_network
    restart: unless-stopped

  # ─── FRONTEND ────────────────────────────────────────────────
  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile.dev
    container_name: anatoview_web
    volumes:
      - ./apps/web:/app
      - node_modules_web:/app/node_modules
    environment:
      - NODE_ENV=development
      - VITE_API_URL=http://localhost/api
      - VITE_WS_URL=ws://localhost/api
    networks:
      - anatoview_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── BACKEND API ─────────────────────────────────────────────
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.dev
    container_name: anatoview_api
    volumes:
      - ./apps/api:/app
      - node_modules_api:/app/node_modules
      - ./packages:/packages
    environment:
      - NODE_ENV=development
      - PORT=3001
      - DATABASE_URL=postgresql://anatoview:secret@postgres:5432/anatoview
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=dev_jwt_secret_change_in_production
      - LTI_KEY_ID=anatoview-dev-key
      - LTI_CLIENT_ID=${LTI_CLIENT_ID:-your_canvas_client_id}
      - CANVAS_BASE_URL=${CANVAS_BASE_URL:-https://canvas.instructure.com}
      - S3_ENDPOINT=http://localstack:4566
      - S3_BUCKET=anatoview-assets
      - AWS_ACCESS_KEY_ID=test
      - AWS_SECRET_ACCESS_KEY=test
      - AWS_REGION=us-east-1
      - FRONTEND_URL=http://localhost
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      localstack:
        condition: service_healthy
    networks:
      - anatoview_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── BACKGROUND WORKER ───────────────────────────────────────
  worker:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.dev
    container_name: anatoview_worker
    command: npx ts-node-dev --respawn src/worker/index.ts
    volumes:
      - ./apps/api:/app
      - node_modules_api:/app/node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://anatoview:secret@postgres:5432/anatoview
      - REDIS_URL=redis://redis:6379
      - CANVAS_BASE_URL=${CANVAS_BASE_URL:-https://canvas.instructure.com}
    depends_on:
      - api
    networks:
      - anatoview_network
    restart: unless-stopped

  # ─── DATABASE ────────────────────────────────────────────────
  postgres:
    image: postgres:15-alpine
    container_name: anatoview_postgres
    environment:
      POSTGRES_DB: anatoview
      POSTGRES_USER: anatoview
      POSTGRES_PASSWORD: secret
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infrastructure/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"         # exposed for local DB clients (TablePlus, DBeaver)
    networks:
      - anatoview_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U anatoview -d anatoview"]
      interval: 5s
      timeout: 5s
      retries: 10

  # ─── CACHE / SESSIONS ────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: anatoview_redis
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - anatoview_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  # ─── LOCAL S3 (replaces AWS in dev) ──────────────────────────
  localstack:
    image: localstack/localstack:latest
    container_name: anatoview_localstack
    environment:
      - SERVICES=s3
      - DEFAULT_REGION=us-east-1
      - AWS_DEFAULT_REGION=us-east-1
    volumes:
      - localstack_data:/var/lib/localstack
      - ./infrastructure/localstack/init-s3.sh:/etc/localstack/init/ready.d/init-s3.sh:ro
    ports:
      - "4566:4566"
    networks:
      - anatoview_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4566/_localstack/health"]
      interval: 10s
      timeout: 5s
      retries: 10

  # ─── DATABASE GUI (dev only) ──────────────────────────────────
  adminer:
    image: adminer
    container_name: anatoview_adminer
    ports:
      - "8080:8080"
    networks:
      - anatoview_network
    restart: unless-stopped
    profiles:
      - tools      # Only starts with: docker compose --profile tools up
```

### `docker-compose.prod.yml` (Production Overrides)

```yaml
version: '3.9'

# Usage: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

services:
  nginx:
    volumes:
      - ./infrastructure/nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro  # Certbot SSL certs
    ports:
      - "80:80"
      - "443:443"

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile.prod
    volumes: []    # no volume mounts in prod — baked into image
    environment:
      - NODE_ENV=production
      - VITE_API_URL=/api

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.prod
    volumes: []
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - LTI_KEY_ID=${LTI_KEY_ID}
      - LTI_CLIENT_ID=${LTI_CLIENT_ID}
      - CANVAS_BASE_URL=${CANVAS_BASE_URL}
      - S3_ENDPOINT=${S3_ENDPOINT}       # real AWS endpoint in prod
      - S3_BUCKET=${S3_BUCKET}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}

  worker:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.prod
    command: node dist/worker/index.js
    volumes: []

  localstack:
    profiles:
      - dev-only   # excluded from prod entirely

  adminer:
    profiles:
      - dev-only
```

### `docker-compose.test.yml` (Testing Environment)

```yaml
version: '3.9'

# Usage: docker compose -f docker-compose.yml -f docker-compose.test.yml up -d

services:
  postgres:
    environment:
      POSTGRES_DB: anatoview_test   # separate test database

  api:
    environment:
      - NODE_ENV=test
      - DATABASE_URL=postgresql://anatoview:secret@postgres:5432/anatoview_test
    command: npx ts-node-dev --respawn src/index.ts

  web:
    environment:
      - NODE_ENV=test
```

### Dockerfiles

#### `apps/api/Dockerfile.dev`

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm ci

# Copy source (overridden by volume mount in dev)
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3001

# Hot reload via ts-node-dev
CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "src/index.ts"]
```

#### `apps/api/Dockerfile.prod`

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
RUN npm run build        # tsc → dist/

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

RUN addgroup -S anatoview && adduser -S anatoview -G anatoview
USER anatoview

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
```

#### `apps/web/Dockerfile.dev`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

# Vite dev server — binds to 0.0.0.0 so Docker can reach it
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "3000"]
```

#### `apps/web/Dockerfile.prod`

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build        # vite build → dist/

FROM nginx:alpine AS runner

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing — serve index.html for all routes
COPY infrastructure/nginx/spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:80 || exit 1
```

### Nginx Configuration

#### `infrastructure/nginx/nginx.dev.conf`

```nginx
events { worker_connections 1024; }

http {
  upstream api {
    server api:3001;
  }

  upstream web {
    server web:3000;
  }

  server {
    listen 80;
    server_name localhost;

    # React frontend (with Vite HMR WebSocket support)
    location / {
      proxy_pass http://web;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
    }

    # API routes
    location /api/ {
      proxy_pass http://api/;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    # LTI launch (Canvas posts here, needs no /api prefix)
    location /lti/ {
      proxy_pass http://api/lti/;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
}
```

#### `infrastructure/nginx/nginx.prod.conf`

```nginx
events { worker_connections 2048; }

http {
  # Rate limiting
  limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
  limit_req_zone $binary_remote_addr zone=lti:10m rate=60r/m;

  upstream api   { server api:3001; keepalive 32; }
  upstream web   { server web:80; }

  # Redirect HTTP → HTTPS
  server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl http2;
    server_name anatoview.youruni.edu;

    ssl_certificate     /etc/letsencrypt/live/anatoview.youruni.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/anatoview.youruni.edu/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header Strict-Transport-Security "max-age=31536000" always;

    # React SPA
    location / {
      proxy_pass http://web;
      proxy_set_header Host $host;
    }

    # API (rate limited)
    location /api/ {
      limit_req zone=api burst=20 nodelay;
      proxy_pass http://api/;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-Proto https;
    }

    # LTI (Canvas posts here — needs generous rate limit)
    location /lti/ {
      limit_req zone=lti burst=100 nodelay;
      proxy_pass http://api/lti/;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-Proto https;
    }
  }
}
```

### LocalStack S3 Init Script

#### `infrastructure/localstack/init-s3.sh`

```bash
#!/bin/bash
# Runs automatically when LocalStack starts
echo "Initializing LocalStack S3 buckets..."

awslocal s3 mb s3://anatoview-assets
awslocal s3 mb s3://anatoview-models

# Set public read for model assets
awslocal s3api put-bucket-policy \
  --bucket anatoview-assets \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::anatoview-assets/*"
    }]
  }'

echo "LocalStack S3 ready: http://localstack:4566/anatoview-assets"
```

### PostgreSQL Init Script

#### `infrastructure/postgres/init.sql`

```sql
-- Runs once on first container start
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create test database alongside main
CREATE DATABASE anatoview_test
  WITH TEMPLATE anatoview
  OWNER anatoview;
```

### Environment Files

#### `.env` (gitignored — copy from `.env.example`)

```env
# Canvas/LTI — get these from your Canvas admin
LTI_CLIENT_ID=your_canvas_lti_client_id
CANVAS_BASE_URL=https://your-university.instructure.com

# Secrets — generate with: openssl rand -hex 32
JWT_SECRET=generate_a_long_random_string_here
LTI_PRIVATE_KEY_PATH=./infrastructure/keys/private.pem
```

#### `.env.example` (committed to Git)

```env
LTI_CLIENT_ID=
CANVAS_BASE_URL=https://canvas.instructure.com
JWT_SECRET=
LTI_PRIVATE_KEY_PATH=./infrastructure/keys/private.pem
```

### `.dockerignore`

```
node_modules
dist
.git
*.log
.env
coverage
.nyc_output
```

### Common Docker Commands

```bash
# First-time setup
docker compose up -d                          # Start all services
docker compose exec api npx prisma migrate dev # Run migrations
docker compose exec api npm run db:seed        # Seed animals + structures

# Daily development
docker compose up -d                           # Start everything
docker compose logs -f api                     # Watch API logs
docker compose logs -f web                     # Watch frontend logs
docker compose exec api bash                   # Shell into API container
docker compose exec postgres psql -U anatoview # Postgres CLI

# Database
docker compose exec api npx prisma studio      # Visual DB browser (port 5555)
docker compose exec api npx prisma migrate dev --name "add_feature"
docker compose exec api npx prisma migrate reset # Reset + reseed (dev only!)

# Testing
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d
docker compose exec api npm test
docker compose exec api npm run test:e2e

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Cleanup
docker compose down                            # Stop containers
docker compose down -v                         # Stop + delete volumes (DESTROYS DATA)
docker system prune -af                        # Nuclear cleanup
```

---

## 4. Repository & Monorepo Setup

### Initialize Monorepo

```bash
mkdir anatoview && cd anatoview
git init
npm init -y
```

### Root `package.json`

```json
{
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "docker compose up",
    "dev:build": "docker compose up --build",
    "stop": "docker compose down",
    "logs": "docker compose logs -f",
    "db:migrate": "docker compose exec api npx prisma migrate dev",
    "db:seed": "docker compose exec api npm run db:seed",
    "db:reset": "docker compose exec api npx prisma migrate reset",
    "db:studio": "docker compose exec api npx prisma studio",
    "test": "docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm api npm test",
    "shell:api": "docker compose exec api bash",
    "shell:db": "docker compose exec postgres psql -U anatoview"
  }
}
```

### Full Workspace Structure

```
anatoview/
├── apps/
│   ├── api/                   # Express backend
│   │   ├── src/
│   │   ├── prisma/
│   │   ├── Dockerfile.dev
│   │   ├── Dockerfile.prod
│   │   └── package.json
│   └── web/                   # React frontend
│       ├── src/
│       ├── Dockerfile.dev
│       ├── Dockerfile.prod
│       └── package.json
├── packages/
│   ├── shared/                # Shared Zod schemas + TypeScript types
│   └── lti/                   # LTI 1.3 utilities
├── infrastructure/
│   ├── nginx/
│   │   ├── nginx.dev.conf
│   │   ├── nginx.prod.conf
│   │   ├── spa.conf
│   │   └── certs/             # Self-signed certs for local HTTPS
│   ├── postgres/
│   │   └── init.sql
│   ├── localstack/
│   │   └── init-s3.sh
│   └── keys/
│       ├── private.pem        # LTI RSA key (gitignored)
│       └── public.pem
├── scripts/
│   ├── generate-lti-keys.sh
│   ├── canvas-registration.md
│   └── setup-prod-env.sh
├── tests/
│   └── e2e/
├── docker-compose.yml
├── docker-compose.prod.yml
├── docker-compose.test.yml
├── .env
├── .env.example
├── .dockerignore
├── .gitignore
├── FRAMEWORK.md               ← Copy this file here for Claude Code context
└── package.json
```

### Generate LTI RSA Keys

```bash
# Run once to generate your LTI signing keys
mkdir -p infrastructure/keys
openssl genrsa -out infrastructure/keys/private.pem 4096
openssl rsa -in infrastructure/keys/private.pem -pubout -out infrastructure/keys/public.pem
echo "infrastructure/keys/private.pem" >> .gitignore
```

### Generate Self-Signed Certs (Local HTTPS for Canvas)

Canvas LTI 1.3 requires HTTPS even in development. Use mkcert:

```bash
brew install mkcert      # macOS
mkcert -install
mkdir -p infrastructure/nginx/certs
mkcert -cert-file infrastructure/nginx/certs/cert.pem \
       -key-file infrastructure/nginx/certs/key.pem \
       localhost 127.0.0.1
```

---

## 5. Database Schema Design

### Prisma Schema (`apps/api/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Institution {
  id               String   @id @default(uuid())
  name             String
  canvasUrl        String   @unique @map("canvas_url")
  ltiClientId      String   @map("lti_client_id")
  ltiDeploymentId  String?  @map("lti_deployment_id")
  createdAt        DateTime @default(now()) @map("created_at")

  users   User[]
  courses Course[]
  @@map("institutions")
}

model User {
  id            String   @id @default(uuid())
  institutionId String   @map("institution_id")
  canvasUserId  String   @map("canvas_user_id")
  email         String?
  name          String
  role          UserRole
  createdAt     DateTime @default(now()) @map("created_at")

  institution Institution  @relation(fields: [institutionId], references: [id])
  courses     Course[]
  attempts    LabAttempt[]

  @@unique([institutionId, canvasUserId])
  @@map("users")
}

enum UserRole {
  instructor
  student
  ta
  admin
}

model Course {
  id             String   @id @default(uuid())
  institutionId  String   @map("institution_id")
  canvasCourseId String   @map("canvas_course_id")
  name           String
  term           String?
  instructorId   String?  @map("instructor_id")
  createdAt      DateTime @default(now()) @map("created_at")

  institution Institution @relation(fields: [institutionId], references: [id])
  instructor  User?       @relation(fields: [instructorId], references: [id])
  labs        Lab[]

  @@unique([institutionId, canvasCourseId])
  @@map("courses")
}

model Animal {
  id             String    @id @default(uuid())
  commonName     String    @map("common_name")
  scientificName String?   @map("scientific_name")
  category       String
  description    String?
  thumbnailUrl   String?   @map("thumbnail_url")
  modelType      ModelType @map("model_type")
  isActive       Boolean   @default(true) @map("is_active")
  createdAt      DateTime  @default(now()) @map("created_at")

  models DissectionModel[]
  labs   Lab[]
  @@map("animals")
}

enum ModelType {
  svg
  three_js
  photographic
}

model DissectionModel {
  id           String   @id @default(uuid())
  animalId     String   @map("animal_id")
  version      String
  organSystem  String   @map("organ_system")
  modelFileUrl String   @map("model_file_url")
  thumbnailUrl String?  @map("thumbnail_url")
  layerOrder   Int      @default(0) @map("layer_order")
  isPublished  Boolean  @default(false) @map("is_published")
  createdAt    DateTime @default(now()) @map("created_at")

  animal     Animal                @relation(fields: [animalId], references: [id])
  structures AnatomicalStructure[]
  @@map("dissection_models")
}

model AnatomicalStructure {
  id              String   @id @default(uuid())
  modelId         String   @map("model_id")
  name            String
  latinName       String?  @map("latin_name")
  svgElementId    String?  @map("svg_element_id")
  description     String?
  funFact         String?  @map("fun_fact")
  hint            String?
  difficultyLevel String   @default("medium") @map("difficulty_level")
  coordinates     Json?
  tags            String[]

  model           DissectionModel    @relation(fields: [modelId], references: [id], onDelete: Cascade)
  labStructures   LabStructure[]
  responses       StructureResponse[]
  events          DissectionEvent[]
  @@map("anatomical_structures")
}

model Lab {
  id                 String    @id @default(uuid())
  courseId           String    @map("course_id")
  canvasAssignmentId String?   @map("canvas_assignment_id")
  title              String
  instructions       String?
  animalId           String    @map("animal_id")
  organSystems       String[]  @map("organ_systems")
  labType            LabType   @map("lab_type")
  settings           Json      @default("{}")
  rubric             Json      @default("{}")
  dueDate            DateTime? @map("due_date")
  isPublished        Boolean   @default(false) @map("is_published")
  maxPoints          Decimal   @default(100) @map("max_points")
  createdBy          String    @map("created_by")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  course     Course         @relation(fields: [courseId], references: [id])
  animal     Animal         @relation(fields: [animalId], references: [id])
  structures LabStructure[]
  attempts   LabAttempt[]
  @@map("labs")
}

enum LabType {
  identification
  dissection
  quiz
  practical
}

model LabStructure {
  id              String  @id @default(uuid())
  labId           String  @map("lab_id")
  structureId     String  @map("structure_id")
  pointsPossible  Decimal @default(1) @map("points_possible")
  isRequired      Boolean @default(true) @map("is_required")
  orderIndex      Int?    @map("order_index")

  lab       Lab                 @relation(fields: [labId], references: [id], onDelete: Cascade)
  structure AnatomicalStructure @relation(fields: [structureId], references: [id])
  @@map("lab_structures")
}

model LabAttempt {
  id                String        @id @default(uuid())
  labId             String        @map("lab_id")
  studentId         String        @map("student_id")
  attemptNumber     Int           @default(1) @map("attempt_number")
  status            AttemptStatus @default(not_started)
  startedAt         DateTime?     @map("started_at")
  submittedAt       DateTime?     @map("submitted_at")
  gradedAt          DateTime?     @map("graded_at")
  timeSpentSeconds  Int?          @map("time_spent_seconds")
  score             Decimal?
  percentage        Decimal?
  instructorFeedback String?      @map("instructor_feedback")
  canvasSubmissionId String?      @map("canvas_submission_id")
  ltiOutcomeUrl     String?       @map("lti_outcome_url")
  createdAt         DateTime      @default(now()) @map("created_at")

  lab       Lab                 @relation(fields: [labId], references: [id])
  student   User                @relation(fields: [studentId], references: [id])
  responses StructureResponse[]
  events    DissectionEvent[]
  syncLogs  GradeSyncLog[]
  @@map("lab_attempts")
}

enum AttemptStatus {
  not_started
  in_progress
  submitted
  graded
}

model StructureResponse {
  id                 String   @id @default(uuid())
  attemptId          String   @map("attempt_id")
  structureId        String   @map("structure_id")
  studentAnswer      String?  @map("student_answer")
  isCorrect          Boolean? @map("is_correct")
  confidenceLevel    Int?     @map("confidence_level")
  hintsUsed          Int      @default(0) @map("hints_used")
  timeSpentSeconds   Int?     @map("time_spent_seconds")
  pointsEarned       Decimal  @default(0) @map("points_earned")
  autoGraded         Boolean  @default(true) @map("auto_graded")
  instructorOverride Decimal? @map("instructor_override")
  createdAt          DateTime @default(now()) @map("created_at")

  attempt   LabAttempt          @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  structure AnatomicalStructure @relation(fields: [structureId], references: [id])
  @@map("structure_responses")
}

model DissectionEvent {
  id          String   @id @default(uuid())
  attemptId   String   @map("attempt_id")
  eventType   String   @map("event_type")
  structureId String?  @map("structure_id")
  payload     Json?
  createdAt   DateTime @default(now()) @map("created_at")

  attempt   LabAttempt           @relation(fields: [attemptId], references: [id])
  structure AnatomicalStructure? @relation(fields: [structureId], references: [id])
  @@map("dissection_events")
}

model GradeSyncLog {
  id             String   @id @default(uuid())
  attemptId      String   @map("attempt_id")
  canvasStatus   String?  @map("canvas_status")
  canvasResponse Json?    @map("canvas_response")
  syncedAt       DateTime @default(now()) @map("synced_at")

  attempt LabAttempt @relation(fields: [attemptId], references: [id])
  @@map("grade_sync_log")
}
```

---

## 6. Backend API (Node/Express)

### `apps/api/package.json`

```json
{
  "name": "@anatoview/api",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:migrate": "prisma migrate dev",
    "db:seed": "ts-node prisma/seed.ts",
    "test": "jest --runInBand",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "express": "^4.18.0",
    "ltijs": "^5.9.0",
    "jsonwebtoken": "^9.0.0",
    "ioredis": "^5.3.0",
    "zod": "^3.22.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "morgan": "^1.10.0",
    "multer": "^1.4.5",
    "@aws-sdk/client-s3": "^3.400.0",
    "bull": "^4.11.0",
    "socket.io": "^4.6.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "typescript": "^5.2.0",
    "ts-node-dev": "^2.0.0",
    "jest": "^29.0.0",
    "supertest": "^6.3.0",
    "@playwright/test": "^1.38.0",
    "@types/express": "^4.17.0",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0"
  }
}
```

### API Route Map

```
GET    /health                              Docker health check

AUTH
  GET    /api/auth/me                       Current user
  POST   /api/auth/logout

INSTITUTIONS
  POST   /api/institutions                  Register institution
  GET    /api/institutions/:id

ANIMALS
  GET    /api/animals                       List animals (with filtering)
  GET    /api/animals/:id                   Animal + models
  GET    /api/animals/:id/structures        All structures for animal

LABS
  GET    /api/labs?courseId=                List labs for course
  POST   /api/labs                          Create lab
  GET    /api/labs/:id                      Lab detail + rubric
  PUT    /api/labs/:id                      Update lab
  DELETE /api/labs/:id                      Delete lab
  POST   /api/labs/:id/publish              Publish → Canvas Deep Link
  GET    /api/labs/:id/results              Class results (instructor)
  GET    /api/labs/:id/grades               All grades for lab

ATTEMPTS
  GET    /api/labs/:id/attempt              Get/create attempt
  POST   /api/labs/:id/attempt/start        Start timer
  POST   /api/labs/:id/attempt/submit       Submit + auto-grade + sync
  GET    /api/attempts/:id                  Full attempt detail
  PUT    /api/attempts/:id/grade            Instructor override

STRUCTURE RESPONSES
  POST   /api/attempts/:id/responses        Bulk upsert responses
  GET    /api/attempts/:id/responses        All responses

EVENTS
  POST   /api/attempts/:id/events           Log interaction batch

GRADES
  POST   /api/labs/:id/grades/sync          Sync all to Canvas
  POST   /api/grades/:attemptId/sync        Sync one to Canvas

LTI
  POST   /lti/login                         OIDC login init
  POST   /lti/launch                        LTI 1.3 launch
  GET    /lti/jwks                          Public key endpoint
  POST   /lti/deep-link                     Deep Linking handler
```

### `apps/api/src/index.ts`

```typescript
import { app } from './app';
import { initializeLTI } from './config/lti';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  await connectDatabase();
  await connectRedis();
  await initializeLTI(app);

  app.listen(PORT, () => {
    console.log(`AnatoView API running on port ${PORT}`);
  });
}

bootstrap().catch(console.error);
```

### Health Check Endpoint (Required for Docker)

```typescript
// Always include this — Docker health checks depend on it
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'anatoview-api',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
  });
});
```

### Grading Service

```typescript
// apps/api/src/services/gradingService.ts
export async function gradeAttempt(attemptId: string): Promise<GradeResult> {
  // 1. Load attempt + all structure responses + lab rubric
  // 2. For each structure response:
  //    a. Normalize answer (lowercase, trim, punctuation removed)
  //    b. Check exact match → accepted_aliases in rubric
  //    c. Fuzzy match via Levenshtein distance ≤ 2
  //    d. Deduct hint penalty (hints_used × hint_penalty_percent / 100)
  //    e. Calculate points_earned with optional partial credit
  // 3. Sum points, weight by category if rubric specifies
  // 4. Write results to lab_attempts + structure_responses
  // 5. Enqueue Canvas grade passback job (Bull queue → worker)
}
```

---

## 7. Canvas LTI & API Integration

### LTI 1.3 Configuration

```typescript
// apps/api/src/config/lti.ts
import { Provider } from 'ltijs';
import path from 'path';

export async function initializeLTI(app: Express) {
  Provider.setup(
    process.env.LTI_KEY_ID!,
    { url: process.env.DATABASE_URL! },
    {
      cookies: { secure: process.env.NODE_ENV === 'production' },
      devMode: process.env.NODE_ENV !== 'production',
      ltiaas: false,
    }
  );

  await Provider.registerPlatform({
    url: process.env.CANVAS_BASE_URL!,
    name: 'University Canvas',
    clientId: process.env.LTI_CLIENT_ID!,
    authenticationEndpoint: `${process.env.CANVAS_BASE_URL}/api/lti/authorize_redirect`,
    accesstokenEndpoint: `${process.env.CANVAS_BASE_URL}/login/oauth2/token`,
    authConfig: {
      method: 'JWK_SET',
      key: `${process.env.CANVAS_BASE_URL}/api/lti/security/jwks`,
    },
  });

  // LTI handles its own routes at /lti/*
  await Provider.deploy({ serverless: true });
  app.use(Provider.app);
}
```

### Canvas Grade Passback (AGS)

```typescript
// apps/api/src/services/ltiService.ts
export async function sendGradeToCanvas(attemptId: string) {
  const attempt = await prisma.labAttempt.findUnique({
    where: { id: attemptId },
    include: { lab: true, student: true },
  });

  const scoreResult = await Provider.Grade.ScorePublish(token, {
    userId: attempt.student.canvasUserId,
    scoreGiven: Number(attempt.score),
    scoreMaximum: Number(attempt.lab.maxPoints),
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
    timestamp: new Date().toISOString(),
  });

  await prisma.gradeSyncLog.create({
    data: {
      attemptId,
      canvasStatus: scoreResult.status === 200 ? 'success' : 'failed',
      canvasResponse: scoreResult as any,
    },
  });
}
```

### Canvas Registration Details for Admin

```
Tool Name:         AnatoView
Target Link URI:   https://anatoview.youruni.edu/lti/launch
OIDC Login URL:    https://anatoview.youruni.edu/lti/login
Redirect URI:      https://anatoview.youruni.edu/lti/launch
JWKS URL:          https://anatoview.youruni.edu/lti/jwks
Deep Linking URL:  https://anatoview.youruni.edu/lti/deep-link
```

---

## 8. Frontend Architecture (React + MUI)

### `apps/web/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',   // Required for Docker
    port: 3000,
    // In dev, nginx handles the /api proxy — no proxy config needed here
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
```

### MUI Theme

```typescript
// apps/web/src/theme/theme.ts
export const theme = createTheme({
  palette: {
    primary: { main: '#1B4F72' },       // Deep navy
    secondary: { main: '#2ECC71' },     // Bio green
    background: { default: '#F4F6F8' },
    error: { main: '#E74C3C' },
    warning: { main: '#F39C12' },
    success: { main: '#27AE60' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
});
```

### Route Structure

```
/                     → Redirect (role-based)
/dashboard            → Instructor Dashboard
/labs/new             → Lab Builder Wizard
/labs/:id/edit        → Edit Lab
/labs/:id/results     → Class Results
/lab/:id              → Student Lab View
/lab/:id/attempt      → Active Dissection
/grade-center         → Grade Center
/animals              → Specimen Library
/unauthorized         → Error
```

### Core Component Tree

```
App
└── ThemeProvider (MUI)
    └── QueryClientProvider (TanStack)
        └── Router
            ├── AppShell (nav + sidebar)
            │   ├── /dashboard → InstructorDashboard
            │   ├── /labs/new  → LabBuilderStepper
            │   │   ├── Step 1: AnimalSelector
            │   │   ├── Step 2: SystemSelector
            │   │   ├── Step 3: StructurePicker
            │   │   ├── Step 4: RubricBuilder
            │   │   ├── Step 5: SettingsPanel
            │   │   └── Step 6: ReviewAndPublish
            │   ├── /grade-center → GradeCenter
            │   │   └── AttemptReview (Drawer)
            │   └── /animals → SpecimenLibrary
            └── LabLayout (full-screen)
                └── /lab/:id/attempt → DissectionLab
                    ├── DissectionViewer (Konva)
                    ├── LayerPanel (sidebar)
                    ├── DissectionProgress (top bar)
                    └── HintDrawer (slide-in)
```

---

## 9. Dissection Engine

The core interactive component — Phase 1 uses SVG models in a Konva canvas.

### Dissection Modes

| Mode | Description |
|------|-------------|
| `explore` | Free exploration, hover for labels, click for info cards |
| `identify` | Student types structure name, immediately scored |
| `quiz` | Structures hidden, student clicks correct location |
| `practical` | Timed exam mode, no hints allowed |

### SVG Model Requirements

Each SVG must have:
- Unique `id` on every anatomical structure (e.g., `id="left-ventricle"`)
- `data-system="cardiovascular"` on every structure group
- `data-structure-id="uuid"` linking to `anatomical_structures` table
- Logical grouping so layers can be shown/hidden via CSS class toggling

### DissectionViewer Logic

```typescript
// components/dissection/DissectionViewer.tsx
const DissectionViewer = ({ modelUrl, structures, mode, onAnswer }) => {
  // 1. Fetch SVG → parse DOM → inject into Konva
  // 2. Map structure data-structure-id → AnatomicalStructure records
  // 3. Click handlers per mode (identify/explore/quiz/practical)
  // 4. Zoom (scroll wheel) + pan (drag) via Konva Stage
  // 5. Green checkmark / red X overlays on graded answers
  // 6. Batch interaction event logging → POST /api/attempts/:id/events every 5s
  // 7. Layer visibility toggling by data-system attribute
};
```

---

## 10. Grading System

### Auto-Grading Pipeline

```
Student submits attempt
        │
        ▼
gradingService.gradeAttempt(attemptId)
        │
        ├── Normalize answers (lowercase, trim, remove punctuation)
        ├── Exact match vs. accepted_aliases in rubric
        ├── Fuzzy match (Levenshtein ≤ 2, if enabled)
        ├── Hint penalty (hints_used × penalty_rate per structure)
        ├── Partial credit (if rubric.partial_credit = true)
        ├── Category weighting
        ├── Write to DB (lab_attempts + structure_responses)
        └── Enqueue Canvas grade passback (Bull → worker container)
```

### Background Worker

The `worker` Docker container processes the Canvas grade passback queue asynchronously, so a slow Canvas API response never blocks the student's submission.

```typescript
// apps/api/src/worker/index.ts
import Bull from 'bull';

const gradeQueue = new Bull('grade-passback', process.env.REDIS_URL!);

gradeQueue.process(async (job) => {
  const { attemptId } = job.data;
  await sendGradeToCanvas(attemptId);
  // Retries automatically on failure (Bull handles this)
});
```

### Grade Center UI Features

- MUI DataGrid: all students × all labs
- Color-coded cells (red < 70%, yellow 70–85%, green > 85%)
- Click cell → AttemptReview drawer
- Per-structure grading with instructor override
- Bulk sync all grades to Canvas
- `CanvasSyncStatus` badge per lab
- CSV export

---

## 11. Authentication & Roles

### Role Capabilities

| Role | Create Labs | View All Attempts | Override Grades | Sync to Canvas | Admin |
|------|:-----------:|:-----------------:|:---------------:|:--------------:|:-----:|
| `instructor` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `ta` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `student` | ❌ | Own only | ❌ | ❌ | ❌ |
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ |

### Auth Flow

1. Canvas POSTs LTI 1.3 launch → `ltijs` validates JWT id_token
2. User and course are upserted in PostgreSQL
3. AnatoView issues short-lived JWT (1hr) + refresh token (7 days, stored in Redis)
4. Frontend stores JWT in memory only (never `localStorage`)
5. All API calls: `Authorization: Bearer <jwt>`
6. Middleware checks role for every protected route

---

## 12. File & Asset Management

### LocalStack (Development)

In development, `localstack` replaces AWS S3 completely. The API uses the same AWS SDK — just with `S3_ENDPOINT=http://localstack:4566` instead of a real AWS endpoint.

```typescript
// apps/api/src/config/storage.ts
import { S3Client } from '@aws-sdk/client-s3';

export const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,        // LocalStack in dev, real AWS in prod
  forcePathStyle: true,                     // Required for LocalStack
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
});
```

### Animal Library (Phase 1)

| Animal | Systems |
|--------|---------|
| Domestic Cat (*Felis catus*) | Cardiovascular, Digestive, Respiratory, Urogenital, Skeletal, Muscular, Nervous |
| Norway Rat (*Rattus norvegicus*) | Cardiovascular, Digestive, Respiratory, Urogenital |
| Fetal Pig (*Sus scrofa*) | Cardiovascular, Digestive, Respiratory, Urogenital |
| Leopard Frog (*Lithobates pipiens*) | Cardiovascular, Digestive, Respiratory |
| Earthworm (*Lumbricus terrestris*) | Digestive, Nervous, Circulatory |
| Grasshopper (*Melanoplus*) | Digestive, Respiratory, Reproductive |
| Crayfish (*Procambarus clarkii*) | Digestive, Circulatory, Nervous |

---

## 13. Testing Strategy

### Backend Tests (Jest + Supertest inside Docker)

```bash
# Run tests in the test compose environment
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm api npm test
```

```
apps/api/src/__tests__/
├── auth.test.ts              LTI launch, JWT generation
├── labs.test.ts              CRUD, publish to Canvas
├── grading.test.ts           Auto-grade edge cases
├── canvasSync.test.ts        Grade passback mocks
└── integration/
    └── fullAttemptFlow.test.ts
```

### Frontend Tests (Vitest)

```bash
docker compose exec web npm test
```

### E2E Tests (Playwright)

```bash
docker compose exec api npm run test:e2e
```

```
tests/e2e/
├── instructorCreatesLab.spec.ts
├── studentCompletesLab.spec.ts
└── gradePassback.spec.ts
```

---

## 14. Deployment & DevOps

### GitHub Actions CI/CD

#### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start test environment
        run: docker compose -f docker-compose.yml -f docker-compose.test.yml up -d

      - name: Wait for services
        run: sleep 15

      - name: Run migrations
        run: docker compose exec -T api npx prisma migrate deploy

      - name: Run API tests
        run: docker compose exec -T api npm test

      - name: Run E2E tests
        run: docker compose exec -T api npm run test:e2e

      - name: Tear down
        run: docker compose down -v

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Build production images
        run: |
          docker compose -f docker-compose.yml -f docker-compose.prod.yml build

      - name: Push to registry
        run: |
          echo ${{ secrets.REGISTRY_PASSWORD }} | docker login -u ${{ secrets.REGISTRY_USER }} --password-stdin
          docker tag anatoview_api:latest your-registry/anatoview-api:${{ github.sha }}
          docker tag anatoview_web:latest your-registry/anatoview-web:${{ github.sha }}
          docker push your-registry/anatoview-api:${{ github.sha }}
          docker push your-registry/anatoview-web:${{ github.sha }}
```

### Production Deployment Options

| Option | Description |
|--------|-------------|
| **VPS (DigitalOcean/Linode)** | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` — simplest, lowest cost |
| **AWS ECS** | Managed containers, auto-scaling, integrates with RDS + ElastiCache |
| **Railway / Render** | Managed Docker, easiest for small teams |
| **University server** | Many universities have Linux servers that run Docker |

### SSL Certificate (Required for Canvas LTI)

```bash
# On your production server
apt install certbot
certbot certonly --standalone -d anatoview.youruni.edu
# Certs go to /etc/letsencrypt/live/anatoview.youruni.edu/
# nginx.prod.conf references these paths
```

---

## 15. Phase-by-Phase Build Plan

### Phase 1 — Docker + Foundation (Weeks 1–3)
- [ ] Monorepo scaffolding + all Dockerfiles
- [ ] `docker-compose.yml` with all 8 services
- [ ] nginx reverse proxy (dev + prod configs)
- [ ] LocalStack S3 setup with init script
- [ ] PostgreSQL + Redis containers
- [ ] Prisma schema + migrations running in Docker
- [ ] Express API skeleton with health check
- [ ] LTI 1.3 launch handler with `ltijs`
- [ ] JWT session management
- [ ] React app scaffold with MUI theme

### Phase 2 — Specimen Library (Weeks 4–6)
- [ ] Seed scripts for 7 animals + cat cardiovascular structures
- [ ] SVG model pipeline + LocalStack upload scripts
- [ ] Animals API endpoints
- [ ] Specimen Library page
- [ ] Basic SVG viewer (Konva) with zoom/pan

### Phase 3 — Lab Builder (Weeks 7–9)
- [ ] Lab Builder multi-step wizard (6 steps)
- [ ] Lab CRUD API
- [ ] Canvas Deep Linking integration
- [ ] `CanvasSyncStatus` component

### Phase 4 — Dissection Engine (Weeks 10–13)
- [ ] `DissectionViewer` with all 4 modes
- [ ] Identify mode with `AnswerInput`
- [ ] Hint system with penalty tracking
- [ ] Dissection event logging + batched API calls
- [ ] Layer panel for organ system toggling
- [ ] Attempt start/save/submit flow with timer

### Phase 5 — Grading & Canvas Sync (Weeks 14–16)
- [ ] Auto-grading service with full rubric logic
- [ ] Bull queue + worker container for Canvas sync
- [ ] Grade Center UI with MUI DataGrid
- [ ] `AttemptReview` drawer with instructor override
- [ ] Canvas AGS grade passback
- [ ] Retry logic and `GradeSyncLog`
- [ ] CSV grade export

### Phase 6 — Analytics & Polish (Weeks 17–19)
- [ ] Class analytics charts (recharts)
- [ ] Per-structure difficulty analytics
- [ ] Mobile-responsive optimization
- [ ] WCAG 2.1 AA accessibility audit
- [ ] Playwright E2E test suite
- [ ] Production Docker build + GitHub Actions CI/CD
- [ ] Canvas LTI tool registration guide

---

## 16. Folder Structure Reference

```
anatoview/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── app.ts
│   │   │   ├── config/
│   │   │   │   ├── database.ts
│   │   │   │   ├── redis.ts
│   │   │   │   ├── lti.ts
│   │   │   │   └── storage.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── roles.ts
│   │   │   │   └── validate.ts
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── animals.ts
│   │   │   │   ├── labs.ts
│   │   │   │   ├── attempts.ts
│   │   │   │   ├── grades.ts
│   │   │   │   └── lti.ts
│   │   │   ├── services/
│   │   │   │   ├── gradingService.ts
│   │   │   │   ├── ltiService.ts
│   │   │   │   ├── canvasService.ts
│   │   │   │   └── storageService.ts
│   │   │   ├── worker/
│   │   │   │   └── index.ts
│   │   │   └── types/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── Dockerfile.dev
│   │   ├── Dockerfile.prod
│   │   └── package.json
│   │
│   └── web/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── theme/
│       │   ├── router/
│       │   ├── stores/
│       │   ├── hooks/
│       │   ├── components/
│       │   │   ├── layout/
│       │   │   ├── dissection/
│       │   │   ├── labs/
│       │   │   ├── grading/
│       │   │   └── shared/
│       │   ├── pages/
│       │   └── api/
│       ├── Dockerfile.dev
│       ├── Dockerfile.prod
│       ├── vite.config.ts
│       └── package.json
│
├── packages/
│   ├── shared/
│   │   └── src/
│   │       ├── types/
│   │       └── schemas/
│   └── lti/
│       └── src/
│
├── infrastructure/
│   ├── nginx/
│   │   ├── nginx.dev.conf
│   │   ├── nginx.prod.conf
│   │   ├── spa.conf
│   │   └── certs/
│   ├── postgres/
│   │   └── init.sql
│   ├── localstack/
│   │   └── init-s3.sh
│   └── keys/
│
├── scripts/
│   ├── generate-lti-keys.sh
│   ├── canvas-registration.md
│   └── setup-prod-env.sh
│
├── tests/
│   └── e2e/
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── docker-compose.test.yml
├── .env
├── .env.example
├── .dockerignore
├── .gitignore
├── FRAMEWORK.md
└── package.json
```

---

## 17. Key Libraries & Dependencies

| Package | Container | Purpose |
|---------|-----------|---------|
| `ltijs` | api | LTI 1.3 provider (launch, Deep Linking, AGS grade passback) |
| `prisma` | api | PostgreSQL ORM with migrations |
| `bull` | api + worker | Redis-backed job queue for Canvas grade sync |
| `socket.io` | api | Real-time events |
| `@aws-sdk/client-s3` | api | S3 uploads (LocalStack in dev, AWS in prod) |
| `zustand` | web | React state management |
| `@tanstack/react-query` | web | Server state, caching, mutations |
| `konva` / `react-konva` | web | SVG dissection canvas interaction |
| `three` / `@react-three/fiber` | web | 3D models (Phase 2) |
| `recharts` | web | Grade analytics charts |
| `zod` | shared | Validation (frontend + backend) |
| `react-hook-form` | web | Lab Builder forms |
| `playwright` | api | E2E testing |

---

## 18. Claude Code Prompts (Step-by-Step)

> **Before running any prompt:** Save this file as `FRAMEWORK.md` in the `anatoview/` project root. Start each Claude Code session with:
> ```
> Read FRAMEWORK.md. Use it as the source of truth for all architecture decisions. Everything runs in Docker.
> ```

---

### PROMPT 1 — Docker Infrastructure + Monorepo

```
Create the AnatoView monorepo from scratch using npm workspaces. Follow FRAMEWORK.md exactly.

Create ALL of the following files with complete content:

1. Root package.json with workspace config and Docker-based npm scripts
2. docker-compose.yml — all 8 services (nginx, web, api, worker, postgres, redis, localstack, adminer)
   as specified in Section 3 of FRAMEWORK.md, including healthchecks and named volumes
3. docker-compose.prod.yml — production overrides
4. docker-compose.test.yml — test environment overrides
5. apps/api/Dockerfile.dev — Node 20 alpine, ts-node-dev hot reload
6. apps/api/Dockerfile.prod — multi-stage build, tsc compile
7. apps/web/Dockerfile.dev — Vite dev server bound to 0.0.0.0
8. apps/web/Dockerfile.prod — multi-stage, build then nginx serve
9. infrastructure/nginx/nginx.dev.conf — proxy web:3000 and api:3001
10. infrastructure/nginx/nginx.prod.conf — SSL, rate limiting, security headers
11. infrastructure/nginx/spa.conf — SPA routing for React
12. infrastructure/postgres/init.sql — extensions + test DB
13. infrastructure/localstack/init-s3.sh — create S3 buckets with correct policy
14. .env.example — all required environment variables (no values)
15. .dockerignore
16. .gitignore (includes .env, infrastructure/keys/*.pem, node_modules)
17. scripts/generate-lti-keys.sh — openssl RSA key generation

After creating all files, verify docker compose config validates with: docker compose config
```

---

### PROMPT 2 — Prisma Schema + Database Seed

```
In apps/api, set up Prisma with the complete schema from Section 5 of FRAMEWORK.md.

Create:
1. apps/api/prisma/schema.prisma — full Prisma schema (all 12 models, all enums)
2. apps/api/prisma/seed.ts — seed script with:
   - 7 animals as specified in Section 12 of FRAMEWORK.md with realistic descriptions
   - At least 20 anatomical structures for the cat cardiovascular system
     (each with name, latin_name, svg_element_id, description, fun_fact, hint, difficulty_level)
   - 2 anatomical structures for the cat digestive system
3. apps/api/package.json — all dependencies from Section 17
4. apps/api/tsconfig.json — TypeScript config for Node.js

Then run inside the Docker container:
  docker compose exec api npx prisma migrate dev --name "initial_schema"
  docker compose exec api npm run db:seed

Verify the seed ran by checking: docker compose exec api npx prisma studio
```

---

### PROMPT 3 — LTI 1.3 Backend Integration

```
In apps/api/src, implement LTI 1.3 integration using the ltijs npm package.

Create:
1. src/config/lti.ts — initializeLTI() function using ltijs Provider.setup() and
   Provider.registerPlatform() as shown in Section 7 of FRAMEWORK.md
2. src/routes/lti.ts — Provider.onConnect() handler that:
   - Extracts user, course, role from LTI token claims (Section 7 Quick Reference)
   - Upserts user and course in PostgreSQL via Prisma
   - Issues a JWT (1hr expiry) + stores refresh token in Redis
   - Redirects instructor to /dashboard, student to /lab/:labId
3. src/services/ltiService.ts — sendGradeToCanvas() using AGS Provider.Grade.ScorePublish()
   and creates GradeSyncLog entry
4. src/index.ts — bootstrap() that calls initializeLTI() before app.listen()
5. src/app.ts — Express app with helmet, cors, morgan, JSON body parser, health check endpoint
   at GET /health returning { status: 'ok', timestamp }

Also create middleware/auth.ts (verifies JWT from Authorization header)
and middleware/roles.ts (checks role: instructor|ta|student|admin).

Test that GET http://localhost/api/health returns 200 after docker compose up.
```

---

### PROMPT 4 — All Express API Routes

```
In apps/api/src/routes/, create all REST API routes from the Route Map in Section 6 of FRAMEWORK.md.

For each route file, include:
- Prisma queries with proper includes/selects
- Zod request validation via middleware/validate.ts
- Auth middleware on all routes
- Role guards where specified (e.g., instructors-only for lab creation)
- Consistent error handling: 400 validation, 403 forbidden, 404 not found, 500 server error
- Proper TypeScript types throughout

Build in this order:
1. routes/auth.ts — GET /api/auth/me, POST /api/auth/logout
2. routes/animals.ts — GET /api/animals, GET /api/animals/:id, GET /api/animals/:id/structures
3. routes/labs.ts — full CRUD + POST /api/labs/:id/publish (triggers Canvas Deep Linking)
4. routes/attempts.ts — GET/POST /api/labs/:id/attempt, POST start, POST submit
5. routes/grades.ts — grade listing + Canvas sync endpoints

Also create:
- src/services/gradingService.ts — full auto-grading pipeline from Section 10 of FRAMEWORK.md,
  including Levenshtein fuzzy matching, hint penalties, category weights
- src/worker/index.ts — Bull queue consumer for grade passback jobs
- apps/api/src/__tests__/grading.test.ts — comprehensive tests for grading edge cases
```

---

### PROMPT 5 — React Frontend + MUI Theme + Routing

```
Set up the complete React frontend in apps/web using Vite + React + TypeScript + Material UI.

Create:
1. apps/web/package.json — all dependencies from Section 17 of FRAMEWORK.md
2. apps/web/vite.config.ts — host 0.0.0.0, port 3000 (required for Docker)
3. src/theme/theme.ts — MUI theme (primary #1B4F72, secondary #2ECC71, all variants)
4. src/main.tsx — app entry with ThemeProvider + QueryClientProvider
5. src/App.tsx — router root
6. src/router/index.tsx — all routes from Section 8 of FRAMEWORK.md
7. src/api/client.ts — axios instance that reads JWT from memory, auto-attaches
   Authorization header, redirects to /unauthorized on 401
8. src/stores/useAppStore.ts — Zustand store (user, course, setUser, setCourse)
9. src/stores/useDissectionStore.ts — Zustand store (activeLayer, selectedStructure,
   answeredStructures, hintsUsed — all actions from Section 8)
10. src/components/layout/AppShell.tsx — MUI AppBar + Drawer sidebar, role-aware nav links
11. src/components/shared/RoleGuard.tsx — HOC that checks role and redirects to /unauthorized

Create full stub pages with meaningful placeholder UI (not just "TODO") for:
Dashboard, LabBuilder, LabView, DissectionLab, GradeCenter, SpecimenLibrary, Unauthorized

Verify: docker compose up → http://localhost/ shows the React app
```

---

### PROMPT 6 — Dissection Viewer Component

```
Create the complete DissectionViewer component and all supporting dissection UI components
in apps/web/src/components/dissection/ as specified in Section 9 of FRAMEWORK.md.

DissectionViewer.tsx must:
1. Accept props: modelUrl, structures (AnatomicalStructure[]), mode, labId, attemptId, onAnswer
2. Fetch the SVG model from modelUrl (which points to LocalStack/S3)
3. Render SVG elements in a react-konva Stage with correct dimensions
4. Identify clickable structures via data-structure-id attributes
5. In 'identify' mode: click → AnswerInput popover; correct → green overlay; wrong → red overlay
6. In 'explore' mode: hover → StructureLabel; click → StructurePopover (name, latin, description, hint)
7. Pinch-to-zoom + click-drag pan using Konva Stage scale/position
8. Layer toggling: show/hide SVG groups by data-system using Konva layer visibility
9. Batch POST /api/attempts/:id/events every 5 seconds (click, hover, zoom, hint_request events)

Also create these fully functional components:
- LayerPanel.tsx — MUI Drawer sidebar, toggle switches per organ system
- StructureLabel.tsx — floating MUI Chip that tracks structure coordinates
- StructurePopover.tsx — MUI Popover with name, latin name, description, fun_fact, hint button
- AnswerInput.tsx — MUI TextField + Submit, auto-focus, shows correct/wrong feedback
- HintDrawer.tsx — slide-in MUI Drawer with hint text, tracks hints_used in useDissectionStore
- DissectionProgress.tsx — MUI LinearProgress + score chip, updates in real-time
- AnatomyToolbar.tsx — MUI ButtonGroup for zoom in/out/reset, mode indicator

Use the useDissectionStore (Zustand) for all shared state.
```

---

### PROMPT 7 — Lab Builder Wizard

```
Create the complete Lab Builder multi-step wizard in apps/web/src/components/labs/LabBuilder/
as specified in Section 8 of FRAMEWORK.md.

Build all 6 steps as separate components:
1. AnimalSelector.tsx — MUI Grid of animal cards (image, name, category, system count chips),
   fetched from GET /api/animals; click to select
2. SystemSelector.tsx — MUI FormGroup of checkboxes for organ systems of the selected animal
3. StructurePicker.tsx — MUI DataGrid of structures; toggle isRequired, edit points_possible inline;
   search/filter bar; difficulty badges; select-all by system
4. RubricBuilder.tsx — per-structure accepted aliases (MUI Chip input), hint penalty slider,
   spelling tolerance toggle, partial credit toggle, category weight inputs
5. SettingsPanel.tsx — time_limit_minutes (slider), attempts_allowed (select), show_hints (switch),
   randomize_order (switch), passing_threshold_percent (slider)
6. ReviewAndPublish.tsx — full summary table of all settings; "Save as Draft" → POST /api/labs;
   "Publish to Canvas" → POST /api/labs/:id/publish; CanvasSyncStatus badge

Wrap in LabBuilderStepper.tsx using MUI Stepper (with error state per step).
Use react-hook-form with Zod validation per step.
Use TanStack Query mutations for API calls.
Show loading states and error messages on form submission.

Create the pages/LabBuilder.tsx page that renders LabBuilderStepper.tsx.
```

---

### PROMPT 8 — Grade Center + Canvas Sync UI

```
Create the complete Grade Center in apps/web/src/pages/GradeCenter.tsx
and components/grading/ as specified in Section 10 of FRAMEWORK.md.

GradeCenter.tsx:
- MUI DataGrid (@mui/x-data-grid) with students as rows, labs as columns
- Cell renderer: score percentage with color (red <70, yellow 70-85, green >85)
- Toolbar: lab filter dropdown, "Sync All to Canvas" button, "Export CSV" button
- Row click OR cell click → opens AttemptReview drawer
- CanvasSyncStatus badge per column header (pending/success/failed with timestamp)
- Empty state with helpful message when no submissions

AttemptReview.tsx (MUI Drawer, full-height):
- Student info header (name, email, submission time, time spent formatted)
- Summary: total score / max points, percentage, pass/fail chip
- StructureGradeRow for each structure:
  - Structure name + latin name
  - Student's answer (color-coded correct/incorrect)
  - Correct answer
  - Points earned chip + hints used badge
  - GradeOverrideField: number input (0 to points_possible)
- Instructor feedback TextField
- Action buttons: "Save Changes" → PUT /api/attempts/:id/grade
  and "Sync to Canvas" → POST /api/grades/:attemptId/sync

ClassAnalytics.tsx (collapsible panel below the grid):
- Score distribution histogram (recharts BarChart, 10-point buckets)
- Per-structure accuracy sorted ascending (reveals hardest structures)
- Average score trend over time (LineChart)

All data via TanStack Query hooks with loading + error states.
```

---

### PROMPT 9 — End-to-End Tests

```
Create complete Playwright E2E tests in tests/e2e/ using the test Docker environment.

Configure playwright.config.ts to:
- Use baseURL: http://localhost (nginx)
- Run against docker-compose.test.yml environment
- Screenshot on failure

Create three spec files:

1. instructorCreatesLab.spec.ts:
   - Intercept POST /lti/launch and inject a mock instructor JWT
   - Navigate to /dashboard, click "New Lab"
   - Complete all 6 Lab Builder steps: select Cat, select Cardiovascular, pick 10 structures,
     add 2 accepted aliases for "Left Ventricle", set 60min limit and 2 attempts
   - Click "Publish to Canvas"
   - Assert POST /api/labs/:id/publish was called
   - Assert lab appears in the dashboard lab list

2. studentCompletesLab.spec.ts:
   - Use a pre-seeded lab (created via API in beforeEach)
   - Inject mock student JWT
   - Navigate to /lab/:id/attempt
   - Wait for DissectionViewer to load
   - Click 5 structure elements, type answers (3 correct, 2 wrong)
   - Click "Request Hint" on one structure
   - Click "Submit Lab"
   - Assert score is displayed (should be 60% with 1 hint penalty)
   - Assert attempt status in DB is 'graded'

3. gradePassback.spec.ts:
   - Mock Canvas AGS endpoint (POST /api/lti/scores) with a route intercept
   - Call POST /api/grades/:attemptId/sync for a graded attempt
   - Assert the Canvas mock received the correct scoreGiven and scoreMaximum
   - Assert grade_sync_log entry has status 'success'
   - Test retry: make Canvas mock return 500, call sync again,
     assert retry happened and grade_sync_log status is 'failed' with response details
```

---

### PROMPT 10 — SVG Model Pipeline + Seed Assets

```
Create the tooling and seed assets for the SVG dissection model pipeline.

1. Create a seed SVG for the cat cardiovascular system at:
   infrastructure/models/cat/cardiovascular/model.svg
   The SVG must:
   - Be 1200x900px viewBox
   - Show a simple but recognizable cat heart cross-section
   - Include labeled elements for at minimum:
     left ventricle, right ventricle, left atrium, right atrium,
     aorta, pulmonary artery, pulmonary vein, mitral valve,
     tricuspid valve, interventricular septum
   - Each structure must have id="structure-slug" and data-system="cardiovascular"
     and data-structure-id matching the seeded UUID in the database

2. Create scripts/upload-models.sh that:
   - Uses the AWS CLI pointed at LocalStack (endpoint http://localhost:4566)
   - Uploads all SVGs from infrastructure/models/ to s3://anatoview-assets/models/
   - Prints the accessible URL for each uploaded file

3. Update apps/api/prisma/seed.ts to:
   - Upload the SVG to LocalStack using the S3 SDK after creating the dissection_model record
   - Set model_file_url to http://localhost:4566/anatoview-assets/models/cat/cardiovascular/model.svg
   - Link all 20 anatomical structures to their svg_element_id in the SVG

4. Create a Makefile in the project root with convenient dev shortcuts:
   make up           → docker compose up -d
   make down         → docker compose down
   make reset        → docker compose down -v && docker compose up -d && make migrate && make seed
   make migrate      → docker compose exec api npx prisma migrate dev
   make seed         → docker compose exec api npm run db:seed && bash scripts/upload-models.sh
   make logs         → docker compose logs -f
   make shell        → docker compose exec api bash
   make test         → docker compose run --rm api npm test
```

---

### PROMPT 11 — Production Build + CI/CD

```
Create the complete production deployment configuration for AnatoView.

1. .github/workflows/ci.yml — GitHub Actions pipeline:
   - Trigger on push to main and PRs
   - Jobs: test (docker compose test env), build (prod images), deploy
   - test job: start services, wait for health, run migrations, run tests, tear down
   - build job: build prod images, tag with git SHA, push to registry
   - deploy job: SSH to production server, pull new images, docker compose up with prod override

2. scripts/canvas-registration.md — Step-by-step guide for Canvas admin:
   - How to navigate to Developer Keys in Canvas admin
   - All LTI tool configuration values (URLs, scopes, placements)
   - How to install the key in a subaccount
   - How to test the LTI launch with ngrok during development

3. scripts/setup-prod-env.sh — Creates a .env.prod file by prompting for:
   CANVAS_BASE_URL, LTI_CLIENT_ID, JWT_SECRET, DATABASE_URL, REDIS_URL,
   S3_BUCKET, AWS credentials — with validation for each

4. docs/QUICKSTART.md — Developer quickstart:
   - Prerequisites: Docker Desktop, Node 20, mkcert
   - 5-step setup: clone, copy .env.example, generate LTI keys, generate SSL certs,
     docker compose up, docker compose exec api npx prisma migrate dev && npm run db:seed
   - How to access: app at https://localhost, Adminer at http://localhost:8080,
     Prisma Studio via docker compose exec api npx prisma studio
   - How to register with Canvas using ngrok for local development

Verify all Docker builds succeed: docker compose -f docker-compose.yml -f docker-compose.prod.yml build
```

---

## Quick Reference: Canvas LTI Claims Used

```typescript
// What AnatoView reads from the LTI token
const userId     = token.user;
const name       = token.userInfo?.name;
const email      = token.userInfo?.email;
const courseId   = token.platformContext?.context?.id;
const courseName = token.platformContext?.context?.title;
const roles      = token.platformContext?.roles;
const labId      = token.platformContext?.custom?.lab_id;
const lineItemUrl = token.platformContext?.[
  'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'
]?.lineitem;
```

## Quick Reference: Docker Cheat Sheet

```bash
# Get started (first time)
cp .env.example .env           # Fill in Canvas credentials
bash scripts/generate-lti-keys.sh
mkcert -install && mkcert -cert-file infrastructure/nginx/certs/cert.pem \
  -key-file infrastructure/nginx/certs/key.pem localhost 127.0.0.1
docker compose up -d
docker compose exec api npx prisma migrate dev
docker compose exec api npm run db:seed

# Daily use
docker compose up -d           # Start
docker compose down            # Stop
docker compose logs -f api     # Watch API
docker compose logs -f web     # Watch React

# Database
docker compose exec api npx prisma studio   # Visual DB browser
docker compose exec postgres psql -U anatoview

# Debugging
docker compose exec api bash   # Shell in API container
docker compose ps              # See all container statuses
docker compose restart api     # Restart one service
```

---

*AnatoView Framework v2.0 — Built for pre-veterinary small animal anatomy education*
*Designed for Claude Code — React · TypeScript · PostgreSQL · Material UI · Canvas LTI 1.3 · Docker*
