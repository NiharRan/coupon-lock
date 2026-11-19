<?php
/**
 * Remove plugin data on delete.
 *
 * @package Kestrix_Coupon_Guard
 */

if ( ! defined( 'ABSPATH' ) || ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

require __DIR__ . '/includes/autoload.php';

( new \Kestrix_Coupon_Guard\Data\Edges() )->drop();
( new \Kestrix_Coupon_Guard\Data\Events() )->drop();
( new \Kestrix_Coupon_Guard\Data\Fingerprinter() )->uninstall();
delete_option( 'kestrix_coupon_guard_blocked' );
delete_option( 'kestrix_coupon_guard_block_events' );
delete_option( 'kestrix_coupon_guard_blocked_rings' );
delete_option( 'kestrix_coupon_guard_allowed_rings' );
delete_option( 'kestrix_coupon_guard_enabled' );
delete_option( 'kestrix_coupon_guard_hold_orders' );
delete_metadata( 'user', 0, 'kestrix_coupon_guard_pro_notice_until', '', true );
// Order and coupon meta (_kestrix_coupon_guard_noted, _kestrix_coupon_guard_held, _kestrix_coupon_guard_first_order_only) is tiny and harmless; left in place.
