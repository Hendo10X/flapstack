.PHONY: tidy run build web-install web-dev dev

tidy:
	go mod tidy

run:
	go run ./cmd/server

build:
	go build -o bin/server ./cmd/server

web-install:
	cd web && npm install

web-dev:
	cd web && npm run dev

dev:
	@echo "Run 'make run' and 'make web-dev' in separate terminals."
