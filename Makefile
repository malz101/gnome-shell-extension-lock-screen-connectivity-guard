SHELL := /bin/bash

.PHONY: help validate lint package-system package-ego clean

help:
	@echo 'Available targets:'
	@echo '  make validate        Validate source, metadata, and repository hygiene'
	@echo '  make lint            Run ESLint against extension and PolicyKit JavaScript'
	@echo '  make package-system  Build the system/GDM v1.0.0 release ZIP'
	@echo '  make package-ego     Build the deferred EGO-compatible ZIP locally'
	@echo '  make clean           Remove generated build and distribution files'

validate:
	@./scripts/validate.sh

lint:
	@npm run lint

package-system: validate lint
	@./scripts/build-package.sh system

package-ego: validate lint
	@./scripts/build-package.sh ego

clean:
	@rm -rf build dist
