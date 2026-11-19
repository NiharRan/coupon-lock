import { useEffect, useRef, useState } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowLeft, AtSign, Ban, BadgeCheck, Download, ExternalLink, Home, Info, Lock, Network, Phone, Shield, X } from 'lucide-react';
import { blockRing, getRing } from '../lib/api';
import { Spinner } from '../components/ui/spinner';
import type { ReactElement } from 'react';
import type { LinkType, RingDetail as Ring } from '../types';
import { ConnectionMap } from './connection-map';

const PATTERN: Record< LinkType, { icon: typeof AtSign; title: string; text: string; icon_bg: string; count: string } > = {
	address: { icon: Home, title: __( 'Same address', 'coupon-lock' ), text: __( 'Normalized shipping address (street and postcode) reused', 'coupon-lock' ), icon_bg: 'bg-accent-soft text-[#B45309]', count: 'text-[#B45309] font-bold' },
	phone: { icon: Phone, title: __( 'Same phone number', 'coupon-lock' ), text: __( 'Billing phone (last 10 digits) reused', 'coupon-lock' ), icon_bg: 'bg-primary-tint text-primary', count: 'text-primary font-medium' },
	email: { icon: AtSign, title: __( 'Same email alias', 'coupon-lock' ), text: __( 'Email reused after removing Gmail dots and +tags', 'coupon-lock' ), icon_bg: 'bg-primary-tint text-primary', count: 'text-primary font-medium' },
};

const card = 'flex flex-col rounded-xl bg-white p-5 shadow-sm';
const label = 'text-[13px] font-medium leading-4';
const small = 'text-[11px] font-semibold leading-[14px] tracking-[0.02em]';

function download( ring: Ring ) {
	const q = ( v: string ) => `"${ v.replace( /"/g, '""' ) }"`;
	const lines = [ 'order,date,status,total,coupons', ...ring.orders.map( ( o ) => [ o.id, o.date ?? '', q( o.status ), q( o.total ), q( o.coupons.join( ' ' ) ) ].join( ',' ) ) ];
	const a = document.createElement( 'a' );
	a.href = URL.createObjectURL( new Blob( [ lines.join( '\n' ) ], { type: 'text/csv' } ) );
	a.download = `ts-coupon-lock-ring-${ ring.orders[ 0 ]?.id ?? 'report' }.csv`;
	a.click();
	URL.revokeObjectURL( a.href );
}

