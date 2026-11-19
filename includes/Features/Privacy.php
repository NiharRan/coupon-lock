<?php
/**
 * WordPress personal-data export, erase and privacy-policy text.
 *
 * @package Kestrix_Coupon_Guard
 */

namespace Kestrix_Coupon_Guard\Features;

use Kestrix_Coupon_Guard\Data\BlockLog;
use Kestrix_Coupon_Guard\Data\Edges;
use Kestrix_Coupon_Guard\Data\Events;
use Kestrix_Coupon_Guard\Data\Fingerprinter;
use Kestrix_Coupon_Guard\Module;

defined( 'ABSPATH' ) || exit;

class Privacy implements Module {
	/** @var Edges */
	private $edges;
	/** @var Fingerprinter */
	private $fingerprinter;

	/** @var BlockLog */
	private $block_log;
	/** @var Events */
	private $events;

	public function __construct( Edges $edges, Fingerprinter $fingerprinter, BlockLog $block_log, Events $events ) {
		$this->events        = $events;
		$this->edges         = $edges;
		$this->fingerprinter = $fingerprinter;
		$this->block_log     = $block_log;
	}

	public function register(): void {
		add_filter( 'wp_privacy_personal_data_exporters', array( $this, 'add_exporter' ) );
		add_filter( 'wp_privacy_personal_data_erasers', array( $this, 'add_eraser' ) );
		add_action( 'admin_init', array( $this, 'add_policy_text' ) );
	}

	private function rows_for_email( $email ): array {
		$h = $this->fingerprinter->email_hash( $email );
		return '' === $h ? array() : $this->edges->by_email_hash( $h );
	}

	public function add_exporter( $exporters ) {
		$exporters['kestrix-coupon-guard'] = array(
			'exporter_friendly_name' => __( 'Kestrix Coupon Guard', 'kestrix-coupon-guard' ),
			'callback'               => array( $this, 'export' ),
		);
		return $exporters;
	}

	public function add_eraser( $erasers ) {
		$erasers['kestrix-coupon-guard'] = array(
			'eraser_friendly_name' => __( 'Kestrix Coupon Guard', 'kestrix-coupon-guard' ),
			'callback'             => array( $this, 'erase' ),
		);
		return $erasers;
	}

	public function export( $email ): array {
		$items = array();
		foreach ( $this->rows_for_email( $email ) as $row ) {
			$items[] = array(
				'group_id'    => 'kestrix-coupon-guard',
				'group_label' => __( 'Kestrix Coupon Guard order fingerprints', 'kestrix-coupon-guard' ),
				'item_id'     => 'kestrix-coupon-guard-' . $row['order_id'],
				'data'        => array(
					array(
						'name'  => __( 'Order', 'kestrix-coupon-guard' ),
						'value' => '#' . $row['order_id'],
					),
					array(
						'name'  => __( 'Stored one-way hashes of', 'kestrix-coupon-guard' ),
						'value' => implode(
							', ',
							array_filter(
								array(
									$row['email_h'] ? __( 'email', 'kestrix-coupon-guard' ) : '',
									$row['phone_h'] ? __( 'phone', 'kestrix-coupon-guard' ) : '',
									$row['addr_h'] ? __( 'address', 'kestrix-coupon-guard' ) : '',
									$row['ip_h'] ? __( 'IP address', 'kestrix-coupon-guard' ) : '',
								)
							)
						),
					),
				),
			);
		}
		return array(
			'data' => $items,
			'done' => true,
		);
	}

	public function erase( $email ): array {
		$rows   = $this->rows_for_email( $email );
		$hashes = array();
		$ids    = array();
		foreach ( $rows as $row ) {
			$hashes[] = $row['email_h'];
			$hashes[] = $row['phone_h'];
			$hashes[] = $row['addr_h'];
			$ids[]    = (int) $row['order_id'];
			$this->edges->delete( (int) $row['order_id'] );
		}
		if ( $rows ) {
			$this->block_log->forget( $hashes, $ids );
			$this->events->forget( $ids );
		}
		return array(
			'items_removed'  => (bool) $rows,
			'items_retained' => false,
			'messages'       => array(),
			'done'           => true,
		);
	}

	public function add_policy_text(): void {
		if ( function_exists( 'wp_add_privacy_policy_content' ) ) {
			wp_add_privacy_policy_content(
				'Kestrix Coupon Guard',
				wp_kses_post(
					'<p>' . __( 'Kestrix Coupon Guard stores one-way (HMAC-SHA256) hashes of the billing email, phone, address and IP address of each order, to detect repeat customers and block repeat welcome coupons. The hashes cannot be turned back into the original details. They are kept on this site only, are not sent to any third party, and are deleted when the order is deleted, cancelled or erased through the WordPress privacy tools.', 'kestrix-coupon-guard' ) . '</p>'
				)
			);
		}
	}
}
