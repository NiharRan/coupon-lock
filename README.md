# Coupon Lock for WooCommerce

Spot rings of linked accounts and block repeat welcome coupons at WooCommerce checkout. Runs on your store; no data leaves your site.

- **Per-coupon rules:** match on email, phone, address or IP address. Gmail dots and `+tags` count as the same address.
- **Rings:** orders linked through shared details show as one group, even through other orders.
- **Hold for review:** keep the discount but set the order On hold until you release it.
- **Import past orders:** index the last 12 months on day one.
- Works with classic and block checkout, and High-Performance Order Storage.
- All customer details are stored as hashes with a per-site secret.

## Install

Download `coupon-lock.zip` from the [latest release](https://github.com/NiharRan/coupon-lock/releases/latest) and upload it under Plugins > Add New > Upload Plugin. Requires WordPress 6.6+, PHP 7.4+ and WooCommerce 8.0+.

## Build from source

```
npm ci && npm run build
sh scripts/build-zip.sh   # writes dist/coupon-lock.zip
```

## Support

contact@twinspotlab.com · https://twinspotlab.com

GPL-2.0-or-later. Full description and changelog: [readme.txt](readme.txt).
