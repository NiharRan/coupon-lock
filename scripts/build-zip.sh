#!/bin/sh
# Builds dist/coupon-lock.zip containing only what WordPress.org should ship.
set -e
cd "$(dirname "$0")/.."
npm ci --silent && npm run build --silent
rm -rf dist && mkdir -p dist/coupon-lock
rsync -a --exclude-from=.distignore ./ dist/coupon-lock/
(cd dist && zip -qr coupon-lock.zip coupon-lock)
echo "dist/coupon-lock.zip"
