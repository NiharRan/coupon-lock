<?php
/**
 * One dismissible note about Kestrix Coupon Guard Pro, shown only on our own Kestrix Coupon Guard screen.
 *
 * @package Kestrix_Coupon_Guard
 */

namespace Kestrix_Coupon_Guard\Features;

use Kestrix_Coupon_Guard\Admin\Page;
use Kestrix_Coupon_Guard\Module;

defined( 'ABSPATH' ) || exit;

class ProUpsell implements Module {
	const META   = 'kestrix_coupon_guard_pro_notice_until';
	const ACTION = 'kestrix_coupon_guard_dismiss_pro_notice';
	const URL    = 'https://twinspotlab.com/software/twinspot-pro';

	/**
	 * Pure rule. $user_id is unused today; kept so the rule can become per-user without a signature change.
	 */
	public static function should_show( int $user_id, bool $pro_active, int $dismissed_until ): bool {
		return ! $pro_active && $dismissed_until <= time();
	}

	public function register(): void {
		add_action( 'admin_notices', array( $this, 'render' ) );
		add_action( 'admin_post_' . self::ACTION, array( $this, 'dismiss' ) );
	}

	public function render(): void {
		$screen = get_current_screen();
		if ( ! $screen || Page::HOOK !== $screen->id || ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		$user_id = get_current_user_id();
		if ( ! self::should_show( $user_id, defined( 'TWINSPOT_PRO_VERSION' ), (int) get_user_meta( $user_id, self::META, true ) ) ) {
			return;
		}
		$dismiss = wp_nonce_url( admin_url( 'admin-post.php?action=' . self::ACTION ), self::ACTION );
		echo '<div class="notice notice-info"><p>' . esc_html__( 'Kestrix Coupon Guard Pro adds more tools for finding and handling repeat accounts.', 'kestrix-coupon-guard' ) . ' <a href="' . esc_url( self::URL ) . '">' . esc_html__( 'Learn more', 'kestrix-coupon-guard' ) . '</a> | <a href="' . esc_url( $dismiss ) . '">' . esc_html__( 'Dismiss', 'kestrix-coupon-guard' ) . '</a></p></div>';
	}

	public function dismiss(): void {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'kestrix-coupon-guard' ), 403 );
		}
		check_admin_referer( self::ACTION );
		update_user_meta( get_current_user_id(), self::META, time() + 30 * DAY_IN_SECONDS );
		wp_safe_redirect( admin_url( 'admin.php?page=kestrix-coupon-guard' ) );
		exit;
	}
}
