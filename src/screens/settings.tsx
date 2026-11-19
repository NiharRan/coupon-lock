import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Check, Info, Tag } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { cn } from '../lib/utils';
import type { SettingsData } from '../lib/api';

/** The two stored switches are exclusive, so the screen offers them as one three-way choice. */
type Mode = 'block' | 'hold' | 'off';

const toMode = ( s: SettingsData ): Mode => {
	if ( s.hold ) {
		return 'hold';
	}
	return s.enabled ? 'block' : 'off';
};
const fromMode = ( m: Mode ): SettingsData => ( { enabled: m === 'block', hold: m === 'hold' } );

const OPTIONS: { id: Mode; title: string; text: string; note?: string }[] = [
	{
		id: 'block',
		title: __( 'Refuse the coupon', 'kestrix-coupon-guard' ),
		text: __( 'The coupon is declined at checkout with a polite message. The shopper can still pay full price.', 'kestrix-coupon-guard' ),
		note: __( 'Recommended', 'kestrix-coupon-guard' ),
	},
	{
		id: 'hold',
		title: __( 'Hold the order for review', 'kestrix-coupon-guard' ),
		text: __( 'The discount applies and checkout goes through, but the order is set to “On hold” until you approve or cancel it.', 'kestrix-coupon-guard' ),
	},
	{
		id: 'off',
		title: __( 'Do nothing', 'kestrix-coupon-guard' ),
		text: __( 'Every coupon is accepted. Kestrix Coupon Guard keeps linking orders into rings, so you can switch back at any time.', 'kestrix-coupon-guard' ),
	},
];

const AFTER: Record< Mode, string > = {
	block: __( 'You see it in Activity as a refused coupon, with the earlier order it matched.', 'kestrix-coupon-guard' ),
	hold: __( 'You find the order under WooCommerce orders as “On hold”, with a note linking to its ring.', 'kestrix-coupon-guard' ),
	off: __( 'Nothing is refused or held. The order still joins its ring.', 'kestrix-coupon-guard' ),
};

const money = ( n: number ) => '$' + n.toFixed( 2 );

