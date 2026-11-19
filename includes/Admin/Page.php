<?php
/**
 * Admin screen: mounts the React app (source in src/, built to build/).
 *
 * @package Coupon_Lock
 */

namespace Coupon_Lock\Admin;

use Coupon_Lock\Module;

defined( 'ABSPATH' ) || exit;

class Page implements Module {
	const HOOK = 'woocommerce_page_coupon-lock';

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
		add_submenu_page( 'woocommerce', 'Coupon Lock', 'Coupon Lock', 'manage_woocommerce', 'coupon-lock', array( $this, 'render' ) );
	}

	public function enqueue( $hook ): void {
		$asset_file = $this->dir . 'build/index.asset.php';
		if ( self::HOOK !== $hook || ! file_exists( $asset_file ) ) {
			return;
		}
		$asset = require $asset_file;
		$url   = plugins_url( 'build/', $this->dir . 'coupon-lock.php' );
		wp_enqueue_script( 'ts-coupon-lock-admin', $url . 'index.js', apply_filters( 'ts_coupon_lock_admin_script_deps', $asset['dependencies'] ), $asset['version'], true );
		wp_enqueue_style( 'ts-coupon-lock-admin', $url . 'style-index.css', array(), $asset['version'] );
		wp_set_script_translations( 'ts-coupon-lock-admin', 'coupon-lock' );
	}

	public function render(): void {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		if ( ! file_exists( $this->dir . 'build/index.asset.php' ) ) {
			echo '<div class="wrap"><div class="notice notice-error"><p>' . esc_html__( 'Coupon Lock admin files are missing. Reinstall the plugin.', 'coupon-lock' ) . '</p></div></div>';
			return;
		}
		echo '<div class="wrap"><div id="ts-coupon-lock-root"></div></div>';
	}
}
