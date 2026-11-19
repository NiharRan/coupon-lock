<?php
/**
 * Remove plugin data on delete.
 *
 * @package Coupon_Lock
 */

if ( ! defined( 'ABSPATH' ) || ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

require __DIR__ . '/includes/autoload.php';

( new \Coupon_Lock\Data\Edges() )->drop();
( new \Coupon_Lock\Data\Events() )->drop();
( new \Coupon_Lock\Data\Fingerprinter() )->uninstall();
delete_option( 'coupon_lock_blocked' );
delete_option( 'coupon_lock_block_events' );
delete_option( 'coupon_lock_blocked_rings' );
delete_option( 'coupon_lock_allowed_rings' );
delete_option( 'coupon_lock_enabled' );
delete_option( 'coupon_lock_hold_orders' );
delete_metadata( 'user', 0, 'coupon_lock_pro_notice_until', '', true );
// Order and coupon meta (_coupon_lock_noted, _coupon_lock_held, _coupon_lock_first_order_only) is tiny and harmless; left in place.
