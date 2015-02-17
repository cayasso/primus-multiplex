MOCHA_OPTS = --bail --check-leaks

test:
	@./node_modules/.bin/mocha $(MOCHA_OPTS)

.PHONY: test
