<?php
/**
 * Wires services and modules together. The only place that knows every class.
 *
 * @package Kestrix_Coupon_Guard
 */

namespace Kestrix_Coupon_Guard;

use Kestrix_Coupon_Guard\Admin\Page;
use Kestrix_Coupon_Guard\Data\BlockLog;
use Kestrix_Coupon_Guard\Data\Edges;
use Kestrix_Coupon_Guard\Data\Events;
use Kestrix_Coupon_Guard\Data\Fingerprinter;
use Kestrix_Coupon_Guard\Features\Compat;
use Kestrix_Coupon_Guard\Features\CouponGuard;
use Kestrix_Coupon_Guard\Features\Importer;
use Kestrix_Coupon_Guard\Features\OrderTracker;
use Kestrix_Coupon_Guard\Features\Privacy;
use Kestrix_Coupon_Guard\Features\ProUpsell;
use Kestrix_Coupon_Guard\Rest\Activity;
use Kestrix_Coupon_Guard\Rest\Overview;
use Kestrix_Coupon_Guard\Rest\Routes;

defined( 'ABSPATH' ) || exit;

class Plugin {
	/** @var string Main plugin file. */
	private $file;

	public function __construct( string $file ) {
		$this->file = $file;
	}

	public static function activate(): void {
		( new Edges() )->install();
		( new Events() )->install();
		( new Fingerprinter() )->install();
	}

	public function boot(): void {
		foreach ( apply_filters( 'kestrix_coupon_guard_modules', $this->modules() ) as $module ) {
			if ( $module instanceof Module ) {
				$module->register();
			}
		}
	}

	/**
	 * Every feature of the plugin. Add a new Module here (or via the kestrix_coupon_guard_modules filter).
	 *
	 * @return Module[]
	 */
	private function modules(): array {
		$edges  = new Edges();
		$prints = new Fingerprinter();
		$log    = new BlockLog();
		$events = new Events();
		$edges->maybe_install(); // Sites updated from an older version get new tables and columns here.
		$events->maybe_install();
		$tracker = new OrderTracker( $edges, $prints, $log, $events );

		return array(
			new Compat( $this->file ),
			$tracker,
			new CouponGuard( $edges, $prints, $log, $events ),
			new Privacy( $edges, $prints, $log, $events ),
			new Routes( new Overview( $edges, $prints, $log, $events ), new Importer( $tracker, $edges, $prints, $events ), new Activity( $events, $edges, $log ) ),
			new Page( plugin_dir_path( $this->file ) ),
			new ProUpsell(),
		);
	}
}
