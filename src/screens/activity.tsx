import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	AtSign, BarChart3, Check, ChevronLeft, ChevronRight, Download, ExternalLink, FilterX, Home, Info, Lock, MapPin, Network,
	Phone, Search, ShieldAlert, ShieldCheck, ShieldOff, Ticket, X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input, Select } from '../components/ui/input';
import { Sheet } from '../components/ui/sheet';
import { Spinner } from '../components/ui/spinner';
import { allowRing, exportActivity, getActivity } from '../lib/api';
import { cn } from '../lib/utils';
import type { Activity as ActivityData, ActivityEvent, ActivityFilters, EventType, LinkType, OrderRef } from '../types';

const LIVE_MS = 30000;
const RANGES: [ ActivityFilters[ 'range' ], string ][] = [
	[ '24h', __( 'Last 24 hours', 'coupon-lock' ) ],
	[ '7d', __( '7 days', 'coupon-lock' ) ],
	[ '30d', __( '30 days', 'coupon-lock' ) ],
];
const LABEL: Record< EventType, string > = {
	blocked: __( 'Coupon Blocked', 'coupon-lock' ),
	clean: __( 'Clean Checkout', 'coupon-lock' ),
	ring: __( 'Ring Expanded', 'coupon-lock' ),
	held: __( 'Held for Review', 'coupon-lock' ),
	import: __( 'Historical Import', 'coupon-lock' ),
	rule: __( 'Rule Changed', 'coupon-lock' ),
};
const PILL: Record< EventType, string > = {
	blocked: 'bg-danger-soft text-danger',
	clean: 'bg-primary-soft text-primary',
	ring: 'bg-accent-soft text-accent-ink',
	held: 'bg-accent-soft text-accent-ink',
	import: 'bg-primary-tint text-primary',
	rule: 'bg-primary-tint text-primary',
};
const DOT: Record< EventType, string > = { blocked: 'bg-danger', clean: 'bg-primary', ring: 'bg-accent', held: 'bg-accent', import: 'bg-primary', rule: 'bg-primary' };
const LINK_LABEL: Record< LinkType, string > = { email: __( 'email', 'coupon-lock' ), phone: __( 'phone', 'coupon-lock' ), address: __( 'delivery address', 'coupon-lock' ) };
const LINK_ICON: Record< LinkType, typeof AtSign > = { email: AtSign, phone: Phone, address: Home };
const ALL_LINKS: LinkType[] = [ 'email', 'phone', 'address' ];

const list = ( items: string[] ) => items.join( ' & ' );
const orders = ( refs: OrderRef[] ) => refs.map( ( o ) => `#${ o.id }` ).join( ', ' );
const ringLabel = ( key: number ) => `R-${ key % 4000000000 }`;

export function ago( iso: string ): string {
	const secs = ( Date.now() - new Date( iso ).getTime() ) / 1000;
	const rtf = new Intl.RelativeTimeFormat( undefined, { numeric: 'auto' } );
	if ( secs < 60 ) {
		return __( 'Just now', 'coupon-lock' );
	}
	if ( secs < 3600 ) {
		return rtf.format( -Math.floor( secs / 60 ), 'minute' );
	}
	if ( secs < 86400 ) {
		return rtf.format( -Math.floor( secs / 3600 ), 'hour' );
	}
	return secs < 7 * 86400 ? rtf.format( -Math.floor( secs / 86400 ), 'day' ) : new Date( iso ).toLocaleDateString();
}

const clock = ( iso: string, utc = false ) => new Date( iso ).toLocaleTimeString( [], { hour12: false, timeZone: utc ? 'UTC' : undefined } );

