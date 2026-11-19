#!/bin/sh
# Builds dist/kestrix-coupon-guard.zip containing only what WordPress.org should ship.
set -e
cd "$(dirname "$0")/.."
npm ci --silent && npm run build --silent
rm -rf dist && mkdir -p dist/kestrix-coupon-guard
rsync -a --exclude-from=.distignore ./ dist/kestrix-coupon-guard/
(cd dist && zip -qr kestrix-coupon-guard.zip kestrix-coupon-guard)
echo "dist/kestrix-coupon-guard.zip"
