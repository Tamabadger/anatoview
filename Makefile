# ═══════════════════════════════════════════════════════════════════════
# AnatoView — Development Shortcuts
# ═══════════════════════════════════════════════════════════════════════
#
# Usage:
#   make dev       One-command dev setup (bootstrap + start + migrate + seed)
#   make up        Start all Docker services
#   make down      Stop all Docker services
#   make restart   Quick restart (or ARGS="--rebuild|--fresh-db|--full")
#   make reset     Nuke volumes, rebuild, migrate, and seed
#   make migrate   Run Prisma migrations
#   make seed      Seed the database + upload SVGs to LocalStack S3
#   make logs      Tail logs from all services
#   make shell     Open a bash shell in the API container
#   make test      Run API unit tests
#   make test-e2e  Run Playwright E2E tests
#
# ═══════════════════════════════════════════════════════════════════════

.PHONY: up down dev restart reset migrate seed logs shell test test-e2e help

# ─── Default ──────────────────────────────────────────────────────────

help: ## Show this help
	@echo ""
	@echo "AnatoView Development Commands"
	@echo "══════════════════════════════════════════"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ─── Docker ───────────────────────────────────────────────────────────

up: ## Start all Docker services in background
	docker compose up -d

down: ## Stop all Docker services
	docker compose down

dev: ## One-command dev setup: bootstrap, start, migrate, seed
	bash scripts/dev-up.sh $(ARGS)

restart: ## Restart dev (use ARGS="--rebuild|--fresh-db|--full" for more)
	bash scripts/dev-restart.sh $(ARGS)

reset: ## Full reset: nuke volumes, start fresh, migrate, and seed
	docker compose down -v
	docker compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 8
	$(MAKE) migrate
	$(MAKE) seed

# ─── Database ─────────────────────────────────────────────────────────

migrate: ## Run Prisma migrations (dev)
	docker compose exec api npx prisma migrate dev

seed: ## Seed database + upload SVG models to LocalStack S3
	docker compose exec api npm run db:seed
	bash scripts/upload-models.sh

# ─── Logs & Debug ─────────────────────────────────────────────────────

logs: ## Tail logs from all services
	docker compose logs -f

shell: ## Open a bash shell in the API container
	docker compose exec api bash

# ─── Testing ──────────────────────────────────────────────────────────

test: ## Run API unit tests
	docker compose run --rm api npm test

test-e2e: ## Run Playwright E2E tests against Docker stack
	npm run test:e2e
