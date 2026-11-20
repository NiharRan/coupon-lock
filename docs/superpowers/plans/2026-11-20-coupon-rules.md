# Per-coupon rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each coupon stores a set of selected match rules (email, phone, address, IP); the coupon is refused when any selected rule matches an earlier order, and new rules are added by registering one entry.

**Architecture:** A rule registry (`Features/Rules`) maps rule id to label, description, warning and `Edges` hash column, filterable through `ts_coupon_lock_rules`. A coupon's rule ids live in one meta. `CouponGuard` runs only the selected rules. REST exposes the registry and the per-coupon list, and the React Rules tab renders chips from it.

**Tech Stack:** PHP 7.4+ WordPress/WooCommerce plugin (namespace `Coupon_Lock`), React + Tailwind (scoped), `@wordpress/api-fetch`, tests by `php tests/core-test.php` and `wp eval-file tests/wc-test.php`.

**Spec:** `docs/superpowers/specs/2026-11-20-coupon-rules-design.md`

## Global Constraints

- Text domain `coupon-lock`; all functions, hooks, options and meta prefixed `ts_coupon_lock_` (meta `_ts_coupon_lock_rules`; filter `ts_coupon_lock_rules`).
- Never store or compare raw email, phone, address or IP; only the per-site keyed hashes in `Edges`.
- Checkout code fails open: missing details match nothing, and nothing may break a checkout.
- `Rings::LINKS` stays email/phone/address only; rings and the overview do not change.
- Hold mode and admin allow/block of rings keep working as today.
- Old coupons (meta `_ts_coupon_lock_first_order_only = yes`, no new meta) behave as `['email','phone','address']`.
- Coupon list stays capped at 500; UI follows the Twinspot Lab style already in `src/screens/overview.tsx`.
- Run before each commit: `php tests/core-test.php`, `npm run typecheck`, `php -l` on changed PHP.

## Review Focus

- Coupon with the new meta saved as an empty list: never refused, and the old flag must not bring rules back.
- Rule id in meta that no registry entry defines (removed add-on): ignored, no error.
- IP unavailable or empty at checkout: `ip_h` is the hash of an empty string and must match nothing.
- A registry column that is not a real `Edges` column (bad add-on): `Edges::matches` skips it, no SQL error.
- REST `POST /coupons/{id}` with duplicate or unknown ids: saved list is deduplicated and unknown ids dropped.

---

### Task 1: Rule resolver and registry

**Files:**
- Create: `includes/Core/CouponRules.php`
- Create: `includes/Features/Rules.php`
- Test: `tests/core-test.php`

**Interfaces:**
- Produces: `Core\CouponRules::resolve( $stored, string $legacy, array $known ): string[]`. If `$stored` is an array, return its entries that are strings in `$known`, deduplicated, original order. Otherwise, if `$legacy === 'yes'`, return `['email','phone','address']` filtered to `$known`. Otherwise `[]`. Pure PHP, no WordPress calls.
- Produces: `Features\Rules::all(): array` returning the registry (id => `array{label:string,description:string,column:string,warning?:string}`), passed through `apply_filters( 'ts_coupon_lock_rules', ... )`.
- Produces: `Features\Rules::for_coupon( \WC_Coupon $coupon ): string[]` calling `CouponRules::resolve( $coupon->get_meta( 'META' ), (string) $coupon->get_meta( CouponGuard::META ), array_keys( self::all() ) )`.
- Produces: `Features\Rules::META = '_ts_coupon_lock_rules'`.

- [ ] **Step 1: Write the failing tests** in `tests/core-test.php`, using `ts_coupon_lock_eq` and `use Coupon_Lock\Core\CouponRules;`:
  - `resolve( array('ip','email','ip','zzz'), 'yes', array('email','phone','address','ip') )` equals `array('ip','email')` (new meta wins over legacy, dedupes, drops unknown).
  - `resolve( array(), 'yes', $known )` equals `array()` (empty saved list stays empty).
  - `resolve( '', 'yes', $known )` equals `array('email','phone','address')`.
  - `resolve( '', 'no', $known )` and `resolve( '', '', $known )` equal `array()`.