/** A slice of checkout showing what the returning shopper gets under the chosen mode. Example figures only. */
function Preview( { mode }: { mode: Mode } ) {
	const refused = mode === 'block';
	const subtotal = 78.5;
	const discount = refused ? 0 : 15.7; // WELCOME20 = 20% off.
	return (
		<Card className="flex flex-col gap-5 p-6">
			<div>
				<h2 className="text-[17px] font-bold leading-6">{ __( 'What the shopper sees', 'kestrix-coupon-guard' ) }</h2>
				<p className="mt-0.5 text-muted">{ __( 'A returning shopper tries WELCOME20 as a guest. Same on classic and block checkout.', 'kestrix-coupon-guard' ) }</p>
			</div>
			<div className="rounded-[10px] border border-line p-4">
				<div className="flex gap-2">
					<div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-[#C9D1CD] px-3 font-medium"><Tag size={ 14 } className="text-muted" />WELCOME20</div>
					<span className="flex h-10 items-center rounded-[10px] bg-info px-4 font-semibold text-muted">{ __( 'Apply', 'kestrix-coupon-guard' ) }</span>
				</div>
				<div aria-live="polite" className="mt-3">
					{ refused ? (
						<p className="flex items-start gap-2.5 rounded-[10px] bg-danger-soft p-3 font-medium text-danger"><Info size={ 16 } className="mt-0.5" />{ __( 'Sorry, this coupon is only for first-time customers.', 'kestrix-coupon-guard' ) }</p>
					) : (
						<p className="flex items-start gap-2.5 rounded-[10px] bg-success-soft p-3 font-medium text-success"><Check size={ 16 } className="mt-0.5" />{ __( 'Coupon code applied successfully.', 'kestrix-coupon-guard' ) }</p>
					) }
				</div>
				<dl className="m-0 mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-muted">
					<div className="flex justify-between"><dt>{ __( 'Subtotal', 'kestrix-coupon-guard' ) }</dt><dd className="m-0">{ money( subtotal ) }</dd></div>
					<div className="flex justify-between"><dt>{ __( 'Shipping', 'kestrix-coupon-guard' ) }</dt><dd className="m-0">{ money( 5 ) }</dd></div>
					<div className={ cn( 'flex justify-between', refused ? 'text-danger' : 'text-success' ) }>
						<dt>{ __( 'Coupon WELCOME20', 'kestrix-coupon-guard' ) }</dt>
						<dd className="m-0 font-semibold">{ refused ? __( 'Not applied', 'kestrix-coupon-guard' ) : '−' + money( discount ) }</dd>
					</div>
					<div className="mt-2 flex items-baseline justify-between border-t border-line pt-3 text-ink">
						<dt className="font-semibold">{ __( 'Total', 'kestrix-coupon-guard' ) }</dt>
						<dd className="m-0 text-[22px] font-bold tracking-[-0.02em]">{ money( subtotal + 5 - discount ) }</dd>
					</div>
				</dl>
			</div>
			<div className="border-t border-line pt-4">
				<h3 className="m-0 font-semibold">{ __( 'What you see', 'kestrix-coupon-guard' ) }</h3>
				<p className="mt-0.5 text-muted">{ AFTER[ mode ] }</p>
			</div>
		</Card>
	);
}

export function Settings( { saved, onSave }: { saved: SettingsData; onSave: ( s: SettingsData ) => Promise< unknown > } ) {
	const [ mode, setMode ] = useState< Mode >( toMode( saved ) );
	const [ busy, setBusy ] = useState( false );
	const locked = useRef( false );
	const [ msg, setMsg ] = useState< { ok: boolean; text: string } | null >( null );
	useEffect( () => setMode( toMode( saved ) ), [ saved ] );
	const dirty = mode !== toMode( saved );

	const save = async () => {
		if ( locked.current ) {
			return;
		}
		locked.current = true;
		setBusy( true );
		setMsg( null );
		try {
			await onSave( fromMode( mode ) );
			setMsg( { ok: true, text: __( 'Changes saved.', 'kestrix-coupon-guard' ) } );
		} catch ( e ) {
			setMsg( { ok: false, text: ( e as Error ).message || __( 'Could not save. Check your connection and try again.', 'kestrix-coupon-guard' ) } );
		}
		locked.current = false;
		setBusy( false );
	};

	let status: string = dirty ? __( 'You have unsaved changes.', 'kestrix-coupon-guard' ) : __( 'Changes apply to the next checkout.', 'kestrix-coupon-guard' );
	if ( msg && ( ! msg.ok || ! dirty ) ) {
		status = msg.text;
	}

	return (
		<div className="flex flex-wrap items-start gap-x-14 gap-y-8">
			<form className="flex min-w-0 flex-[999_1_480px] flex-col gap-6" onSubmit={ ( e ) => { e.preventDefault(); save(); } }>
				<fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
					<legend className="mb-1 p-0">
						<span className="block max-w-[640px] text-[26px] font-semibold leading-8 tracking-[-0.03em] md:text-[32px] md:leading-[38px]">{ __( 'When a returning shopper uses a welcome coupon', 'kestrix-coupon-guard' ) }</span>
						<span className="mt-2 block max-w-[560px] text-muted">
							{ __( 'Applies to coupons with “New customers only (Kestrix Coupon Guard)” ticked.', 'kestrix-coupon-guard' ) }{ ' ' }
							<a className="font-semibold text-primary hover:underline" href="edit.php?post_type=shop_coupon">{ __( 'Open coupons', 'kestrix-coupon-guard' ) }</a>
						</span>
					</legend>
					{ OPTIONS.map( ( o ) => {
						const on = mode === o.id;
						return (
							<label key={ o.id } className={ cn( 'flex cursor-pointer items-start gap-4 rounded-[14px] border bg-white p-5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2', on ? 'border-ink shadow-[inset_0_0_0_1px_#132120]' : 'border-line hover:border-[#9AA5A2]' ) }>
								<input type="radio" name="kestrix-coupon-guard-mode" className="sr-only" checked={ on } onChange={ () => { setMode( o.id ); setMsg( null ); } } />
								<span aria-hidden="true" className={ cn( 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px]', on ? 'border-ink bg-ink' : 'border-[#9AA5A2] bg-white' ) }>
									{ on && <span className="h-2 w-2 rounded-full bg-white" /> }
								</span>
								<span className="min-w-0 flex-1">
									<span className="flex flex-wrap items-baseline gap-x-2.5">
										<span className="text-[16px] font-bold tracking-[-0.01em]">{ o.title }</span>
										{ o.note && <span className="text-[13px] font-semibold text-primary">{ o.note }</span> }
									</span>
									<span className="mt-1 block max-w-[560px] text-muted">{ o.text }</span>
								</span>
							</label>
						);
					} ) }
				</fieldset>

				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
					<p role="status" className={ cn( 'text-[13px]', msg && ! msg.ok && 'text-danger', msg?.ok && ! dirty && 'text-success', ( ! msg || ( msg.ok && dirty ) ) && 'text-muted' ) }>{ status }</p>
					<div className="flex gap-2">
						<Button variant="secondary" disabled={ ! dirty || busy } onClick={ () => { setMode( toMode( saved ) ); setMsg( null ); } }>{ __( 'Discard', 'kestrix-coupon-guard' ) }</Button>
						<Button type="submit" disabled={ ! dirty || busy }>{ busy ? __( 'Saving…', 'kestrix-coupon-guard' ) : __( 'Save changes', 'kestrix-coupon-guard' ) }</Button>
					</div>
				</div>

				<p className="max-w-[560px] text-[13px] leading-[19px] text-muted">{ __( 'If a shopper leaves out a detail, nothing matches and checkout continues. Kestrix Coupon Guard never stops an order from being placed.', 'kestrix-coupon-guard' ) }</p>
			</form>
			<div className="min-w-0 flex-[1_1_340px]"><Preview mode={ mode } /></div>
		</div>
	);
}
