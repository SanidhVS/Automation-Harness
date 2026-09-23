#!/usr/bin/env sh
cd "$(dirname "$0")/../.." || exit 1
npx {{PRODUCT_NAME}} run {{AUTOMATION_NAME}} "$@"
