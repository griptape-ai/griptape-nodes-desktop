.PHONY: start package typecheck lint format format/check generate/icons \
        pack/osx pack/linux pack/windows pack/windows/arm64 \
        publish/osx publish/linux publish/windows publish/windows/arm64 \
        help

# Development
start: ## Start app in development mode
	npm start

# Type checking and linting
typecheck: ## Run TypeScript type checking
	npm run typecheck

lint: ## Run ESLint
	npm run lint

format: ## Format code with Prettier
	npm run format

format/check: ## Check code formatting with Prettier
	npm run format:check

# Building
package: ## Package the app (generic)
	npm run package

pack/osx: ## Build for macOS
	npm run pack:osx

pack/linux: ## Build for Linux
	npm run pack:linux

pack/windows: ## Build for Windows (x64)
	npm run pack:windows

pack/windows/arm64: ## Build for Windows (ARM64)
	npm run pack:windows:arm64

# Publishing
publish/osx: ## Publish macOS build
	npm run publish:osx

publish/linux: ## Publish Linux build
	npm run publish:linux

publish/windows: ## Publish Windows build
	npm run publish:windows

publish/windows/arm64: ## Publish Windows ARM64 build
	npm run publish:windows:arm64

# Utilities
generate/icons: ## Generate app icons from source
	npm run generate-icons

# Help
help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z0-9_/-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
