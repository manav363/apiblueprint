.PHONY: setup dev down ps logs test test-backend test-frontend \
        lint lint-backend lint-frontend migrate seed clean smoke

# ── Bootstrap ──────────────────────────────────────────────────────────────────
setup:
	@cp -n .env.example .env 2>/dev/null \
		&& echo "Created .env from .env.example — edit it before continuing." \
		|| echo ".env already exists, skipping copy."
	docker compose build

# ── Development ────────────────────────────────────────────────────────────────
dev:
	docker compose up

down:
	docker compose down

ps:
	docker compose ps

logs:
	docker compose logs -f

# ── Testing ────────────────────────────────────────────────────────────────────
test: test-backend test-frontend

test-backend:
	@echo "→ Running backend tests..."
	@if docker compose ps --services --filter status=running | grep -q backend; then \
		docker compose exec backend python -m pytest tests -v; \
	else \
		cd backend && python -m pytest tests -v; \
	fi

test-frontend:
	@echo "→ Running frontend tests..."
	cd frontend && npm run test

# ── Cold-clone smoke test ──────────────────────────────────────────────────────
smoke:
	@echo "→ Building the full stack from scratch and verifying health..."
	bash scripts/smoke-test.sh

# ── Linting ────────────────────────────────────────────────────────────────────
lint: lint-backend lint-frontend

lint-backend:
	@echo "→ Linting backend..."
	@if docker compose ps --services --filter status=running | grep -q backend; then \
		docker compose exec backend ruff check . && docker compose exec backend ruff format --check .; \
	else \
		cd backend && ruff check . && ruff format --check .; \
	fi

lint-frontend:
	@echo "→ Linting frontend..."
	cd frontend && npm run lint

# ── Database ───────────────────────────────────────────────────────────────────
migrate:
	@echo "→ Running Alembic migrations..."
	@if docker compose ps --services --filter status=running | grep -q backend; then \
		docker compose exec backend alembic upgrade head; \
	else \
		cd backend && alembic upgrade head; \
	fi

seed:
	@echo "→ Seeding database with sample project..."
	DATABASE_URL=$${DATABASE_URL:-postgresql://apiblueprint:apiblueprint@localhost:5432/apiblueprint} \
		python seed.py

# ── Cleanup ────────────────────────────────────────────────────────────────────
clean:
	docker compose down -v
	@echo "Removed containers and volumes. Local data is gone."
