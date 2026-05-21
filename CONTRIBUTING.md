# Contributing to APIBlueprint

Thanks for your interest in contributing to APIBlueprint.

## Development Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and set required values
3. Install pre-commit hooks: `pre-commit install`
4. Start services with Docker: `docker compose up --build -d`

## Code Quality

This project enforces code quality through automated tooling:

- **Backend (Python)**: Ruff for linting and formatting, MyPy for type checking
- **Frontend (JavaScript)**: ESLint for linting
- **Pre-commit hooks**: Run automatically before each commit

Run checks locally:

```bash
# Backend linting
cd backend && ruff check . && ruff format --check .

# Backend type checking
cd backend && mypy .

# Frontend linting
cd frontend && npm run lint

# Run tests
docker compose exec backend python -m unittest discover -s tests -v
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with appropriate tests
3. Ensure all linting and tests pass
4. Submit a pull request with a clear description of changes
5. PRs require at least one review before merging

## Commit Messages

Follow conventional commits format:

```
feat: add pagination to list endpoints
fix: resolve JWT token expiry edge case
docs: update API documentation
chore: update dependencies
```

## Project Structure

```
apiblueprint/
├── backend/          # FastAPI backend
├── frontend/         # React + Vite frontend
├── mock/             # Express mock server
├── docker-compose.yml
└── .github/          # CI/CD workflows
```
