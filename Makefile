REPORTER = spec
MAIN = index.js
GLOBAL = 'var PrimusMultiplex'
FILE = primus-multiplex.js

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--bail

build:
	@./node_modules/.bin/browserbuild \
		--main $(MAIN) \
		--global $(GLOBAL) \
		--basepath lib/client/ `find lib -name '*.js'` \
		> $(FILE)

.PHONY: test build
