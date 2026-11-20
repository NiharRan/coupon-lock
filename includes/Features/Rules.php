<?php
/**
 * Registry of the rules a coupon can use. Add a rule by returning one more entry from the ts_coupon_lock_rules filter.
 *
 * @package Coupon_Lock
 */

namespace Coupon_Lock\Features;

use Coupon_Lock\Core\CouponRules;

defined( 'ABSPATH' ) || exit;

class Rules {
	const META = '_ts_coupon_lock_rules';

	/**
	 * Rule id => label, description, optional warning, and how it matches: either `column` (an Edges hash column) or `match`,
	 * a callable( array $hashes, \WC_Coupon $coupon ): int[] returning the earlier order ids that match (for signals Edges does not store).
	 *
	 * @return array<string,array{label:string,description:string,column?:string,match?:callable,warning?:string}>
	 */
	public static function all(): array {
		$rules = array(
			'email'   => array(
				'label'       => __( 'Email', 'coupon-lock' ),
				'description' => __( 'Same email, ignoring Gmail dots and +tags.', 'coupon-lock' ),
				'column'      => 'email_h',
			),
			'phone'   => array(
				'label'       => __( 'Phone', 'coupon-lock' ),
				'description' => __( 'Same last 10 digits of the phone number.', 'coupon-lock' ),
				'column'      => 'phone_h',
			),
			'address' => array(
				'label'       => __( 'Address', 'coupon-lock' ),
				'description' => __( 'Same street line and postcode.', 'coupon-lock' ),
				'column'      => 'addr_h',
			),
			'ip'      => array(
				'label'       => __( 'IP address', 'coupon-lock' ),
				'description' => __( 'Same IP address as an earlier order.', 'coupon-lock' ),
				'column'      => 'ip_h',
				'warning'     => __( 'Shared networks (offices, mobile carriers, households) may block innocent shoppers, and a shopper can hide their IP. Use it alongside other rules.', 'coupon-lock' ),
			),
		);
		/**
		 * Filters the rules a coupon can use.
		 *
		 * @param array $rules Rule id => definition.
		 */
		return (array) apply_filters( 'ts_coupon_lock_rules', $rules );
	}

	/** Selected rule ids for a coupon (falls back to the old flag for coupons saved before rules existed). */
	public static function for_coupon( \WC_Coupon $coupon ): array {
		return CouponRules::resolve( $coupon->get_meta( self::META ), (string) $coupon->get_meta( CouponGuard::META ), array_keys( self::all() ) );
	}

	/** Known, unique rule ids from untrusted input. */
	public static function clean( $ids ): array {
		return CouponRules::resolve( is_array( $ids ) ? $ids : array(), '', array_keys( self::all() ) );
	}
}