- [ ] **Step 2: Run** `php tests/core-test.php`. Expected: FAIL, class `CouponRules` not found.
- [ ] **Step 3: Implement `CouponRules::resolve`** as specified in Interfaces.
- [ ] **Step 4: Run** `php tests/core-test.php`. Expected: passes (prints nothing, exit 0).
- [ ] **Step 5: Implement `Rules`** with the four built-in rules (id, column, label, description). `ip` has `warning` = "Shared networks (offices, mobile carriers, households) may block innocent shoppers." Columns: `email_h`, `phone_h`, `addr_h`, `ip_h`. Use `__()` for all copy. `Rules` is a static helper class (no `Module`).
- [ ] **Step 6: Commit**

```bash
git add includes/Core/CouponRules.php includes/Features/Rules.php tests/core-test.php
git commit -m "feat: add coupon rule registry and legacy-flag resolver"
```

### Task 2: Edges column subset and IP at checkout

**Files:**
- Modify: `includes/Data/Edges.php:100` (`matches`)
- Test: `tests/wc-test.php`

**Interfaces:**
- Produces: `Edges::matches( array $h, int $exclude = 0, ?array $columns = null ): array`. `null` means today's behavior (`array_keys( Rings::LINKS )`). Any column not in `array( 'email_h', 'phone_h', 'addr_h', 'ip_h' )` is skipped.

- [ ] **Step 1: Write failing checks** in `tests/wc-test.php` using `ts_check`: create two orders (helper `ts_order`) whose emails and phones differ but whose `customer_ip_address` is the same; `matches( $h, 0, array( 'ip_h' ) )` returns both ids; `matches( $h )` (default) does not return the IP-only match; `matches( $h, 0, array( 'bogus; DROP' ) )` returns `array()` without error. Set the IP with `$o->set_customer_ip_address()` before save.
- [ ] **Step 2: Run** `wp eval-file wp-content/plugins/coupon-lock/tests/wc-test.php`. Expected: the new checks FAIL.
- [ ] **Step 3: Implement the `$columns` argument** in `Edges::matches`; keep the existing query and `%i` placeholder.
- [ ] **Step 4: Run the same command.** Expected: new checks `ok`, all earlier checks still `ok`.
- [ ] **Step 5: Commit** `feat: let Edges::matches take a column subset`.

### Task 3: CouponGuard uses selected rules

**Files:**
- Modify: `includes/Features/CouponGuard.php` (`render_field`, `save_field`, `validate`)
- Test: `tests/wc-test.php`

**Interfaces:**
- Consumes: `Rules::all()`, `Rules::for_coupon()`, `Rules::META`, `Edges::matches( $h, 0, array $columns )`.
- Produces: coupon edit screen shows one checkbox per registered rule, named `ts_coupon_lock_rules[]`, value = rule id; `save_field` saves the posted ids, filtered to known ids and deduplicated, with `update_meta_data( Rules::META, $ids )` (an empty array when none ticked).

- [ ] **Step 1: Write failing checks** in `tests/wc-test.php`: a coupon with meta rules `['ip']` and a prior order with the same IP but a different email, phone and address: validating the coupon for a shopper with that IP throws; the same coupon with rules `['email']` does not throw; a coupon with `[]` does not throw even when the legacy flag is `yes`; a legacy-only coupon (flag `yes`, no new meta) still throws on an email match. Use the file's existing way of simulating a shopper session.
- [ ] **Step 2: Run** the wc test. Expected: new checks FAIL.
- [ ] **Step 3: Rewrite the gate in `validate`.** Replace the `'yes' !== $coupon->get_meta( self::META )` test with `! Rules::for_coupon( $coupon )`. Build the shopper hashes with `WC_Geolocation::get_ip_address()` as the fifth `hashes()` argument. Replace `$this->edges->matches( $h )` with one `matches( $h, 0, array( $column ) )` call per selected rule, merging ids (unique, capped at 20). Build the event `matched` list from the ids of rules whose own call returned rows. Everything else in `validate` (allow/block, hold mode, filters, log, exception text) stays.
- [ ] **Step 4: Replace the single checkbox in `render_field`** with the per-rule group rendered from `Rules::all()` (keep the existing box styling; show `warning` text under a rule that has one). Update `save_field` as in Interfaces. The old `META` constant stays for reading.
- [ ] **Step 5: Run** the wc test and `php -l includes/Features/CouponGuard.php`. Expected: all `ok`.
- [ ] **Step 6: Commit** `feat: refuse coupons by the rules selected per coupon`.

