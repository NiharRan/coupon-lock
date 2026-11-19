<?php
/**
 * Class autoloader: Coupon_Lock\Sub\Name loads includes/Sub/Name.php.
 *
 * @package Coupon_Lock
 */

defined( 'ABSPATH' ) || exit;

spl_autoload_register(
	function ( $class_name ) {
		$prefix = 'Coupon_Lock\\';
		if ( 0 !== strpos( $class_name, $prefix ) ) {
			return;
		}
		$file = __DIR__ . '/' . str_replace( '\\', '/', substr( $class_name, strlen( $prefix ) ) ) . '.php';
		if ( is_readable( $file ) ) {
			require $file;
		}
	}
);
