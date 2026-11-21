.PHONY: up down logs test build help

## Start both backend and frontend services via Docker Compose
up:
	docker compose up --build -d
	@echo ""
	@echo "=========================================="
	@echo "  🚀 Full Stack running successfully!"
	@echo "  Frontend : http://localhost:3000"
	@echo "  Backend  : http://localhost:8000"
	@echo "  Health   : http://localhost:8000/health"
	@echo "=========================================="

## Stop all services and containers
down:
	docker compose down

## View live logs from all containers
logs:
	docker compose logs -f

## Run backend automated test suite
test:
	cd backend && PYTHONPATH=. pytest -v

## Rebuild Docker images without cache
build:
	docker compose build --no-cache