export function RingDetail( { orderId, onBack }: { orderId: number; onBack: () => void } ) {
	const [ ring, setRing ] = useState< Ring | null >( null );
	const [ error, setError ] = useState( '' );
	const [ hideBanner, setHideBanner ] = useState( false );
	const [ busy, setBusy ] = useState( false );
	const locked = useRef( false ); // State updates lag a double click; a ref blocks the second call at once.
	useEffect( () => {
		getRing( orderId ).then( setRing ).catch( ( e: Error ) => setError( e.message ) );
	}, [ orderId ] );

	const toggleBlock = async () => {
		if ( ! ring || locked.current ) {
			return;
		}
		locked.current = true;
		setBusy( true );
		try {
			const r = await blockRing( orderId, ! ring.blocked );
			setRing( { ...ring, blocked: r.blocked, allowed: r.blocked ? false : ring.allowed } );
		} catch ( e ) {
			setError( ( e as Error ).message );
		}
		locked.current = false;
		setBusy( false );
	};

	const back = (
		<button type="button" onClick={ onBack } className={ `${ label } inline-flex items-center gap-1 text-primary hover:underline` }>
			<ArrowLeft size={ 16 } />{ __( 'Back to all rings', 'coupon-lock' ) }
		</button>
	);
	if ( error ) {
		return <div>{ back }<div role="alert" className="mt-3 rounded-xl border border-danger-line bg-danger-soft p-4 text-danger">{ error }</div></div>;
	}
	if ( ! ring ) {
		return <div>{ back }<div className={ `${ card } mt-3` }><Spinner /></div></div>;
	}

	const date = ( iso: string | null ) => ( iso ? new Date( iso ).toLocaleDateString( undefined, { month: 'short', day: 'numeric', year: 'numeric' } ) : '—' );
	const pill = `inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 ${ small }`;
	return (
		<div className="flex flex-col text-ink">
			<div className="mb-3 flex items-center justify-between">
				{ back }
				<span className={ `flex items-center gap-1 text-muted ${ small }` }>
					<span className="h-2 w-2 rounded-full bg-accent" />
					{ __( 'Cluster ID:', 'coupon-lock' ) } <span className="font-mono font-semibold text-ink">#{ ring.cluster }</span>
				</span>
			</div>

			<div className="mb-7 flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-col gap-1">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="text-[24px] font-semibold leading-8">{ sprintf( _n( 'Ring of %d order', 'Ring of %d orders', ring.size, 'coupon-lock' ), ring.size ) }</h1>
						{ ring.attempts > 0 && <span className={ `${ pill } bg-danger-soft text-danger` }><Ban size={ 13 } />{ sprintf( __( 'Coupons blocked: %d', 'coupon-lock' ), ring.attempts ) }</span> }
						<span className={ `${ pill } bg-primary-tint` }>{ ring.links.length > 1 ? __( 'High confidence', 'coupon-lock' ) : __( 'Medium confidence', 'coupon-lock' ) }</span>
						{ ring.sample && <span className={ `${ pill } bg-primary-tint` }>{ __( 'Sample', 'coupon-lock' ) }</span> }
					</div>
					<p className="text-[14px] leading-5 text-muted">
						{ sprintf( __( 'First detected %1$s • Total customer spend: %2$s across %3$d linked customers', 'coupon-lock' ), date( ring.first ), ring.total, ring.personas ) }
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<button type="button" onClick={ () => download( ring ) } className={ `${ label } inline-flex items-center gap-1 rounded-lg bg-white px-3.5 py-2 shadow-sm hover:bg-info` }>
						<Download size={ 18 } />{ __( 'Export ring report', 'coupon-lock' ) }
					</button>
					<button type="button" onClick={ toggleBlock } disabled={ busy } className={ `${ label } inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-white shadow-sm hover:bg-primary disabled:opacity-60` }>
						<Shield size={ 18 } />{ ring.blocked ? __( 'Unblock this ring', 'coupon-lock' ) : __( 'Block all from coupons', 'coupon-lock' ) }
					</button>
				</div>
			</div>

			{ ring.allowed && <div role="status" className="mb-5 rounded-xl bg-primary-soft p-3 text-primary">{ __( 'This ring is on your allow list: its shoppers are never blocked or held. Remove the rule from the Activity Log.', 'coupon-lock' ) }</div> }
			{ ring.blocked && <div role="status" className="mb-5 rounded-xl bg-danger-soft p-3 text-danger">{ __( 'This ring is blocked: shoppers matching any of its details cannot use any coupon.', 'coupon-lock' ) }</div> }
			{ ring.attempts > 0 && ! hideBanner && (
				<div className="mb-5 flex items-start gap-3 rounded-xl bg-info p-3 shadow-sm">
					<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary"><BadgeCheck size={ 18 } /></span>
					<div className="min-w-0 flex-1">
						<div className="text-[16px] font-semibold leading-6">{ ring.prevented ? sprintf( __( 'Coupon Lock automated shield has prevented %s in repeated discounts', 'coupon-lock' ), ring.prevented ) : __( 'Coupon Lock automated shield has blocked repeated welcome discounts', 'coupon-lock' ) }</div>
						<p className="mt-0.5 text-[13px] leading-[18px] text-muted">{ sprintf( _n( '%d coupon attempt from this ring was blocked at checkout. No legitimate orders were interrupted.', '%d coupon attempts from this ring were blocked at checkout. No legitimate orders were interrupted.', ring.attempts, 'coupon-lock' ), ring.attempts ) }</p>
					</div>
					<button type="button" className="text-muted hover:text-ink" onClick={ () => setHideBanner( true ) } aria-label={ __( 'Dismiss', 'coupon-lock' ) }><X size={ 18 } /></button>
				</div>
			) }

			<div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
				<div className={ `${ card } lg:col-span-8` }>
					<ConnectionMap ring={ ring } onRefresh={ () => getRing( orderId ).then( setRing ).catch( ( e: Error ) => setError( e.message ) ) } />
					<div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-semibold text-muted">
						<span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-primary-tint" />{ __( 'Orders', 'coupon-lock' ) }</span>
						<span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-primary-tint" />{ __( 'Shared email / mobile', 'coupon-lock' ) }</span>
						<span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-accent" />{ __( 'Most connected identifier', 'coupon-lock' ) }</span>
						<span className="flex items-center gap-1"><Lock size={ 15 } className="text-primary" />{ __( 'Details are stored as one-way cryptographic hashes. Customer privacy is preserved.', 'coupon-lock' ) }</span>
					</div>
				</div>

				<div className="flex flex-col gap-5 lg:col-span-4">
					<div className={ card }>
						<div className="mb-3 flex items-center justify-between">
							<h2 className="text-[16px] font-semibold leading-6">{ __( 'Shared details', 'coupon-lock' ) }</h2>
							<span className={ `${ small } text-muted` }>{ sprintf( _n( '%d pattern', '%d patterns', ring.hubs.length, 'coupon-lock' ), ring.hubs.length ) }</span>
						</div>
						<div className="flex flex-col gap-2">
							{ ring.hubs.map( ( h ) => {
								const p = PATTERN[ h.type as LinkType ] ?? { icon: Network, title: h.label ?? h.type, text: __( 'Shared by these orders.', 'coupon-lock' ), icon_bg: 'bg-primary-tint text-primary', count: 'text-muted' };
								return (
									<div key={ h.id } className="flex items-start gap-2 rounded-lg bg-info p-2">
										<span className={ `mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ p.icon_bg }` }><p.icon size={ 16 } /></span>
										<div className="min-w-0 flex-1">
											<div className="flex items-center justify-between"><span className={ `${ label } font-semibold` }>{ p.title }</span><span className={ `${ small } ${ p.count }` }>{ h.count === ring.size && h.type === 'address' ? __( '100% match', 'coupon-lock' ) : sprintf( __( '%1$d of %2$d orders', 'coupon-lock' ), h.count, ring.size ) }</span></div>
											<p className="mt-0.5 text-[13px] leading-[18px] text-muted">{ p.text }</p>
										</div>
									</div>
								);
							} ) }
						</div>
						<div className={ `mt-3 flex items-center gap-1 rounded-lg bg-canvas p-2 text-muted ${ small }` }>
							<Info size={ 16 } className="shrink-0 text-primary" />{ __( 'Plain English insights derived without exposing personal data.', 'coupon-lock' ) }
						</div>
					</div>

					<div className={ card }>
						<div className="mb-3 flex items-center justify-between">
							<div className="flex items-center gap-1">
								<h2 className="text-[16px] font-semibold leading-6">{ __( 'Orders in this ring', 'coupon-lock' ) }</h2>
								<span className={ `rounded-full bg-primary-tint px-2 py-0.5 ${ small }` }>{ ring.size }</span>
							</div>
							<span className={ `${ small } text-muted` }>{ __( 'Newest first', 'coupon-lock' ) }</span>
						</div>
						<div className="flex flex-col gap-2">
							{ ring.orders.map( ( o ) => (
								<div key={ o.edge_id } className="rounded-lg bg-info p-2 hover:bg-primary-tint/60">
									<div className="flex items-center justify-between gap-2">
										<span className={ `${ label } tabular font-semibold` }>#{ o.id } • { o.total }</span>
										<span className="flex gap-1">
											{ o.coupons.map( ( c ) => <span key={ c } className={ `rounded bg-primary-tint px-2 py-0.5 uppercase ${ small }` }>{ c }</span> ) }
											{ ! o.coupons.length && <span className={ `rounded bg-primary-tint px-2 py-0.5 ${ small }` }>{ __( 'No coupon', 'coupon-lock' ) }</span> }
										</span>
									</div>
									<div className="mt-1 flex items-center justify-between text-[13px] leading-[18px] text-muted">
										<span>{ date( o.date ) }{ o.status && ` • ${ o.status }` }</span>
										{ o.url && <a className={ `${ small } inline-flex items-center gap-1 text-primary hover:underline` } href={ o.url }>{ __( 'View in WooCommerce', 'coupon-lock' ) }<ExternalLink size={ 14 } /></a> }
									</div>
								</div>
							) ) }
						</div>
					</div>
				</div>
			</div>
			{ ( applyFilters( 'couponLock.ringWidgets', [] ) as Array< ( ctx: { orderId: number } ) => ReactElement > ).map( ( Widget, i ) => <Widget key={ i } orderId={ orderId } /> ) }
		</div>
	);
}
