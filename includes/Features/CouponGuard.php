<?php
/**
 * Coupon setting "New customers only (Coupon Lock)" and its checkout check.
 *
 * @package Coupon_Lock
 */

namespace Coupon_Lock\Features;

use Coupon_Lock\Data\BlockLog;
use Coupon_Lock\Data\Edges;
use Coupon_Lock\Data\Events;
use Coupon_Lock\Data\Fingerprinter;
use Coupon_Lock\Module;

defined( 'ABSPATH' ) || exit;

class CouponGuard implements Module {
	const META = '_ts_coupon_lock_first_order_only';

	/** @var Edges */
	private $edges;
	/** @var Fingerprinter */
	private $fingerprinter;
	/** @var BlockLog */
	private $log;
	/** @var Events */
	private $events;

	public function __construct( Edges $edges, Fingerprinter $fingerprinter, BlockLog $log, Events $events ) {
		$this->edges         = $edges;
		$this->fingerprinter = $fingerprinter;
		$this->log           = $log;
		$this->events        = $events;
	}

	public function register(): void {
		add_action( 'woocommerce_coupon_options_usage_restriction', array( $this, 'render_field' ) );
		add_action( 'woocommerce_coupon_options_save', array( $this, 'save_field' ), 10, 2 );
		add_filter( 'woocommerce_coupon_is_valid', array( $this, 'validate' ), 20, 2 );
	}

	public function render_field(): void {
		global $post;
		if ( ! $post ) {
			return;
		}
		$on = Rules::for_coupon( new \WC_Coupon( $post->ID ) );
		echo '<div class="options_group"><div style="overflow:hidden;margin:12px;padding:14px 16px;border:1px solid #E5E5E0;border-radius:4px;background:#FAFAF7;color:#111">';
		echo '<strong style="display:flex;align-items:center;gap:8px;font:600 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase"><span aria-hidden="true" style="display:inline-flex;gap:3px"><i style="width:6px;height:6px;border-radius:50%;background:#111"></i><i style="width:6px;height:6px;border-radius:50%;background:#FF5A1F"></i></span>' . esc_html__( 'Coupon Lock rules', 'coupon-lock' ) . '</strong>';
		echo '<p style="float:none;margin:8px 0 10px;padding:0;color:#706F6A">' . esc_html__( 'Refuse this coupon when the shopper matches an earlier order on any ticked detail, even under another account or Gmail alias.', 'coupon-lock' ) . '</p>';
		foreach ( Rules::all() as $id => $rule ) {
			echo '<label style="float:none;width:auto;display:block;margin:4px 0;padding:0"><input type="checkbox" style="float:none;margin:0 6px 0 0;accent-color:#111" name="' . esc_attr( Rules::META ) . '[]" value="' . esc_attr( $id ) . '" ' . checked( in_array( $id, $on, true ), true, false ) . ' /> <strong>' . esc_html( $rule['label'] ) . '</strong> ' . esc_html( $rule['description'] );
			if ( ! empty( $rule['warning'] ) ) {
				echo ' <em style="color:#FF5A1F;font-style:normal">' . esc_html( $rule['warning'] ) . '</em>';
			}
			echo '</label>';
		}
		echo '</div></div>';
	}

	public function save_field( $post_id, $coupon ): void {
		$ids = isset( $_POST[ Rules::META ] ) ? Rules::clean( wp_unslash( $_POST[ Rules::META ] ) ) : array(); // phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- WooCommerce verifies the nonce before this action; ids are checked against the registry.
		$coupon->update_meta_data( Rules::META, $ids );
		$coupon->save();
	}

	public function validate( $valid, $coupon ) {
		$block = 'no' !== get_option( 'ts_coupon_lock_enabled' );
		$hold  = 'yes' === get_option( 'ts_coupon_lock_hold_orders' );
		if ( ! $valid || ( ! $block && ! $hold ) || ! WC()->customer ) {
			return $valid;
		}
		$c       = WC()->customer;
		$h       = $this->fingerprinter->hashes( $c->get_billing_email(), $c->get_billing_phone(), $c->get_billing_address_1(), $c->get_billing_postcode(), \WC_Geolocation::get_ip_address() );
		$blocked = $this->log->is_blocked( $h ); // Admin blocked this ring from every coupon.
		if ( ! $blocked && $this->log->is_allowed( $h ) ) {
			return $valid; // Admin allowed this ring (whitelist rule). A block always wins over an allow.
		}
		// Hold mode never refuses on the "new customers only" rule (OrderTracker holds the order), but admin-blocked rings stay refused.
		$rules = Rules::for_coupon( $coupon );
		if ( ! $blocked && ( ! $block || ! $rules ) ) {
			return $valid;
		}
		// Each selected rule compares its own column. Empty details match nothing, so this fails open.
		$ids     = array();
		$matched = array();
		$all     = Rules::all();
		foreach ( $rules as $rule ) {
			// A rule either names an Edges hash column or supplies its own match callback (for signals Lite does not store).
			$def   = $all[ $rule ];
			$found = isset( $def['match'] ) && is_callable( $def['match'] )
				? array_map( 'intval', (array) call_user_func( $def['match'], $h, $coupon ) )
				: $this->edges->matches( $h, 0, array( (string) ( $def['column'] ?? '' ) ) );
			if ( $found ) {
				$matched[] = $rule;
				$ids       = array_merge( $ids, $found );
			}
		}
		$ids = array_slice( array_values( array_unique( $ids ) ), 0, 20 );
		if ( ! $rules ) {
			$ids     = $this->edges->matches( $h ); // Admin-blocked ring on a coupon with no rules: still link the earlier orders.
			$matched = $this->edges->match_types( $h, $ids );
		}
		/**
		 * Filters whether a repeat shopper's coupon is refused. Return false to let it through.
		 *
		 * @param bool       $refuse Whether to refuse the coupon.
		 * @param int[]      $ids    Earlier order ids linked to this shopper.
		 * @param \WC_Coupon $coupon Coupon being validated.
		 */
		if ( ( $blocked || $ids ) && apply_filters( 'ts_coupon_lock_refuse_coupon', true, $ids, $coupon ) ) {
			$fixed = in_array( $coupon->get_discount_type(), array( 'fixed_cart', 'fixed_product' ), true );
			if ( WC()->session ) {
				WC()->session->set(
					'ts_coupon_lock_blocked_coupon',
					array(
						'code' => $coupon->get_code(),
						'ids'  => array_map( 'intval', $ids ),
					)
				); // Read by OrderTracker to note the order.
			}
			$amount = $fixed ? (float) $coupon->get_amount() : 0.0;
			$this->log->add( $ids, $amount );
			$this->events->add(
				'blocked',
				array(
					'coupon'  => $coupon->get_code(),
					'linked'  => $ids,
					'matched' => $matched,
					'amount'  => $amount,
					'meta'    => $blocked ? array( 'why' => 'ring' ) : array(),
				)
			);
			do_action( 'ts_coupon_lock_coupon_blocked', $coupon->get_code(), $ids );
			throw new \Exception( esc_html( apply_filters( 'ts_coupon_lock_refusal_message', __( 'Sorry, this coupon is only for first-time customers.', 'coupon-lock' ), $coupon ) ) );
		}
		return $valid;
	}
}
