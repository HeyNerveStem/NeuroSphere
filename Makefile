# NeuroSphere 3D — common tasks. Run `make help` for the list.
.PHONY: help setup dev-api dev-web build demo test test-e2e lint format format-check validate model screenshots

help:          ## Show this help
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

setup:         ## Install frontend and backend dependencies
	cd frontend && npm ci
	cd backend && pip install -r requirements.txt

dev-api:       ## Run the FastAPI backend on :8000 (docs at /api/docs)
	cd backend && uvicorn app.main:app --reload --port 8000

dev-web:       ## Run the Vite dev server on :5173 (proxies /api to :8000)
	cd frontend && npm run dev

build:         ## Production build of the frontend (frontend/dist)
	cd frontend && npm run build

demo:          ## Static offline demo build (hash routing, no API) for any static host
	cd frontend && npm run build:demo

validate:      ## Validate the 3D model and the medical content
	python3 scripts/model-validation/validate_model.py
	python3 scripts/content-validation/validate_content.py

test: validate ## Unit tests (Vitest + pytest) and validators
	cd frontend && npm run typecheck && npm test
	cd backend && python3 -m pytest -q

test-e2e:      ## Browser acceptance tests (needs a build and system Chrome)
	cd frontend && npm run build && npx playwright test

lint:          ## ESLint + Ruff
	cd frontend && npm run lint
	ruff check backend scripts

format:        ## Format everything (Prettier + Ruff)
	cd frontend && npx prettier --write "src/**/*.{ts,tsx,css}" "e2e/**/*.ts" "*.{ts,js,json,html}"
	frontend/node_modules/.bin/prettier --write "content/*.json" "docs/**/*.md" "*.md" "assets/**/*.md"
	ruff format backend scripts && ruff check --fix backend scripts

format-check:  ## Check formatting without writing
	cd frontend && npx prettier --check "src/**/*.{ts,tsx,css}" "e2e/**/*.ts"
	frontend/node_modules/.bin/prettier --check "content/*.json" "docs/**/*.md"
	ruff format --check backend scripts

model:         ## Re-download BodyParts3D STLs and rebuild + validate the model
	scripts/model-optimization/fetch_bodyparts3d.sh
	scripts/model-optimization/build_model.sh

screenshots:   ## Regenerate docs/images from a running preview (vite preview on :4173)
	python3 scripts/dev/capture_demo.py http://localhost:4173
