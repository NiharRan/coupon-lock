import { __, sprintf } from '@wordpress/i18n';
import { AtSign, Home, Phone, TicketCheck } from 'lucide-react';
import { Card } from '../components/ui/card';
import type { Overview } from '../types';

export function Rules( { data, enabled }: { data: Overview | null; enabled: boolean } ) {
	const rows = [
		{ icon: AtSign, title: __( 'Email', 'kestrix-coupon-guard' ), text: __( 'Gmail dots and +tags are ignored, so john.doe+deal@gmail.com matches johndoe@gmail.com.', 'kestrix-coupon-guard' ) },
		{ icon: Phone, title: __( 'Phone', 'kestrix-coupon-guard' ), text: __( 'The last 10 digits are compared, ignoring spaces and dashes.', 'kestrix-coupon-guard' ) },
		{ icon: Home, title: __( 'Address', 'kestrix-coupon-guard' ), text: __( 'Street line and postcode must both be present to match.', 'kestrix-coupon-guard' ) },
	];
	return (
		<div className="flex flex-col gap-5">
			<Card className="p-6">
				<h2 className="text-[16px] font-semibold">{ __( 'New customers only coupons', 'kestrix-coupon-guard' ) }</h2>
				<p className="mt-1 text-muted">
					{ enabled
						? __( 'A coupon with “New customers only (Kestrix Coupon Guard)” ticked is refused when the shopper’s email, phone or address matches an earlier order.', 'kestrix-coupon-guard' )
						: __( 'Blocking is paused in Plugin Settings. Orders are still indexed.', 'kestrix-coupon-guard' ) }
				</p>
				<div className="mt-4 flex items-center gap-3">
					<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-info text-primary"><TicketCheck size={ 18 } /></span>
					<span>{ data ? sprintf( __( '%d coupons use this rule.', 'kestrix-coupon-guard' ), data.stats.coupons ) : '…' }</span>
					<a className="text-primary hover:underline" href="edit.php?post_type=shop_coupon">{ __( 'Edit coupons', 'kestrix-coupon-guard' ) }</a>
				</div>
			</Card>
			<Card className="p-6">
				<h2 className="text-[16px] font-semibold">{ __( 'What counts as a match', 'kestrix-coupon-guard' ) }</h2>
				<div className="mt-4 grid gap-6 md:grid-cols-3">
					{ rows.map( ( r ) => (
						<div key={ r.title } className="flex gap-3">
							<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary"><r.icon size={ 18 } /></span>
							<div><div className="font-semibold">{ r.title }</div><p className="mt-1 text-[13px] leading-[18px] text-muted">{ r.text }</p></div>
						</div>
					) ) }
				</div>
				<p className="mt-5 text-[13px] text-muted">{ __( 'IP addresses are stored but never used to match, because shared networks would block innocent shoppers. If a detail is missing, nothing matches and checkout continues.', 'kestrix-coupon-guard' ) }</p>
			</Card>
		</div>
	);
}
