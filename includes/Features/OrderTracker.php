<?php
/**
 * Records order hashes at checkout, notes matches on the order, forgets dead orders.
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

class OrderTracker implements Module {
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
		add_action( 'woocommerce_checkout_order_created', array( $this, 'created' ) );             // Classic checkout.
		add_action( 'woocommerce_store_api_checkout_order_processed', array( $this, 'created' ) );  // Block checkout.
		// Paid gateways call payment_complete(), which would otherwise move a held order to processing.
		add_filter(
			'woocommerce_payment_complete_order_status',
			function ( $status, $order_id ) {
				$order = wc_get_order( $order_id );
				return $order && $order->get_meta( '_ts_coupon_lock_held' ) && apply_filters( 'ts_coupon_lock_keep_held', true, $order, $status ) ? 'on-hold' : $status;
			},
			10,
			2
		);
		// A shop manager leaving on-hold releases the order. Any other actor (gateway, webhook, cron) keeps the flag, and a direct move to processing or completed is put back on hold.
		add_action(
			'woocommerce_order_status_changed',
			function ( $order_id, $from, $to ) {
				$order = 'on-hold' === $from && 'on-hold' !== $to ? wc_get_order( $order_id ) : null;
				if ( ! $order || ! $order->get_meta( '_ts_coupon_lock_held' ) ) {
					return;
				}
				if ( current_user_can( 'edit_shop_orders' ) ) {
					$order->delete_meta_data( '_ts_coupon_lock_held' );
					$order->save();
				} elseif ( in_array( $to, array( 'processing', 'completed' ), true ) && apply_filters( 'ts_coupon_lock_keep_held', true, $order, $to ) ) {
					$order->update_status( 'on-hold', __( 'Coupon Lock: returned to on-hold, a held order cannot be released automatically.', 'coupon-lock' ) );
				}
			},
			10,
			3
		);
		// A failed or cancelled order can later succeed on retry, so index it again once it reaches an active status.
		foreach ( array( 'processing', 'completed', 'on-hold' ) as $status ) {
			add_action(
				'woocommerce_order_status_' . $status,
				function ( $order_id ) {
					$this->record( wc_get_order( $order_id ) );
				}
			);
		}
		foreach ( array( 'woocommerce_order_status_cancelled', 'woocommerce_order_status_failed', 'woocommerce_delete_order' ) as $hook ) {
			add_action( $hook, array( $this, 'forget' ) );
		}
	}

	/** New checkout order: index it, log each coupon decision, and hold the order if hold mode is on and a "new customers only" coupon was used by a repeat shopper. */
	public function created( $order ): void {
		try {
			$this->hold_or_log( $order );
		} catch ( \Throwable $e ) {
			// Fail open so checkout never breaks, but leave a trace so a skipped hold is visible to the merchant.
			if ( $order instanceof \WC_Order ) {
				try {
					$order->add_order_note( __( 'Coupon Lock: the repeat-shopper check failed for this order. Review it manually.', 'coupon-lock' ) );
				} catch ( \Throwable $e2 ) {
					return;
				}
			}
		}
	}

	private function hold_or_log( $order ): void {
		$this->record( $order );
		$this->note_blocked_coupon( $order );
		if ( ! $order instanceof \WC_Order || ! $order->get_coupon_codes() ) {
			return;
		}
		$h       = $this->fingerprinter->hashes( $order->get_billing_email(), $order->get_billing_phone(), $order->get_billing_address_1(), $order->get_billing_postcode() );
		$m       = $this->edges->matches( $h, $order->get_id() );
		$match   = $m ? array(
			'linked'  => $m,
			'matched' => $this->edges->match_types( $h, $m ),
		) : array();
		$allowed = $this->log->is_allowed( $h );
		$hold    = 'yes' === get_option( 'ts_coupon_lock_hold_orders' ) && 'no' === get_option( 'ts_coupon_lock_enabled' ); // With blocking on, the coupon was already refused at checkout.
		$guard   = $hold || 'no' !== get_option( 'ts_coupon_lock_enabled' );
		$saved   = array();
		/** @var \WC_Order_Item_Coupon $item */
		foreach ( $order->get_items( 'coupon' ) as $item ) {
			$saved[ $item->get_code() ] = (float) $item->get_discount();
		}
		$held = false;
		foreach ( $order->get_coupon_codes() as $code ) {
			$first = 'yes' === ( new \WC_Coupon( $code ) )->get_meta( CouponGuard::META );
			$base  = array(
				'coupon'   => $code,
				'order_id' => $order->get_id(),
				'amount'   => $saved[ $code ] ?? 0,
			);
			if ( $first && $hold && $m && ! $allowed && apply_filters( 'ts_coupon_lock_hold_order', true, $order, $m ) ) {
				$this->events->add( 'held', $base + $match );
				$held = true;
				continue;
			}
			// Why the coupon went through: not restricted, guard paused, ring allowed, nothing matched, or a match found only now (billing details were missing at coupon check).
			$why = ! $first ? 'open' : ( ! $guard ? 'paused' : ( ! $m ? 'verified' : ( $allowed ? 'allowed' : 'late' ) ) );
			$this->events->add( 'clean', $base + ( $first ? $match : array() ) + array( 'meta' => array( 'why' => $why ) ) );
		}
		if ( $held ) {
			$order->update_meta_data( '_ts_coupon_lock_held', '1' );
			do_action( 'ts_coupon_lock_order_held', $order, $m );
			$order->update_status( 'on-hold', __( 'Coupon Lock: held for review, a new-customers-only coupon was used by a returning shopper.', 'coupon-lock' ) );
		}
	}

	/** Order note for a coupon the guard refused earlier in this checkout session. */
	private function note_blocked_coupon( $order ): void {
		$b = WC()->session ? WC()->session->get( 'ts_coupon_lock_blocked_coupon' ) : null;
		if ( ! $order instanceof \WC_Order || ! $b ) {
			return;
		}
		WC()->session->set( 'ts_coupon_lock_blocked_coupon', null );
		if ( in_array( strtolower( (string) $b['code'] ), array_map( 'strtolower', $order->get_coupon_codes() ), true ) ) {
			return; // The shopper changed details and the coupon went through in the end, so nothing was blocked for this order.
		}
		$ids = array_values( array_diff( (array) $b['ids'], array( $order->get_id() ) ) );
		$order->add_order_note(
			sprintf(
				/* translators: 1: Coupon Lock label, 2: linked order numbers, 3: coupon code, 4: ring link */
				__( '%1$s shares email, phone or address with order(s) %2$s. Blocked coupon “%3$s” at checkout. %4$s', 'coupon-lock' ),
				'<strong>' . esc_html__( 'Coupon Lock System Alert', 'coupon-lock' ) . '</strong> <span style="background:#ffdad6;color:#dc2626;border-radius:99px;padding:1px 8px;font-size:11px;font-weight:600">' . esc_html__( 'Coupon Blocked', 'coupon-lock' ) . '</span><br>',
				$ids ? $this->links( $ids ) : esc_html__( '(none left)', 'coupon-lock' ),
				esc_html( $b['code'] ),
				$this->ring_link( $order->get_id(), count( $ids ) + 1 )
			)
		);
	}

	/** @param int[] $ids */
	private function links( array $ids ): string {
		$out = array();
		foreach ( $ids as $id ) {
			$o     = wc_get_order( $id );
			$out[] = $o ? '<a href="' . esc_url( $o->get_edit_order_url() ) . '">#' . (int) $id . '</a>' : '#' . (int) $id;
		}
		return implode( ', ', $out );
	}

	private function ring_link( int $order_id, int $orders ): string {
		$url  = add_query_arg(
			array(
				'page' => 'coupon-lock',
				'ring' => $order_id,
			),
			admin_url( 'admin.php' )
		);
		$chip = 'background:#e7eeff;border-radius:6px;padding:1px 8px;font-size:11px';
		/* translators: %d: number of orders in the ring */
		$count = _n( '%d order', '%d orders', $orders, 'coupon-lock' );
		return '<br><span style="' . $chip . '">' . esc_html__( 'Linked ring', 'coupon-lock' ) . '</span> <span style="' . $chip . '">' . esc_html( sprintf( $count, $orders ) ) . '</span> <a href="' . esc_url( $url ) . '">' . esc_html__( 'Inspect tree →', 'coupon-lock' ) . '</a>';
	}

	/** @param bool $log Log a "ring" event when the order links to earlier ones (off for the bulk import). */
	public function record( $order, bool $log = true ): void {
		if ( ! $order instanceof \WC_Order || ! apply_filters( 'ts_coupon_lock_track_order', true, $order ) ) {
			return;
		}
		$h = $this->fingerprinter->hashes( $order->get_billing_email(), $order->get_billing_phone(), $order->get_billing_address_1(), $order->get_billing_postcode(), $order->get_customer_ip_address() );
		$this->edges->save( $order->get_id(), $h );
		$m = $this->edges->matches( $h, $order->get_id() );
		if ( $m && ! $order->get_meta( '_ts_coupon_lock_noted' ) ) {
			$order->add_order_note(
				sprintf(
					/* translators: %s: list of order numbers, e.g. "#12, #15" */
					__( 'Coupon Lock: shares email, phone or address with order(s) %s', 'coupon-lock' ),
					$this->links( $m )
				) . ' ' . $this->ring_link( $order->get_id(), count( $m ) + 1 )
			);
			$order->update_meta_data( '_ts_coupon_lock_noted', '1' );
			$order->save();
			do_action( 'ts_coupon_lock_ring_detected', $order, $m );
			if ( $log ) {
				$this->events->add(
					'ring',
					array(
						'order_id' => $order->get_id(),
						'linked'   => $m,
						'matched'  => $this->edges->match_types( $h, $m ),
					)
				);
			}
		}
	}

	public function forget( $order_id ): void {
		$this->edges->delete( (int) $order_id );
	}
}
