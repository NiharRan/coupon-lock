<?php
/**
 * Admin screen: mounts the React app (source in src/, built to build/).
 *
 * @package Kestrix_Coupon_Guard
 */

namespace Kestrix_Coupon_Guard\Admin;

use Kestrix_Coupon_Guard\Module;

defined( 'ABSPATH' ) || exit;

class Page implements Module {
	const HOOK = 'woocommerce_page_kestrix-coupon-guard';

	/** @var string Plugin root, with trailing slash. */
	private $dir;

	public function __construct( string $dir ) {
		$this->dir = trailingslashit( $dir );
	}

	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	public function add_menu(): void {
		add_submenu_page( 'woocommerce', 'Kestrix Coupon Guard', 'Kestrix Coupon Guard', 'manage_woocommerce', 'kestrix-coupon-guard', array( $this, 'render' ) );
	}

	public function enqueue( $hook ): void {
		$asset_file = $this->dir . 'build/index.asset.php';
		if ( self::HOOK !== $hook || ! file_exists( $asset_file ) ) {
			return;
		}
		$asset = require $asset_file;
		$url   = plugins_url( 'build/', $this->dir . 'kestrix-coupon-guard.php' );
		wp_enqueue_script( 'kestrix-coupon-guard-admin', $url . 'index.js', apply_filters( 'kestrix_coupon_guard_admin_script_deps', $asset['dependencies'] ), $asset['version'], true );
		wp_enqueue_style( 'kestrix-coupon-guard-admin', $url . 'style-index.css', array(), $asset['version'] );
		wp_set_script_translations( 'kestrix-coupon-guard-admin', 'kestrix-coupon-guard' );
	}

	public function render(): void {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		if ( ! file_exists( $this->dir . 'build/index.asset.php' ) ) {
			echo '<div class="wrap"><div class="notice notice-error"><p>' . esc_html__( 'Kestrix Coupon Guard admin files are missing. Reinstall the plugin.', 'kestrix-coupon-guard' ) . '</p></div></div>';
			return;
		}
		echo '<div class="wrap"><div id="kestrix-coupon-guard-root"></div></div>';
	}
}
