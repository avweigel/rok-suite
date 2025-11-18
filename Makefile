install:
	pnpm install

build:
	pnpm -r run build

lint:
	pnpm -r run lint || true

test:
	pnpm -r run test || true

py-install:
	@echo "Choose uv or poetry later"

format:
	npx prettier -w .
