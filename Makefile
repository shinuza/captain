default: docs

docs:
	@node_modules/.bin/markdox bin/captain.js

.PHONY: docs
