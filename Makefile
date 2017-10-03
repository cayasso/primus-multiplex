MOCHA_OPTS = --bail --check-leaks --exit

test:
	@./node_modules/.bin/mocha $(MOCHA_OPTS)

.PHONY: test
