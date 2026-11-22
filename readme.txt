=== Coupon Lock for WooCommerce ===
Contributors: nihar007
Tags: woocommerce, coupons, fraud, abuse, checkout
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.5.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Spot rings of linked accounts and block repeat welcome coupons at WooCommerce checkout. Runs on your store; no data leaves your site.

== Description ==

Some shoppers create many accounts to claim your first-order discount again and again. Coupon Lock for WooCommerce links orders that share an email, phone number or address, even through other orders, and lets you stop the repeat coupon at checkout.

* **Per-coupon rules.** Choose which details a coupon checks: email, phone, address or IP address. If the shopper matches an earlier order on any chosen rule, the coupon is refused. Gmail dots and `+tags` are treated as the same address. Set rules from the Rules tab or from the coupon's Usage restriction tab.
* **Rings.** WooCommerce > Coupon Lock lists groups of orders linked to each other. A shares a phone with B and B shares an address with C, so all three show as one ring.
* **Order notes.** An order that matches earlier orders gets a note naming them, with links to those orders and to the ring. When a coupon is refused, the order the shopper then places gets a "Coupon Lock System Alert" note naming the coupon.
* **Hold for review.** Under Plugin Settings, switch from refusing the coupon to holding the order. The shopper keeps the discount, but the order is set to On hold until you release it by changing its status. Rings you block by hand stay refused.
* **Import past orders.** One click indexes the last 12 months so rings show up on day one.
* Works with classic and block checkout, and with High-Performance Order Storage.
* If details are missing the coupon is allowed, so a checkout is never broken.

= Privacy =

Coupon Lock for WooCommerce stores one-way HMAC-SHA256 hashes of each order's billing email, phone, address and IP address in a table on your own site. The hashes cannot be reversed. Nothing is sent to any external server. Data is removed when an order is deleted or cancelled, through the WordPress personal data export and erase tools, and when the plugin is deleted. The plugin adds suggested text to your site's privacy policy page.

== Support ==

Questions or bug reports: contact@twinspotlab.com. Built by Twinspot Lab, https://twinspotlab.com.

== Installation ==

1. Install and activate WooCommerce.
2. Upload the plugin and activate it.
3. Go to WooCommerce > Coupon Lock and click "Import past orders".
4. Edit a coupon, open the Usage restriction tab and tick the Coupon Lock rules you want.

== Frequently Asked Questions ==

= Does it send my customers' data anywhere? =

No. Everything stays in your own database.

= Can it block shoppers who use a different name? =

Yes, if they reuse the same email (including Gmail aliases), phone number or street address plus postcode.

= What does hold for review do? =

Instead of refusing a "new customers only" coupon, the order is placed with the discount and set to On hold, even if a payment gateway reports it paid. Change the status to release it. Blocking and holding are alternatives: only one is active at a time.

= Can I block by IP address? =

Many honest customers share an IP address (offices, mobile networks), so IP matching is off by default. Add the IP rule to a coupon only if you accept that risk.

= Can developers change its behavior? =

Yes. Filters:

* `ts_coupon_lock_refuse_coupon` ( $refuse, $order_ids, $coupon ): return false to let a repeat shopper's coupon through.
* `ts_coupon_lock_refusal_message` ( $message, $coupon ): change the checkout error text.
* `ts_coupon_lock_hold_order` ( $hold, $order, $order_ids ): return false to skip holding an order.
* `ts_coupon_lock_keep_held` ( $keep, $order, $new_status ): return false to let another plugin (an auto-complete or fulfilment tool) move a held order out of on-hold.
* `ts_coupon_lock_track_order` ( $track, $order ): return false to keep an order out of the index.
* `ts_coupon_lock_modules` ( $modules ): add or remove plugin modules.

Actions:

* `ts_coupon_lock_coupon_blocked` ( $code, $order_ids ): a coupon was refused at checkout.
* `ts_coupon_lock_order_held` ( $order, $order_ids ): an order is about to be put on hold.
* `ts_coupon_lock_ring_detected` ( $order, $order_ids ): an order was first linked to earlier orders. Also fires during the bulk import.

`$order_ids` are earlier orders that share email, phone or address with the shopper.

== Screenshots ==

1. Overview: set up in three steps and see what a ring looks like.
2. Overview with rings found, coupons guarded and the latest checkouts.
3. Linked accounts: every ring, filtered by what the orders share.
4. Ring detail: connection map and the shared details behind a ring.
5. Rules: choose which details each coupon checks.
6. Activity log of coupon checks and checkout decisions.
7. Settings: refuse the coupon, hold the order, or do nothing.

== Source code and third-party libraries ==

The admin screen is a React app. The files in `build/` are compiled from the readable source in `src/`, available at https://github.com/NiharRan/coupon-lock. To rebuild: run `npm ci && npm run build`.

The build bundles these libraries, all GPL-compatible: @radix-ui/react-dialog, @xyflow/react, motion, clsx and tailwind-merge (MIT); d3-force and lucide-react (ISC); class-variance-authority (Apache-2.0). Their licenses are in the repository's `package-lock.json` and in each package on npm.

== Changelog ==

= 0.5.1 =
* Added Twinspot Lab support contact (contact@twinspotlab.com). Removed the Coupon Lock Pro admin note.
* New Coupon Lock logo.
* Choose per coupon which details to match: email, phone, address or IP address. Coupons that used "New customers only" keep matching email, phone and address.
* The Rules tab lists every coupon, with search, filters and rule editing.

= 0.5.0 =

= 0.4.0 =
* Add `Api::set_ring_state` and `Api::ring_state_for_order` so add-ons can allow, block or clear a ring.

= 0.3.0 =
* Add `Api::component`, `Api::edge_rows`, a ring detail filter and generic map hubs for add-ons.

= 0.2.0 =
* Add a PHP API for add-ons and start on plugins_loaded.

= 0.1.0 =
* First release.
