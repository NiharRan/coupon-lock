# Restoring the Coupon Lock Pro note (future work)

The Pro admin note was removed after v0.5.1 because Coupon Lock Pro is not ready. Bring it back when Pro ships.

## What was removed

- `includes/Features/ProUpsell.php`: a dismissible `notice-info` banner on the Coupon Lock admin screen only (`Page::HOOK`), for users with `manage_woocommerce`. It linked to `https://twinspotlab.com/software/twinspot-pro`, hid itself when `TS_COUPON_LOCK_PRO_VERSION` was defined, and stayed dismissed for 30 days per user (user meta `ts_coupon_lock_pro_notice_until`, admin-post action `ts_coupon_lock_dismiss_pro_notice`).
- Its registration in `Plugin::modules()` (`new ProUpsell()` and the `use` line).
- The `ProUpsell::should_show` assertions in `tests/core-test.php` (the "Pro upsell visibility" block).
- The 0.5.0 changelog line in `readme.txt` about the Pro note.

## How to restore

1. Recover the class from git: `git show d2c4f42:includes/Features/ProUpsell.php > includes/Features/ProUpsell.php`.
2. Add `use Coupon_Lock\Features\ProUpsell;` and `new ProUpsell()` back to `includes/Plugin.php`.
3. Restore the test block from `git show d2c4f42:tests/core-test.php`, then run `php tests/core-test.php`.
4. Check the URL still resolves and the wording matches what Pro actually offers.
5. WordPress.org guideline check: the note must stay dismissible, show only on our own screen, and not block any free feature (see `docs/wordpress-org-rules.md`).
6. Add a changelog line in `readme.txt`.

`uninstall.php` still deletes the `ts_coupon_lock_pro_notice_until` user meta, and `includes/Api.php` still exposes the facade for add-ons, so neither needs changes.

## Contact details (already added, keep)

- Email: contact@twinspotlab.com
- Agency site: https://twinspotlab.com (also the plugin header Author URI)
- Listed under "Support" in `readme.txt`.
