<?php
/**
 * Which rules a coupon uses. Pure PHP, no WordPress calls.
 *
 * @package Coupon_Lock
 */

namespace Coupon_Lock\Core;

defined( 'ABSPATH' ) || exit;

class CouponRules {
	/**
	 * Rule ids for a coupon: the saved list if there is one, else the old on/off flag, else none.
	 *
	 * @param mixed    $stored Saved list (array) or '' when never saved.
	 * @param string   $legacy Old flag value ('yes' / 'no' / '').
	 * @param string[] $known  Registered rule ids.
	 * @return string[]
	 */
	public static function resolve( $stored, string $legacy, array $known ): array {
		if ( ! is_array( $stored ) ) {
			$stored = 'yes' === $legacy ? array( 'email', 'phone', 'address' ) : array();
		}
		return array_values( array_unique( array_filter( $stored, fn( $id ) => is_string( $id ) && in_array( $id, $known, true ) ) ) );
	}
}