### Task 4: REST routes

**Files:**
- Modify: `includes/Rest/Routes.php` (the `/coupons` routes added earlier)
- Test: `tests/wc-test.php`

**Interfaces:**
- Produces: `GET /coupon-lock/v1/rules` returns `array<int,array{id:string,label:string,description:string,warning:string}>` (empty string when no warning), in registry order.
- Produces: `GET /coupons` rows become `{ id, code, type, amount, status, rules: string[] }` (drop `locked`).
- Produces: `POST /coupons/{id}` takes `rules` (array of strings, required), keeps only known ids, deduplicates, saves with `Rules::META`, returns `{ rules: string[] }`.

- [ ] **Step 1: Write failing checks** in `tests/wc-test.php` using `rest_do_request`: `GET /rules` returns four items with id `ip` having a non-empty warning; `POST` with `['ip','ip','nope','email']` returns `['ip','email']` and the coupon's `Rules::for_coupon` matches it; `GET /coupons` lists a legacy-flag coupon with `['email','phone','address']`.
- [ ] **Step 2: Run** the wc test. Expected: new checks FAIL.
- [ ] **Step 3: Implement** the three route changes. Use `Rules::for_coupon` for `rules` on read, and the same filtering as `save_field` on write (share one small `Rules::clean( array ): array` helper that `save_field` also uses; add it to `Rules` and use it in Task 3's `save_field`).
- [ ] **Step 4: Run** the wc test and `php -l includes/Rest/Routes.php`. Expected: all `ok`.
- [ ] **Step 5: Commit** `feat: expose rule registry and per-coupon rules over REST`.

### Task 5: Rules tab UI

**Files:**
- Modify: `src/lib/api.ts`, `src/screens/rules.tsx`

**Interfaces:**
- Consumes: the Task 4 REST shapes.
- Produces in `api.ts`: `interface RuleDef { id: string; label: string; description: string; warning: string }`; `getRules(): Promise<RuleDef[]>`; `Coupon.rules: string[]` replacing `locked`; `saveCouponRules( id: number, rules: string[] ): Promise<{ rules: string[] }>` replacing `lockCoupon`.

- [ ] **Step 1: Update `api.ts`** with the shapes above.
- [ ] **Step 2: Update `rules.tsx`.** Fetch `getRules()` and `getCoupons()` together. Each row shows its rules as removable chips (label from the registry; unknown ids hidden) and an "Add rule" button opening a small menu of the registry rules not yet on the coupon, each with its description. Adding or removing calls `saveCouponRules` with optimistic update and revert-on-failure (same pattern as the current `toggle`). The IP rule's `warning` shows in its menu entry and as a title on its chip. Replace the rule filter chips with: All, Has rules, No rules, and a select "Any rule / <each rule>". Keep search, discount-type select, paging (10 per page), clear-filters and the Twinspot Lab styling. A coupon with no rules shows "No rules" in muted mono text.
- [ ] **Step 3: Run** `npm run typecheck && npm run build`. Expected: no type errors, build compiles.
- [ ] **Step 4: Check in the browser** (WP admin, Coupon Lock, Rules): add the IP rule to a coupon, reload, the chip persists; remove it and the coupon shows "No rules"; filter by the IP rule lists only that coupon.
- [ ] **Step 5: Commit** `feat: edit per-coupon rules from the Rules tab`.

### Task 6: Docs

**Files:**
- Modify: `CLAUDE.md` (the "Coupon rule" and "Data" bullets), `readme.txt` (changelog and any text saying IP is never used)
- Modify: `src/screens/rules.tsx` text "IP addresses are stored but never used to match…" so it says IP matching is an opt-in rule per coupon.

- [ ] **Step 1: Update the three places** to describe the registry, meta `_ts_coupon_lock_rules`, the legacy fallback and IP being opt-in per coupon.
- [ ] **Step 2: Run** `npm run typecheck && npm run build`. Expected: passes.
- [ ] **Step 3: Commit** `docs: describe per-coupon rules`.