/** Text shown in the table (trigger, outcome) for one event. */
export function describe( e: ActivityEvent ) {
	const n = e.linked.length;
	const via = list( e.matched.map( ( m ) => LINK_LABEL[ m ] ) );
	const found = n ? sprintf( __( 'Found in Order %s', 'coupon-lock' ), orders( e.linked ) ) : __( 'Earlier orders are no longer indexed', 'coupon-lock' );
	const saved = ( where: string ) => ( e.amount ? sprintf( __( 'Coupon applied (%1$s saved on %2$s)', 'coupon-lock' ), e.amount, where ) : sprintf( __( 'Coupon applied on %s', 'coupon-lock' ), where ) );
	const where = e.order ? `#${ e.order.id }` : '';
	switch ( e.type ) {
		case 'blocked':
			return {
				title: e.meta.why === 'ring' ? __( 'Shopper belongs to a blocked ring', 'coupon-lock' ) : sprintf( __( 'Matched %s', 'coupon-lock' ), via ),
				sub: found,
				outcome: __( 'Coupon declined politely, full price charged', 'coupon-lock' ),
				tone: 'text-danger',
			};
		case 'held':
			return {
				title: __( 'New-customers-only coupon used by a returning shopper', 'coupon-lock' ),
				sub: found,
				outcome: __( 'Order status set to “On hold”', 'coupon-lock' ),
				tone: 'text-accent-ink',
			};
		case 'ring':
			return {
				title: sprintf( __( 'Order %1$s linked by %2$s', 'coupon-lock' ), where, via ),
				sub: sprintf( _n( 'Linked to %d existing order', 'Linked to %d existing orders', n, 'coupon-lock' ), n ),
				outcome: __( 'Cluster updated automatically', 'coupon-lock' ),
				tone: 'text-muted',
			};
		case 'import':
			return {
				title: sprintf( __( 'Indexed %s past orders', 'coupon-lock' ), ( e.meta.orders ?? 0 ).toLocaleString() ),
				sub: __( 'Local privacy-preserving hash compilation', 'coupon-lock' ),
				outcome: __( 'Background task completed', 'coupon-lock' ),
				tone: 'text-muted',
			};
		case 'rule': {
			const a = e.meta.a ?? '';
			return {
				title: {
					blocked: __( 'Ring blocked from all coupons', 'coupon-lock' ),
					blocked_off: __( 'Ring unblocked', 'coupon-lock' ),
					allowed: __( 'Ring added to the allow list', 'coupon-lock' ),
					allowed_off: __( 'Ring removed from the allow list', 'coupon-lock' ),
				}[ a ] ?? __( 'Ring rule changed', 'coupon-lock' ),
				sub: sprintf( _n( 'Applies to %d linked order', 'Applies to %d linked orders', Math.max( n, 1 ), 'coupon-lock' ), Math.max( n, 1 ) ),
				outcome: __( 'Merchant rule saved', 'coupon-lock' ),
				tone: 'text-muted',
			};
		}
		default: {
			const why = e.meta.why;
			const t = {
				verified: [ __( 'First-time buyer verified', 'coupon-lock' ), __( 'No matching hash on email, phone, or address', 'coupon-lock' ) ],
				open: [ __( 'Coupon is not restricted to new customers', 'coupon-lock' ), __( 'Re-use permitted by the coupon’s own settings', 'coupon-lock' ) ],
				paused: [ __( 'Coupon Lock checks were paused', 'coupon-lock' ), __( 'Blocking and holding were off in Plugin Settings', 'coupon-lock' ) ],
				allowed: [ __( 'Ring is on the allow list', 'coupon-lock' ), found ],
				late: [ __( 'Matched after the coupon was accepted', 'coupon-lock' ), found ],
			}[ why ?? 'verified' ] ?? [ '', '' ];
			return { title: t[ 0 ], sub: t[ 1 ], outcome: why === 'open' ? __( 'Allowed per coupon rule settings', 'coupon-lock' ) : saved( where ), tone: why === 'late' ? 'text-accent-ink' : 'text-primary' };
		}
	}
}

