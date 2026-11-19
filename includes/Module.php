<?php
/**
 * A feature of the plugin. To add one: implement this, list it in Plugin::modules().
 *
 * @package Kestrix_Coupon_Guard
 */

namespace Kestrix_Coupon_Guard;

defined( 'ABSPATH' ) || exit;

interface Module {
	/**
	 * Add this module's WordPress hooks.
	 */
	public function register(): void;
}
