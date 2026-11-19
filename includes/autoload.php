<?php
/**
 * Class autoloader: Kestrix_Coupon_Guard\Sub\Name loads includes/Sub/Name.php.
 *
 * @package Kestrix_Coupon_Guard
 */

defined( 'ABSPATH' ) || exit;

spl_autoload_register(
	function ( $class_name ) {
		$prefix = 'Kestrix_Coupon_Guard\\';
		if ( 0 !== strpos( $class_name, $prefix ) ) {
			return;
		}
		$file = __DIR__ . '/' . str_replace( '\\', '/', substr( $class_name, strlen( $prefix ) ) ) . '.php';
		if ( is_readable( $file ) ) {
			require $file;
		}
	}
);