function Pill( { type }: { type: EventType } ) {
	return (
		<span className={ cn( 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold', PILL[ type ] ) }>
			<span className={ cn( 'h-1.5 w-1.5 rounded-full', DOT[ type ] ) } />{ LABEL[ type ] }
		</span>
	);
}

function Stat( { label, value, unit, hint, icon: Icon, tone }: { label: string; value: number; unit: string; hint: React.ReactNode; icon: typeof AtSign; tone?: string } ) {
	return (
		<Card className="p-4">
			<div className="flex items-center justify-between text-muted"><span className="font-medium">{ label }</span><Icon size={ 18 } className={ tone ?? 'text-primary' } /></div>
			<div className="my-1 flex items-baseline gap-1.5">
				<span className={ cn( 'tabular text-[24px] font-semibold leading-8', tone ) }>{ value.toLocaleString() }</span>
				<span className={ cn( 'text-[11px] font-medium', tone ?? 'text-muted' ) }>{ unit }</span>
			</div>
			<div className={ cn( 'text-[11px] font-semibold', tone ?? 'text-primary' ) }>{ hint }</div>
		</Card>
	);
}

function Detail( { e, open, onOpen, onToggleAllow, onClose, busy }: { e: ActivityEvent; open: boolean; onOpen: ( key: number ) => void; onToggleAllow: () => void; onClose: () => void; busy: boolean } ) {
	const d = describe( e );
	const first = e.linked[ 0 ]?.date ? Math.max( 0, Math.round( ( Date.now() - new Date( e.linked[ 0 ].date as string ).getTime() ) / 864e5 ) ) : null;
	const placed = first === null ? '' : sprintf( _n( ', placed %d day ago', ', placed %d days ago', first, 'coupon-lock' ), first );
	const via = list( e.matched.map( ( m ) => LINK_LABEL[ m ] ) );
	const coupon = <strong>{ e.coupon }</strong>;
	const heading = {
		blocked: __( 'Why was this coupon declined?', 'coupon-lock' ),
		held: __( 'Why was this order held?', 'coupon-lock' ),
		clean: __( 'Why was this coupon accepted?', 'coupon-lock' ),
		ring: __( 'Why were these orders linked?', 'coupon-lock' ),
		import: __( 'What did this task do?', 'coupon-lock' ),
		rule: __( 'What changed?', 'coupon-lock' ),
	}[ e.type ];
	const linkedText = e.linked.length ? sprintf( __( 'Order %1$s%2$s', 'coupon-lock' ), orders( e.linked ), placed ) : __( 'an earlier order that is no longer indexed', 'coupon-lock' );
	let body: React.ReactNode;
	if ( e.type === 'blocked' ) {
		body = e.meta.why === 'ring' ? <>{ __( 'The shopper tried', 'coupon-lock' ) } { coupon }. { __( 'Their details belong to a ring you blocked from all coupons.', 'coupon-lock' ) }</> : <>{ __( 'The shopper used coupon', 'coupon-lock' ) } { coupon } { sprintf( __( 'while their %1$s matched details on %2$s. They can still check out at full price.', 'coupon-lock' ), via, linkedText ) }</>;
	} else if ( e.type === 'held' ) {
		body = <>{ __( 'The shopper used', 'coupon-lock' ) } { coupon } { sprintf( __( 'while their %1$s matched details on %2$s. The order is on hold for you to review.', 'coupon-lock' ), via, linkedText ) }</>;
	} else if ( e.type === 'clean' ) {
		body = <>{ coupon } { d.sub }. { e.matched.length > 0 && sprintf( __( 'Shared %s with earlier orders.', 'coupon-lock' ), via ) }</>;
	} else if ( e.type === 'ring' ) {
		body = sprintf( __( 'The new order shares %1$s with %2$s, so it joined that ring.', 'coupon-lock' ), via, linkedText );
	} else if ( e.type === 'import' ) {
		body = sprintf( __( 'Your past orders were hashed on this server and compared. %1$d rings exist across your store now.', 'coupon-lock' ), e.meta.rings ?? 0 );
	} else {
		body = d.title + '.';
	}
	const chips: React.ReactNode[] = e.matched.map( ( m ) => {
		const Icon = m === 'address' ? MapPin : LINK_ICON[ m ];
		return <span key={ m } className="inline-flex items-center gap-1.5 rounded-md bg-info px-2.5 py-1 text-[11px] font-semibold"><Icon size={ 13 } />{ sprintf( __( 'Hash match: %s (HMAC-SHA256)', 'coupon-lock' ), LINK_LABEL[ m ] ) }</span>;
	} );
	if ( e.matched.length ) {
		ALL_LINKS.filter( ( m ) => ! e.matched.includes( m ) ).forEach( ( m ) => chips.push( <span key={ 'x' + m } className="inline-flex items-center gap-1.5 rounded-md bg-info px-2.5 py-1 text-[11px] font-semibold"><Check size={ 13 } />{ sprintf( __( '%s: varied', 'coupon-lock' ), LINK_LABEL[ m ].replace( /^./, ( c ) => c.toUpperCase() ) ) }</span> ) );
	}
	if ( e.meta.why === 'ring' ) {
		chips.push( <span key="ring" className="inline-flex items-center gap-1.5 rounded-md bg-info px-2.5 py-1 text-[11px] font-semibold"><ShieldOff size={ 13 } />{ __( 'Ring blocked by merchant', 'coupon-lock' ) }</span> );
	}
	e.linked.forEach( ( o ) => chips.push( o.url
		? <a key={ o.id } href={ o.url } className="inline-flex items-center gap-1.5 rounded-md bg-info px-2.5 py-1 text-[11px] font-semibold text-primary hover:underline"><Ticket size={ 13 } />{ sprintf( __( 'Order #%d', 'coupon-lock' ), o.id ) }<ExternalLink size={ 11 } /></a>
		: <span key={ o.id } className="inline-flex items-center gap-1.5 rounded-md bg-info px-2.5 py-1 text-[11px] font-semibold"><Ticket size={ 13 } />{ sprintf( __( 'Order #%d', 'coupon-lock' ), o.id ) }</span> ) );
	const stamp = new Date( e.created );
	const header = <span className="flex flex-wrap items-center gap-2">{ sprintf( __( 'Event Audit Detail #EVT-%d', 'coupon-lock' ), e.id ) }<Pill type={ e.type } /></span>;
	const sub = sprintf( __( 'Recorded %1$s at %2$s UTC', 'coupon-lock' ), stamp.toLocaleDateString( undefined, { timeZone: 'UTC' } ), clock( e.created, true ) );
	const ring = e.ring;
	const footer = ring && (
		<>
			<Button variant="secondary" disabled={ busy } onClick={ onToggleAllow }>{ ring.allowed ? <X size={ 16 } /> : <Check size={ 16 } /> }{ ring.allowed ? __( 'Remove whitelist rule', 'coupon-lock' ) : __( 'Add whitelist rule', 'coupon-lock' ) }</Button>
			<Button onClick={ () => onOpen( ring.key ) }><Network size={ 16 } />{ sprintf( __( 'Open full Ring #%s', 'coupon-lock' ), ringLabel( ring.key ) ) }</Button>
		</>
	);
	return (
		<Sheet open={ open } onClose={ onClose } title={ header } description={ sub } footer={ footer }>
			<div className="flex flex-col gap-5">
				<div className="flex items-center gap-3">
					<span className={ cn( 'flex h-10 w-10 items-center justify-center rounded-lg', PILL[ e.type ] ) }>{ e.type === 'blocked' ? <ShieldAlert size={ 20 } /> : <ShieldCheck size={ 20 } /> }</span>
					<div><div className="font-semibold">{ d.title }</div><div className="text-[12px] text-muted">{ d.sub }</div></div>
				</div>
				<div className="rounded-xl bg-info p-5">
					<div className="flex gap-3">
						<Info size={ 18 } className="mt-0.5 shrink-0 text-primary" />
						<div><div className="text-[16px] font-semibold leading-6">{ heading }</div><p className="mt-1 text-[15px] leading-[22px]">{ body }</p></div>
					</div>
					<div className="mt-4 rounded-lg bg-white p-3"><div className="text-[11px] text-muted">{ __( 'Local Privacy Guarantee', 'coupon-lock' ) }</div><div className="flex items-center gap-1.5 font-semibold text-primary"><Lock size={ 14 } />{ __( 'Zero data sent off-server', 'coupon-lock' ) }</div></div>
				</div>
				<dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
					<div><dt className="text-muted">{ __( 'Coupon', 'coupon-lock' ) }</dt><dd className="font-mono font-medium">{ e.coupon ? e.coupon.toUpperCase() : '—' }</dd></div>
					<div><dt className="text-muted">{ __( 'Outcome', 'coupon-lock' ) }</dt><dd className={ cn( 'font-medium', d.tone ) }>{ d.outcome }</dd></div>
					{ e.ring && <div><dt className="text-muted">{ __( 'Ring', 'coupon-lock' ) }</dt><dd className="font-medium">{ sprintf( _n( '#%1$s (%2$d order)', '#%1$s (%2$d orders)', e.ring.size, 'coupon-lock' ), ringLabel( e.ring.key ), e.ring.size ) }{ e.ring.allowed && <span className="ml-1.5 text-primary">· { __( 'allowed', 'coupon-lock' ) }</span> }{ e.ring.blocked && <span className="ml-1.5 text-danger">· { __( 'blocked', 'coupon-lock' ) }</span> }</dd></div> }
					{ e.amount && <div><dt className="text-muted">{ __( 'Discount', 'coupon-lock' ) }</dt><dd className="font-medium">{ e.amount }</dd></div> }
				</dl>
				{ ( chips.length > 0 || e.type === 'import' ) && (
					<div>
						<div className="mb-2 text-[11px] text-muted">{ __( 'Attribute matches verified', 'coupon-lock' ) }</div>
						<div className="flex flex-wrap gap-2">
							{ chips }
							{ e.type === 'import' && <span className="rounded-md bg-info px-2.5 py-1 text-[11px] font-semibold">{ sprintf( __( 'Orders indexed: %d', 'coupon-lock' ), e.meta.orders ?? 0 ) }</span> }
						</div>
					</div>
				) }
			</div>
		</Sheet>
	);
}

export function Activity( { onOpen }: { onOpen: ( key: number ) => void } ) {
	const [ f, setF ] = useState< ActivityFilters >( { range: '24h', search: '', type: '', severity: '', page: 1, per_page: 25 } );
	const [ data, setData ] = useState< ActivityData | null >( null );
	const [ error, setError ] = useState( '' );
	const [ pick, setPick ] = useState< number | null >( null );
	const [ busy, setBusy ] = useState( false );
	const locked = useRef( false );
	const change = ( p: Partial< ActivityFilters > ) => setF( ( old ) => ( { ...old, page: 1, ...p } ) );

	const load = useCallback( () => getActivity( f ).then( ( r ) => { setData( r ); setError( '' ); } ).catch( ( e: Error ) => setError( e.message ) ), [ f ] );
	useEffect( () => {
		const t = setTimeout( load, f.search ? 250 : 0 ); // Debounce typing only.
		return () => clearTimeout( t );
	}, [ load, f.search ] );
	useEffect( () => {
		const id = setInterval( () => document.visibilityState === 'visible' && load(), LIVE_MS ); // Live feed.
		return () => clearInterval( id );
	}, [ load ] );

	const events = data?.events ?? [];
	const selected = events.find( ( e ) => e.id === pick ); // Undefined closes the sheet, also when a refresh drops the event.
	const shown = useRef< ActivityEvent | undefined >( undefined );
	if ( selected ) {
		shown.current = selected; // Keep the last event rendered so the sheet can slide out.
	}
	const filtering = f.search || f.type || f.severity;
	const s = data?.stats;
	const rate = s && s.evaluated ? Math.round( ( s.cleared / s.evaluated ) * 100 ) : 0;
	const rangeName = RANGES.find( ( r ) => r[ 0 ] === f.range )?.[ 1 ].toLowerCase() ?? '';

	const download = async () => {
		try {
			const r = await exportActivity( f );
			const a = document.createElement( 'a' );
			a.href = URL.createObjectURL( new Blob( [ r.csv ], { type: 'text/csv;charset=utf-8' } ) );
			a.download = r.filename;
			a.click();
			URL.revokeObjectURL( a.href );
		} catch ( e ) {
			setError( ( e as Error ).message );
		}
	};
	const toggleAllow = async () => {
		if ( ! selected?.ring || locked.current ) {
			return;
		}
		locked.current = true;
		setBusy( true );
		try {
			await allowRing( selected.ring.key, ! selected.ring.allowed );
			await load();
		} catch ( e ) {
			setError( ( e as Error ).message );
		}
		locked.current = false;
		setBusy( false );
	};

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="flex items-center gap-3 text-[24px] font-semibold leading-8">
						{ __( 'Coupon Lock Activity Log', 'coupon-lock' ) }
						<span className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-2.5 py-0.5 text-[11px] font-semibold text-primary"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />{ __( 'Audit Stream', 'coupon-lock' ) }</span>
					</h1>
					<p className="mt-0.5 text-[15px] text-muted">{ __( 'Audit stream of coupon checks, detected rings, and checkout decisions across your store.', 'coupon-lock' ) }</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="flex rounded-lg border border-line bg-white p-0.5" role="group" aria-label={ __( 'Time range', 'coupon-lock' ) }>
						{ RANGES.map( ( [ id, label ] ) => (
							<button key={ id } type="button" aria-pressed={ f.range === id } onClick={ () => change( { range: id } ) } className={ cn( 'rounded px-3 py-1.5 text-[13px] font-medium', f.range === id ? 'bg-primary-soft text-ink' : 'text-muted hover:text-ink' ) }>{ label }</button>
						) ) }
					</div>
					<Button variant="secondary" onClick={ download } disabled={ ! data?.total }><Download size={ 16 } />{ __( 'Export CSV log', 'coupon-lock' ) }</Button>
				</div>
			</div>

			{ error && <div role="alert" className="rounded-xl border border-danger-line bg-danger-soft p-4 text-danger">{ error }</div> }

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Stat label={ sprintf( __( 'Total events (%s)', 'coupon-lock' ), rangeName ) } value={ s?.total ?? 0 } unit={ __( 'all triggers', 'coupon-lock' ) } icon={ BarChart3 } hint={ <>● { __( 'Live feed active (refreshes every 30s)', 'coupon-lock' ) }</> } />
				<Stat label={ __( 'Coupons evaluated', 'coupon-lock' ) } value={ s?.evaluated ?? 0 } unit={ __( 'at checkout', 'coupon-lock' ) } icon={ Ticket } tone="text-muted" hint={ sprintf( _n( 'Across %d coupon code', 'Across %d coupon codes', s?.coupons ?? 0, 'coupon-lock' ), s?.coupons ?? 0 ) } />
				<Stat label={ __( 'Discounts blocked', 'coupon-lock' ) } value={ s?.blocked ?? 0 } unit={ __( 'repeat tries', 'coupon-lock' ) } icon={ ShieldAlert } tone="text-danger" hint={ s?.saved ? sprintf( __( 'Saved ~%s margin', 'coupon-lock' ), s.saved ) : __( 'Fixed-amount savings only', 'coupon-lock' ) } />
				<Stat label={ __( 'Auto-cleared legitimate', 'coupon-lock' ) } value={ s?.cleared ?? 0 } unit={ __( 'zero friction', 'coupon-lock' ) } icon={ ShieldCheck } hint={ sprintf( __( '%d%% instant approval', 'coupon-lock' ), rate ) } />
			</div>

			<Card className="flex flex-wrap items-center justify-between gap-3 p-4">
				<div className="flex min-w-[240px] flex-1 flex-wrap items-center gap-3">
					<div className="relative min-w-[240px] flex-1">
						<Search size={ 16 } className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
						<Input className="w-full pl-9" value={ f.search } onChange={ ( e ) => change( { search: e.target.value } ) } placeholder={ __( 'Filter by order # or coupon code…', 'coupon-lock' ) } aria-label={ __( 'Search events', 'coupon-lock' ) } />
					</div>
					<Select value={ f.type } onChange={ ( e ) => change( { type: e.target.value } ) } aria-label={ __( 'Event type', 'coupon-lock' ) }>
						<option value="">{ __( 'All event types', 'coupon-lock' ) }</option>
						<option value="blocked">{ __( 'Coupon Blocked', 'coupon-lock' ) }</option>
						<option value="clean">{ __( 'Clean Checkout', 'coupon-lock' ) }</option>
						<option value="ring">{ __( 'New ring detected / expanded', 'coupon-lock' ) }</option>
						<option value="held">{ __( 'Order flagged for review', 'coupon-lock' ) }</option>
						<option value="system">{ __( 'System & background tasks', 'coupon-lock' ) }</option>
					</Select>
					<Select value={ f.severity } onChange={ ( e ) => change( { severity: e.target.value } ) } aria-label={ __( 'Severity or outcome', 'coupon-lock' ) }>
						<option value="">{ __( 'Severity / Outcome', 'coupon-lock' ) }</option>
						<option value="blocked">{ __( 'Blocked', 'coupon-lock' ) }</option>
						<option value="flagged">{ __( 'Flagged', 'coupon-lock' ) }</option>
						<option value="allowed">{ __( 'Allowed', 'coupon-lock' ) }</option>
						<option value="system">{ __( 'System', 'coupon-lock' ) }</option>
					</Select>
				</div>
				<div className="flex items-center gap-3">
					<Button variant="ghost" onClick={ () => change( { search: '', type: '', severity: '' } ) } disabled={ ! filtering }><FilterX size={ 16 } />{ __( 'Clear filters', 'coupon-lock' ) }</Button>
					<span className="tabular border-l border-line pl-3 text-[11px] font-semibold text-muted">{ sprintf( __( 'Showing %1$d of %2$d items', 'coupon-lock' ), events.length, data?.total ?? 0 ) }</span>
				</div>
			</Card>

			<Card className="overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-left">
						<thead>
							<tr className="bg-info text-[11px] font-semibold uppercase tracking-wider text-muted">
								{ [ __( 'Timestamp', 'coupon-lock' ), __( 'Event Type', 'coupon-lock' ), __( 'Coupon', 'coupon-lock' ), __( 'Trigger & Linked Evidence', 'coupon-lock' ), __( 'Ring Association', 'coupon-lock' ), __( 'Checkout Outcome', 'coupon-lock' ), __( 'Action', 'coupon-lock' ) ].map( ( h, i ) => (
									<th key={ h } className={ cn( 'px-4 py-3', i === 6 && 'text-right' ) }>{ h }</th>
								) ) }
							</tr>
						</thead>
						<tbody>
							{ data === null && ! error && <tr><td colSpan={ 7 }><Spinner /></td></tr> }
							{ data !== null && events.length === 0 && (
								<tr><td colSpan={ 7 } className="px-5 py-10 text-center text-muted">{ filtering ? __( 'No events match these filters.', 'coupon-lock' ) : __( 'No activity in this period yet. Events appear when shoppers use coupons, rings form, or you import orders.', 'coupon-lock' ) }</td></tr>
							) }
							{ events.map( ( e ) => {
								const d = describe( e );
								const on = e.id === selected?.id;
								const order = e.type === 'clean' || e.type === 'held' ? e.order : null;
								return (
									<tr key={ e.id } onClick={ () => setPick( e.id ) } className={ cn( 'cursor-pointer border-t border-line hover:bg-primary-soft', on && 'bg-info' ) }>
										<td className="whitespace-nowrap px-4 py-3"><div className="font-medium">{ ago( e.created ) }</div><div className="text-[11px] text-muted">{ clock( e.created ) }</div></td>
										<td className="px-4 py-3"><Pill type={ e.type } /></td>
										<td className="whitespace-nowrap px-4 py-3">{ e.coupon ? <span className="rounded bg-info px-2 py-0.5 font-mono font-medium">{ e.coupon.toUpperCase() }</span> : <span className="text-muted">—</span> }</td>
										<td className="min-w-[240px] px-4 py-3"><div className="font-medium">{ d.title }</div><div className="text-[11px] text-muted">{ d.sub }</div></td>
										<td className="whitespace-nowrap px-4 py-3">
											{ e.ring
												? <button type="button" onClick={ ( ev ) => { ev.stopPropagation(); onOpen( ( e.ring as { key: number } ).key ); } } className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><Network size={ 14 } />{ sprintf( __( 'Ring #%s', 'coupon-lock' ), ringLabel( e.ring.key ) ) } <span className="font-normal text-muted">({ sprintf( _n( '%d order', '%d orders', e.ring.size, 'coupon-lock' ), e.ring.size ) })</span></button>
												: e.type === 'import' ? <span className="font-medium">{ sprintf( _n( '%d ring found', '%d rings found', e.meta.rings ?? 0, 'coupon-lock' ), e.meta.rings ?? 0 ) }</span> : <span className="text-muted">—</span> }
										</td>
										<td className={ cn( 'min-w-[200px] px-4 py-3 font-medium', d.tone ) }>{ d.outcome }</td>
										<td className="whitespace-nowrap px-4 py-3 text-right" onClick={ ( ev ) => ev.stopPropagation() }>
											{ order?.url
												? <a href={ order.url } className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-primary">{ e.type === 'held' ? sprintf( __( 'Review order #%d', 'coupon-lock' ), order.id ) : sprintf( __( 'View order #%d', 'coupon-lock' ), order.id ) }<ExternalLink size={ 13 } /></a>
												: e.type === 'ring' && e.ring
													? <button type="button" className="text-[12px] font-semibold text-primary hover:underline" onClick={ () => onOpen( ( e.ring as { key: number } ).key ) }>{ __( 'Inspect ring', 'coupon-lock' ) }</button>
													: <button type="button" onClick={ () => setPick( e.id ) } className={ cn( 'rounded px-2.5 py-1 text-[12px] font-semibold', on ? 'bg-primary text-white' : 'text-muted hover:text-ink' ) }>{ __( 'View details', 'coupon-lock' ) }</button> }
										</td>
									</tr>
								);
							} ) }
						</tbody>
					</table>
				</div>
				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4 text-muted">
					<label className="flex items-center gap-2">{ __( 'Rows per page:', 'coupon-lock' ) }
						<Select value={ f.per_page } onChange={ ( e ) => change( { per_page: Number( e.target.value ) } ) }>{ [ 10, 25, 50, 100 ].map( ( n ) => <option key={ n } value={ n }>{ n }</option> ) }</Select>
					</label>
					<div className="flex items-center gap-1">
						<Button variant="ghost" disabled={ f.page <= 1 } onClick={ () => setF( ( o ) => ( { ...o, page: o.page - 1 } ) ) } aria-label={ __( 'Previous page', 'coupon-lock' ) }><ChevronLeft size={ 16 } /></Button>
						<span className="tabular px-2 text-ink">{ sprintf( __( 'Page %1$d of %2$d', 'coupon-lock' ), f.page, Math.max( 1, data?.total_pages ?? 1 ) ) }</span>
						<Button variant="ghost" disabled={ f.page >= ( data?.total_pages ?? 1 ) } onClick={ () => setF( ( o ) => ( { ...o, page: o.page + 1 } ) ) } aria-label={ __( 'Next page', 'coupon-lock' ) }><ChevronRight size={ 16 } /></Button>
					</div>
				</div>
			</Card>

			{ shown.current && <Detail e={ shown.current } open={ !! selected } onOpen={ onOpen } onToggleAllow={ toggleAllow } onClose={ () => setPick( null ) } busy={ busy } /> }
		</div>
	);
}
