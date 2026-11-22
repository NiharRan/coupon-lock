<?php
/** Dev only, run with: php tests/core-test.php (not shipped). */
if ( ! defined( 'ABSPATH' ) && 'cli' !== PHP_SAPI ) {
	exit;
}
defined( 'ABSPATH' ) || define( 'ABSPATH', __DIR__ );
defined( 'DAY_IN_SECONDS' ) || define( 'DAY_IN_SECONDS', 86400 );
require __DIR__ . '/../includes/autoload.php';
use Coupon_Lock\Core\CouponRules;
use Coupon_Lock\Core\Normalize;
use Coupon_Lock\Core\Rings;
function ts_coupon_lock_eq( $actual, $expected, $label ) {
	if ( $actual !== $expected ) {
		echo 'FAIL ' . $label . ': ' . json_encode( $actual ) . "\n";
		exit( 1 );
	}
}

ts_coupon_lock_eq( Normalize::email( 'John.Doe+x@Gmail.com' ), 'johndoe@gmail.com', 'gmail alias' );
ts_coupon_lock_eq( Normalize::email( 'a.b+c@corp.com' ), 'a.b@corp.com', 'non-gmail keeps dots' );
ts_coupon_lock_eq( Normalize::email( 'nope' ), '', 'bad email' );
ts_coupon_lock_eq( Normalize::phone( '+1 (555) 123-4567' ), '5551234567', 'phone' );
ts_coupon_lock_eq( Normalize::phone( '12' ), '', 'short phone' );
ts_coupon_lock_eq( Normalize::address( '12 Main St.', 'ab-1 2cd' ), '12mainst|ab12cd', 'addr' );
ts_coupon_lock_eq( Normalize::address( '12 Main St', '' ), '', 'addr needs postcode' );

// multi-hop: 1-2 share phone, 2-3 share addr, 4 alone
$ts_coupon_lock_rings = Rings::find( array(
	array( 'order_id' => 1, 'email_h' => 'a', 'phone_h' => 'p', 'addr_h' => '' ),
	array( 'order_id' => 2, 'email_h' => 'b', 'phone_h' => 'p', 'addr_h' => 'x' ),
	array( 'order_id' => 3, 'email_h' => 'c', 'phone_h' => '', 'addr_h' => 'x' ),
	array( 'order_id' => 4, 'email_h' => 'd', 'phone_h' => '', 'addr_h' => '' ),
) );
ts_coupon_lock_eq( count( $ts_coupon_lock_rings ), 1, 'one ring' );
sort( $ts_coupon_lock_rings[0] );
ts_coupon_lock_eq( $ts_coupon_lock_rings[0], array( 1, 2, 3 ), 'transitive ring' );
echo "ok\n";
// Linked-by: email shared by 1-2, address shared by 2-3, phone unique.
ts_coupon_lock_eq(
	Rings::links( array(
		array( 'email_h' => 'a', 'phone_h' => '1', 'addr_h' => '' ),
		array( 'email_h' => 'a', 'phone_h' => '2', 'addr_h' => 'x' ),
		array( 'email_h' => 'c', 'phone_h' => '3', 'addr_h' => 'x' ),
	) ),
	array( 'email', 'address' ),
	'ring links'
);
echo "ok links\n";

ts_coupon_lock_eq(
	Rings::shared( array( 'email_h' => 'z', 'phone_h' => 'p', 'addr_h' => 'x' ), array(
		array( 'email_h' => 'a', 'phone_h' => 'p', 'addr_h' => '' ),
		array( 'email_h' => 'b', 'phone_h' => '', 'addr_h' => 'x' ),
	) ),
	array( 'phone', 'address' ),
	'shared links'
);
ts_coupon_lock_eq( Rings::shared( array( 'email_h' => '', 'phone_h' => '', 'addr_h' => '' ), array( array( 'email_h' => '', 'phone_h' => '', 'addr_h' => '' ) ) ), array(), 'empty hashes match nothing' );
ts_coupon_lock_eq( \Coupon_Lock\Core\Csv::row( array( 'a"b', '=1+1', 5 ) ), "\"a\"\"b\",\"'=1+1\",\"5\"\r\n", 'csv row' );
echo "ok shared+csv\n";


// Coupon rules: new meta wins over the legacy flag, dedupes, drops unknown ids.
$ts_coupon_lock_known = array( 'email', 'phone', 'address', 'ip' );
ts_coupon_lock_eq( CouponRules::resolve( array( 'ip', 'email', 'ip', 'zzz' ), 'yes', $ts_coupon_lock_known ), array( 'ip', 'email' ), 'rules: new meta wins' );
ts_coupon_lock_eq( CouponRules::resolve( array(), 'yes', $ts_coupon_lock_known ), array(), 'rules: empty list stays empty' );
ts_coupon_lock_eq( CouponRules::resolve( '', 'yes', $ts_coupon_lock_known ), array( 'email', 'phone', 'address' ), 'rules: legacy flag' );
ts_coupon_lock_eq( CouponRules::resolve( '', 'no', $ts_coupon_lock_known ), array(), 'rules: legacy off' );
ts_coupon_lock_eq( CouponRules::resolve( '', '', $ts_coupon_lock_known ), array(), 'rules: nothing set' );
