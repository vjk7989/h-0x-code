#!/usr/bin/env sh
set -eu

PACKAGE="${H0X_PACKAGE_NAME:-@hyper-0x/h0x-code}"

if [ "${1:-}" = "--dry-run" ] || [ "${1:-}" = "-n" ]; then
	echo "Would run: npm install -g ${PACKAGE} --ignore-scripts"
	echo "Then run: h0x --version"
	echo "Then run: h0x --help"
	exit 0
fi

npm install -g "${PACKAGE}" --ignore-scripts
h0x --version
h0x --help
