# Per-coupon rules (design)

Date: 2026-11-20. Status: awaiting approval. Size: small-to-medium change (one feature, three layers).

## Intent and why

Today a coupon has one on/off flag, "New customers only", which always matches on email, phone and address. The merchant wants to choose, per coupon, which details are matched: email, phone, address and IP, each one selectable. More rule types will be added over time, so adding a rule must be cheap.

## Goals

- Each coupon stores a set of selected rules. The coupon is refused when any selected rule matches an earlier order.
- The Rules tab lists every coupon and lets the merchant add or remove rules on it.
- A new rule is added by registering it in one place. The UI picks it up with no React change.
- Existing coupons keep behaving the same after upgrade.

## Non-goals

- No rule parameters or conditions yet (for example thresholds or "needs two matches"). A rule is on or off.
- No AND logic between rules. Any selected rule matching blocks.
- No server-side paging of the coupon list (still capped at 500).
- IP matching does not affect ring detection or the overview. It only affects coupon refusal.

## Anti-goals

- Existing stores must not silently start blocking more or fewer shoppers after the upgrade.
- A failure to read the shopper's details must never break checkout (fail open, as today).

## Constraints

- IP matching alone can block innocent shoppers on shared networks (offices, mobile carriers, households). The merchant chose this knowingly. The IP rule shows a warning, and nothing else softens it.
- `Rings::LINKS` stays email/phone/address only, so rings and the overview are unchanged.
- Hashes are keyed per site (`Fingerprinter`). No raw IPs, emails or phones are compared or stored for matching.

## Approaches considered

- **A. Rule registry (chosen).** A PHP registry defines each rule. Each coupon stores a list of rule ids in one meta value. A REST route exposes the registry and the UI renders from it. Costs a little setup now, and a new rule is one registry entry.
- **B. One meta key per rule.** Quicker today, but every new rule needs a new meta key, a new REST field and a React edit. Rejected because many more rules are expected.

## Design

**Registry** (`includes/Features/Rules.php`, new). A class holding an ordered map of rule id to definition: `label`, `description`, `column` (the `Edges` hash column to compare), optional `warning`. Built-in rules:

| id | column | warning |
|----|--------|---------|
| `email` | `email_h` | none |
| `phone` | `phone_h` | none |
| `address` | `addr_h` | none |
| `ip` | `ip_h` | shared networks may block innocent shoppers |

The map passes through the filter `ts_coupon_lock_rules`, so add-ons can register more. A rule whose matching is not a simple column compare can later provide a `match` callback in its definition. Not built now.

**Storage.** One coupon meta, `_ts_coupon_lock_rules`, holding a list of rule ids. Unknown ids (a removed add-on) are ignored on read.

**Migration.** A coupon that has the old meta `_ts_coupon_lock_first_order_only = yes` and no new meta is read as `['email','phone','address']`. Reading goes through one helper, `Rules::for_coupon( $coupon )`, so no data migration run is needed. Saving a coupon writes the new meta. The old meta is kept and still written by the coupon-edit checkbox until that checkbox is replaced (below).

**Checkout check** (`CouponGuard::validate`). Get the coupon's rule ids. If empty, skip (same as the flag being off today). Otherwise collect the selected columns and call `Edges::matches( $h, 0, $columns )`. `Edges::matches` gains an optional `$columns` argument, defaulting to the current `Rings::LINKS` columns, so other callers are unchanged. The shopper hashes must include the IP: pass `WC_Geolocation::get_ip_address()` into `Fingerprinter::hashes`. Admin allow and block of rings, hold mode and the refusal filter keep working as they do now. The blocked event's `matched` list uses the rule that matched.

**Coupon edit screen.** The single "New customers only" checkbox becomes a group of checkboxes, one per registered rule, rendered from the registry and saved to the new meta.

**REST** (`Routes.php`).
- `GET /rules` returns the registry as a list of `{ id, label, description, warning }`.
- `GET /coupons` returns each coupon with `rules: string[]` in place of `locked`.
- `POST /coupons/{id}` takes `rules: string[]`, drops unknown ids, saves, and returns the saved list.

**Rules tab** (`src/screens/rules.tsx`). The row's switch becomes a row of rule chips with an "Add rule" menu built from `GET /rules`. The IP chip shows its warning. The "New customers only" filter chips become: All, Has rules, No rules, plus a filter by a specific rule. Optimistic update with revert on failure, as now. Style stays Twinspot Lab.

## Edge cases

- Coupon with no rules: never refused.
- Shopper details missing for a selected rule: that rule matches nothing (fail open).
- IP unavailable or empty: `ip_h` is an empty hash, treated as no match.
- A coupon whose meta lists a rule id that no longer exists: ignored.
- Hold mode: unchanged. It still never refuses on the coupon rules, and OrderTracker holds the order.

## Testing

- PHPUnit: `Rules::for_coupon` (new meta, old-flag migration, unknown ids); `Edges::matches` with a column subset; `CouponGuard` refuses on a selected rule only, and not on an unselected one.
- Typecheck and build for the React side.

## Left to the builder

- Exact REST arg schema and the "Add rule" menu markup.
- Whether the old checkbox meta is retired now or kept one release for rollback.
- Wording of the IP warning text.
