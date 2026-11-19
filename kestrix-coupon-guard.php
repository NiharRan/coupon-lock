<?php
/**
 * Plugin Name:       Kestrix Coupon Guard for WooCommerce
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
 * Text Domain:       kestrix-coupon-guard
 *
 * @package Kestrix_Coupon_Guard
 */

defined( 'ABSPATH' ) || exit;

const KESTRIX_COUPON_GUARD_VERSION = '0.5.0';

require __DIR__ . '/includes/autoload.php';

register_activation_hook( __FILE__, array( \Kestrix_Coupon_Guard\Plugin::class, 'activate' ) );
// On plugins_loaded so add-ons loaded after Lite can hook kestrix_coupon_guard_modules.
add_action(
	'plugins_loaded',
	function () {
		( new \Kestrix_Coupon_Guard\Plugin( __FILE__ ) )->boot();
	}
);
