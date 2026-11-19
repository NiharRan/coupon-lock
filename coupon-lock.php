<?php
/**
 * Plugin Name:       Coupon Lock for WooCommerce
 * Description:       Spot rings of linked accounts and block repeat welcome coupons at WooCommerce checkout. Runs on your store; no data leaves your site.
 * Version:           0.5.0
 * Requires at least: 6.6
 * Requires PHP:      7.4
 * Requires Plugins:  woocommerce
 * WC requires at least: 8.0
 * Author:            Nihar Ranjan Das
 * Author URI:        https://twinspotlab.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       coupon-lock
 *
 * @package Coupon_Lock
 */

defined( 'ABSPATH' ) || exit;

const TS_COUPON_LOCK_VERSION = '0.5.0';

require __DIR__ . '/includes/autoload.php';

register_activation_hook( __FILE__, array( \Coupon_Lock\Plugin::class, 'activate' ) );
// On plugins_loaded so add-ons loaded after Lite can hook ts_coupon_lock_modules.
add_action(
	'plugins_loaded',
	function () {
		( new \Coupon_Lock\Plugin( __FILE__ ) )->boot();
	}
);
