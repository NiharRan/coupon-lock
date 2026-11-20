import { createInterpolateElement, useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { motion } from 'motion/react';
import { AlertTriangle, ArrowRight, CheckCircle2, FlaskConical, Lock, RefreshCw, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Spinner } from '../components/ui/spinner';
import { Badge } from '../components/ui/badge';
import { SearchInput, Select } from '../components/ui/input';
import { getActivity } from '../lib/api';
import { cn } from '../lib/utils';
import { ago, describe } from './activity';
import type { Activity, Filters, LinkType, Overview as OverviewData } from '../types';

const LINK_LABEL: Record< LinkType, string > = {
	email: __( 'Email', 'coupon-lock' ),
	phone: __( 'Phone', 'coupon-lock' ),
	address: __( 'Address', 'coupon-lock' ),
};
const LINK_FILTER: [ Filters[ 'link' ], string ][] = [
	[ '', __( 'All rings', 'coupon-lock' ) ],
	[ 'email', __( 'Same email', 'coupon-lock' ) ],
	[ 'phone', __( 'Same phone', 'coupon-lock' ) ],
	[ 'address', __( 'Same address', 'coupon-lock' ) ],
];
const SHOWN = 3; // Order links per row before "and N more".

export const MONO = 'font-mono uppercase tracking-[0.06em]';

/** Twin-dot motif: solid ink beside signal orange. */
export function TwinDot( { className }: { className?: string } ) {
	return (
		<span className={ cn( 'inline-flex shrink-0 items-center gap-[3px]', className ) } aria-hidden="true">
			<span className="h-1.5 w-1.5 rounded-full bg-[#111]" />
			<span className="h-1.5 w-1.5 rounded-full bg-[#FF5A1F]" />
		</span>
	);
}

export function SectionLabel( { children }: { children: React.ReactNode } ) {
	return <div className={ cn( MONO, 'flex items-center gap-2 text-[12px] font-semibold text-[#111]' ) }><TwinDot />{ children }</div>;
}

/** Scroll reveal: fade plus 12px rise. MotionConfig in app.tsx drops the motion for prefers-reduced-motion. */
function Reveal( { children, className }: { children: React.ReactNode; className?: string } ) {
	return (
		<motion.div className={ className } initial={ { opacity: 0, y: 12 } } whileInView={ { opacity: 1, y: 0 } } viewport={ { once: true, margin: '0px 0px -40px 0px' } } transition={ { duration: 0.25, ease: 'easeOut' } }>
			{ children }
		</motion.div>
	);
}

/** Arrow glyph for links and rows: turns orange and slides right when the parent `group` is hovered. */
function Arrow() {
	return <ArrowRight size={ 14 } className="transition-[transform,color] duration-200 group-hover:translate-x-1 group-hover:text-[#FF5A1F] group-focus-visible:translate-x-1 group-focus-visible:text-[#FF5A1F]" />;
}

/** Ring size to a level: a word plus badge and glyph style, so it never relies on colour alone. */
function level( size: number ): { label: string; badge: string; glyph: React.ReactNode } {
	if ( size >= 5 ) {
		return {
			label: __( 'High', 'coupon-lock' ),
			badge: 'bg-[#FFE7DD] text-[#FF5A1F]',
			glyph: <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-[#FF5A1F]"><span className="h-2 w-2 rounded-full bg-[#FF5A1F]" /></span>,
		};
	}
	if ( size === 4 ) {
		return {
			label: __( 'Elevated', 'coupon-lock' ),
			badge: 'bg-[#E5E5E0] text-[#444]',
			glyph: <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#111]"><span className="h-1.5 w-1.5 rounded-full bg-[#111]" /></span>,
		};
	}
	return {
		label: size === 3 ? __( 'Watch', 'coupon-lock' ) : __( 'Low', 'coupon-lock' ),
		badge: 'bg-[#F0F0EC] text-[#706F6A]',
		glyph: <span className="h-2.5 w-2.5 rounded-full bg-[#706F6A]" />,
	};
}

function lastOrder( iso: string ): string {
	const days = Math.round( ( new Date( iso ).getTime() - Date.now() ) / 864e5 );
	return days > -7 ? new Intl.RelativeTimeFormat( undefined, { numeric: 'auto' } ).format( days, 'day' ) : new Date( iso ).toLocaleDateString();
}

export interface TableProps {
	data: OverviewData;
	filters: Filters;
	setFilters: ( f: Partial< Filters > ) => void;
	setPage: ( p: number ) => void;
	onOpen: ( key: number ) => void;
}

export function RingsTable( { data, filters, setFilters, setPage, onOpen }: TableProps ) {
	const { rings, total, total_pages: pages } = data;
	return (
		<section className="flex min-w-0 flex-col gap-5" aria-labelledby="ts-coupon-lock-rings">
<div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#E5E5E0] pb-4">
<div>
<h2 id="ts-coupon-lock-rings" className="m-0"><SectionLabel>{ __( '01 / Linked rings', 'coupon-lock' ) }</SectionLabel></h2>
<p className="mt-1.5 text-[13px] text-[#706F6A]">{ __( 'Orders that share an email, phone or delivery address.', 'coupon-lock' ) }</p>
</div>
				<SearchInput className="w-full max-w-[280px]"
						placeholder={ __( 'Find an order or email', 'coupon-lock' ) }
						value={ filters.search }
						onChange={ ( e ) => setFilters( { search: e.target.value } ) }
						aria-label={ __( 'Search rings', 'coupon-lock' ) }
					/>
			</div>

			<div className="flex flex-wrap items-center gap-1.5">
				{ LINK_FILTER.map( ( [ id, label ] ) => (
					<button
						key={ id }
						type="button"
						aria-pressed={ filters.link === id }
						onClick={ () => setFilters( { link: id } ) }
						className={ cn( 'h-9 rounded border px-3 font-mono text-[11px] uppercase tracking-[0.06em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] focus-visible:ring-offset-2', filters.link === id ? 'border-[#111] bg-[#111] text-white' : 'border-[#E5E5E0] bg-white text-[#111] hover:border-[#111]' ) }
					>
						{ label }
					</button>
				) ) }
				<Select className="ml-auto" value={ filters.min_size } onChange={ ( e ) => setFilters( { min_size: Number( e.target.value ) } ) } aria-label={ __( 'Ring size', 'coupon-lock' ) }>
					<option value={ 2 }>{ __( 'Any size', 'coupon-lock' ) }</option>
					<option value={ 3 }>{ __( '3 or more orders', 'coupon-lock' ) }</option>
					<option value={ 4 }>{ __( '4 or more orders', 'coupon-lock' ) }</option>
					<option value={ 5 }>{ __( '5 or more orders', 'coupon-lock' ) }</option>
				</Select>
			</div>

			<div className="border border-[#E5E5E0] bg-white">
				{ rings.length === 0 && (
					<div className="px-5 py-10 text-center text-muted">
						<p>{ __( 'No rings match these filters.', 'coupon-lock' ) }</p>
						<Button variant="secondary" className="mt-3" onClick={ () => setFilters( { search: '', min_size: 2, link: '' } ) }>{ __( 'Clear filters', 'coupon-lock' ) }</Button>
					</div>
				) }
				<ul className="m-0 list-none p-0">
					{ rings.map( ( ring ) => {
						const lv = level( ring.size );
						const more = ring.orders.length - SHOWN;
						return (
							<li key={ ring.orders.map( ( o ) => o.id ).join( '-' ) } className="group m-0 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#E5E5E0] px-5 py-5 last:border-b-0 hover:bg-[#F4F4F1]">
<span className="flex h-10 w-10 shrink-0 items-center justify-center">{ lv.glyph }</span>
								<div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
									<div className="flex flex-wrap items-baseline gap-x-2.5">
										<button type="button" onClick={ () => onOpen( ring.key ) } className="text-left text-[16px] font-medium tracking-[-0.01em] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]">
											{ sprintf( _n( '%d order, one shopper', '%d orders, one shopper', ring.size, 'coupon-lock' ), ring.size ) }
										</button>
										<span className={ cn( MONO, 'rounded px-1.5 py-0.5 text-[10px] font-semibold', lv.badge ) }>{ lv.label }</span>
										{ ring.sample && <Badge tone="info">{ __( 'Sample', 'coupon-lock' ) }</Badge> }
									</div>
									<div className="font-mono text-[12px] text-[#706F6A]">
{ ring.orders.slice( 0, SHOWN ).map( ( o, n ) => (
											<span key={ o.id }>
												{ n > 0 && ', ' }
												{ o.url ? <a className="font-medium text-[#111] hover:text-[#FF5A1F]" href={ o.url }>#{ o.id }</a> : <span>#{ o.id }</span> }
											</span>
										) ) }
										{ more > 0 && ' ' + sprintf( __( 'and %d more', 'coupon-lock' ), more ) }
									</div>
								</div>
								<div className="flex flex-[0_1_220px] flex-wrap items-center gap-1.5">
<span className={ cn( MONO, 'text-[10px] text-[#9A9A93]' ) }>{ __( 'Matched on', 'coupon-lock' ) }</span>
{ ring.links.map( ( l ) => <span key={ l } className="rounded border border-[#E5E5E0] bg-[#F9F9F6] px-1.5 py-0.5 font-mono text-[10px] text-[#1C1C1B]">{ LINK_LABEL[ l ] }</span> ) }
								</div>
								<div className="flex flex-[0_0_110px] flex-col text-right">
									<span className="font-mono text-[13px] font-semibold">{ ring.total }</span>
<span className="font-mono text-[11px] text-[#706F6A]">{ ring.last_order ? lastOrder( ring.last_order ) : '—' }</span>
								</div>
								<Button variant="ghost" className="w-10 px-0" onClick={ () => onOpen( ring.key ) } aria-label={ __( 'Open ring map', 'coupon-lock' ) }><Arrow /></Button>
							</li>
						);
					} ) }
				</ul>
				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E5E0] px-5 py-3.5 font-mono text-[12px] text-[#706F6A]">
					<span>{ sprintf( __( '%1$d of %2$d rings', 'coupon-lock' ), rings.length, total ) }</span>
					{ pages > 1 && (
						<div className="flex items-center gap-2">
							<Button variant="secondary" disabled={ filters.page <= 1 } onClick={ () => setPage( filters.page - 1 ) }>{ __( 'Previous', 'coupon-lock' ) }</Button>
							<span className="px-1">{ filters.page } / { pages }</span>
							<Button variant="secondary" disabled={ filters.page >= pages } onClick={ () => setPage( filters.page + 1 ) }>{ __( 'Next', 'coupon-lock' ) }</Button>
						</div>
					) }
				</div>
</div>
</section>
	);
}

function ProgressBar( { value }: { value: number } ) {
	const pct = Math.round( value * 100 );
	return (
		<div className="w-full max-w-md" role="progressbar" aria-valuemin={ 0 } aria-valuemax={ 100 } aria-valuenow={ pct } aria-label={ __( 'Scan progress', 'coupon-lock' ) }>
			<div className="h-px overflow-hidden bg-[#E5E5E0]">
				<motion.div className="h-full bg-[#FF5A1F]"initial={ false } animate={ { width: `${ pct }%` } } transition={ { type: 'tween', ease: 'easeOut', duration: 0.5 } } />
			</div>
			<div className="mt-2 text-[13px] text-muted">{ sprintf( __( 'Scanning orders… %d%%', 'coupon-lock' ), pct ) }</div>
		</div>
	);
}

const HERO = 'm-0 max-w-[900px] text-[32px] font-medium leading-[38px] tracking-[-0.03em] md:text-[48px] md:leading-[54px]';

function Step( { n, active, title, children }: { n: number; active?: boolean; title: string; children: React.ReactNode } ) {
	return (
		<li className="m-0 flex gap-5 border-b border-[#E5E5E0] py-[22px]">
			<span className={ cn( MONO, 'w-8 shrink-0 pt-1 text-[12px] font-semibold', active ? 'text-[#FF5A1F]' : 'text-[#9A9A93]' ) }>{ String( n ).padStart( 2, '0' ) }</span>
			<div className="min-w-0 flex-1">
				<h2 className="text-[17px] font-medium leading-6">{ title }</h2>
				{ children }
			</div>
		</li>
	);
}

function FirstRun( { onImport, onSample, onSettings, importing, progress }: { onImport: () => void; onSample: ( on: boolean ) => void; onSettings: () => void; importing: boolean; progress: number } ) {
	return (
		<div className="flex flex-wrap items-start gap-x-14 gap-y-8">
			<section className="flex min-w-0 flex-[999_1_520px] flex-col gap-9">
				<div className="flex flex-col gap-3.5">
					<h1 className={ HERO }>{ __( 'Find the shopper who keeps coming back as someone new.', 'coupon-lock' ) }</h1>
					<p className="max-w-[560px] text-[16px] leading-[25px] text-muted">{ __( 'Coupon Lock links orders that share an email, phone or delivery address, then refuses your welcome coupon to anyone who already had it.', 'coupon-lock' ) }</p>
				</div>
				<ol className="m-0 list-none border-t border-line p-0">
					<Step n={ 1 } active title={ __( 'Scan your past orders', 'coupon-lock' ) }>
						<p className="mt-0.5 text-muted">{ __( 'Reads the last 12 months, so returning shoppers are known from day one.', 'coupon-lock' ) }</p>
						<div className="mt-3.5">
							{ importing ? <ProgressBar value={ progress } /> : (
								<div className="flex flex-wrap gap-2.5">
									<Button className="h-11 px-5" onClick={ onImport }><RefreshCw size={ 16 } />{ __( 'Scan past orders', 'coupon-lock' ) }</Button>
									<Button variant="secondary" className="h-11 bg-transparent" onClick={ () => onSample( true ) }><FlaskConical size={ 16 } />{ __( 'Try with sample orders', 'coupon-lock' ) }</Button>
								</div>
							) }
						</div>
					</Step>
					<Step n={ 2 } title={ __( 'Guard a welcome coupon', 'coupon-lock' ) }>
						<p className="mt-0.5 text-muted">{ __( 'Open a coupon and tick “New customers only (Coupon Lock)”.', 'coupon-lock' ) }</p>
						<a className={ cn( MONO, 'group mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#111]' ) } href="edit.php?post_type=shop_coupon">{ __( 'Open coupons', 'coupon-lock' ) }<Arrow /></a>
					</Step>
					<Step n={ 3 } title={ __( 'Choose what happens at checkout', 'coupon-lock' ) }>
						<p className="mt-0.5 text-muted">{ __( 'Refuse the coupon, or let the order through and hold it for your review.', 'coupon-lock' ) }</p>
						<button type="button" className={ cn( MONO, 'group mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#111]' ) } onClick={ onSettings }>{ __( 'Open settings', 'coupon-lock' ) }<Arrow /></button>
					</Step>
				</ol>
			</section>
			<div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5 border-t border-[#E5E5E0] pt-5">
				<h2 className="m-0"><SectionLabel>{ __( '02 / What a ring looks like', 'coupon-lock' ) }</SectionLabel></h2>
				<svg viewBox="0 0 300 200" width="100%" role="img" aria-label={ __( 'Three orders under different names, joined because two share an email and two share a delivery address', 'coupon-lock' ) } style={ { fontFamily: 'inherit' } }>
					{ [ [ 60, 46, 150, 66 ], [ 240, 46, 150, 66 ], [ 240, 46, 196, 150 ], [ 104, 166, 196, 150 ] ].map( ( [ x1, y1, x2, y2 ], i ) => <line key={ i } x1={ x1 } y1={ y1 } x2={ x2 } y2={ y2 } stroke="#E5E5E0" strokeWidth="1.6" /> ) }
					{ [ [ 150, 66 ], [ 196, 150 ] ].map( ( [ x, y ], i ) => <circle key={ i } cx={ x } cy={ y } r="7" fill="#FF5A1F" /> ) }
					{ [ [ 60, 46 ], [ 240, 46 ], [ 104, 166 ] ].map( ( [ x, y ], i ) => <circle key={ i } cx={ x } cy={ y } r="7" fill="#FAFAF7" stroke="#111" strokeWidth="2" /> ) }
					<text x="60" y="26" textAnchor="middle" fontSize="12" fontWeight="600" fill="#132120">Jo Park</text>
					<text x="240" y="26" textAnchor="middle" fontSize="12" fontWeight="600" fill="#132120">J. Parker</text>
					<text x="104" y="190" textAnchor="middle" fontSize="12" fontWeight="600" fill="#132120">Joanne P</text>
					<text x="150" y="90" textAnchor="middle" fontSize="11" fill="#55605E">{ __( 'same email', 'coupon-lock' ) }</text>
					<text x="226" y="176" textAnchor="middle" fontSize="11" fill="#55605E">{ __( 'same address', 'coupon-lock' ) }</text>
				</svg>
				<p className="text-muted">{ __( 'Three names, one shopper. j.o.park+deal@gmail.com and jopark@gmail.com count as the same inbox.', 'coupon-lock' ) }</p>
				<p className="border-t border-line pt-4 text-[13px] leading-[19px] text-muted">{ __( 'Details are kept as one-way hashes in your own database. Nothing is sent anywhere.', 'coupon-lock' ) }</p>
			</div>
		</div>
	);
}

/** The month as one sentence; falls back to a calm line when nothing was refused. */
function Hero( { act }: { act: Activity | null } ) {
	const s = act?.stats;
	let text: React.ReactNode = __( 'No repeat welcome coupons in the last 30 days.', 'coupon-lock' );
	if ( s && s.blocked > 0 ) {
		const raw = s.saved
			? sprintf( _n( 'In the last 30 days Coupon Lock refused <b>%1$d</b> repeat welcome coupon, worth <b>%2$s</b>.', 'In the last 30 days Coupon Lock refused <b>%1$d</b> repeat welcome coupons, worth <b>%2$s</b>.', s.blocked, 'coupon-lock' ), s.blocked, s.saved )
			: sprintf( _n( 'In the last 30 days Coupon Lock refused <b>%d</b> repeat welcome coupon.', 'In the last 30 days Coupon Lock refused <b>%d</b> repeat welcome coupons.', s.blocked, 'coupon-lock' ), s.blocked );
		text = createInterpolateElement( raw, { b: <strong className="font-semibold text-[#FF5A1F]" /> } );
	}
	return <h1 className={ cn( 'm-0 text-[15px] font-medium leading-6', ! act && 'invisible' ) }>{ text }</h1>; // Hidden until loaded so the sentence does not flip.
}

function Figure( { n, label, value, of, accent }: { n: number; label: string; value: number; of?: number; accent?: boolean } ) {
	return (
		<div className="border-b border-r border-[#E5E5E0] p-6 md:border-b-0 [&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r md:[&:last-child]:border-r-0">
			<dt className={ cn( MONO, 'flex items-center justify-between text-[11px] text-[#706F6A]' ) }>{ label }<span className="text-[10px] text-[#9A9A93]">#{ String( n ).padStart( 2, '0' ) }</span></dt>
			<dd className="m-0 mt-2 flex items-baseline gap-2">
				<span className={ cn( 'text-[36px] font-semibold leading-10 tracking-[-0.02em]', accent && 'text-[#FF5A1F]' ) }>{ value.toLocaleString() }</span>
				{ of !== undefined && <span className="font-mono text-[11px] text-[#706F6A]">{ sprintf( __( 'of %s', 'coupon-lock' ), of.toLocaleString() ) }</span> }
			</dd>
		</div>
	);
}

interface Props extends Omit< TableProps, 'data' > {
	data: OverviewData | null;
	error: string;
	importing: boolean;
	progress: number;
	imported: { n: number; seconds: number } | null;
	dismissImported: () => void;
	onImport: () => void;
	onSample: ( on: boolean ) => void;
	onSettings: () => void;
}

export function Overview( { data, error, filters, setFilters, setPage, onOpen, importing, progress, imported, dismissImported, onImport, onSample, onSettings }: Props ) {
	const [ act, setAct ] = useState< Activity | null >( null );
	const filtering = filters.search || filters.link || filters.min_size > 2;
	const empty = !! data && data.stats.rings === 0 && ! filtering;
	const indexed = data?.stats.indexed;

	useEffect( () => {
		// Hero numbers and the timeline reuse the Activity endpoint; a failure only hides them.
		getActivity( { range: '30d', search: '', type: '', severity: '', page: 1, per_page: 5 } ).then( setAct ).catch( () => {} );
	}, [ indexed ] );

	const notices = (
		<>
			{ error && (
				<div role="alert" className="flex items-center gap-3 border-y border-[#E5E5E0] py-3 text-[#111]">
					<AlertTriangle size={ 18 } className="text-[#FF5A1F]" />{ error }
				</div>
			) }
			{ imported !== null && (
				<div role="status" className="flex items-center gap-3 border-y border-[#E5E5E0] py-3">
					<CheckCircle2 size={ 20 } className="text-[#111]" />
					<div className="flex-1">
						<strong>{ sprintf( _n( 'Scanned %1$d past order in %2$s seconds.', 'Scanned %1$d past orders in %2$s seconds.', imported.n, 'coupon-lock' ), imported.n, String( imported.seconds ) ) }</strong>
						<p className="text-muted">{ data && data.stats.rings > 0 ? __( 'Linked orders are listed below.', 'coupon-lock' ) : __( 'No linked orders found. New orders are checked automatically.', 'coupon-lock' ) }</p>
					</div>
					<Button variant="ghost" className="w-10 px-0" onClick={ dismissImported } aria-label={ __( 'Dismiss', 'coupon-lock' ) }><X size={ 16 } /></Button>
				</div>
			) }
		</>
	);

	if ( ! data ) {
		return <div className="flex flex-col gap-5">{ notices }{ ! error && <Spinner /> }</div>;
	}
	if ( empty ) {
		return <div className="flex flex-col gap-8">{ notices }<FirstRun onImport={ onImport } onSample={ onSample } onSettings={ onSettings } importing={ importing } progress={ progress } /></div>;
	}

	const { stats } = data;
	return (
		<div className="flex flex-col gap-8">
			{ ( error || imported !== null ) && <div className="flex flex-col gap-3">{ notices }</div> }
			<section role="status" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[#E5E5E0] pb-4">
				<div className="flex items-center gap-3"><TwinDot /><Hero act={ act } /></div>
				{ importing ? <ProgressBar value={ progress } /> : (
					<Button variant="secondary" className="h-8 rounded border-[#111] bg-transparent font-mono text-[12px]" onClick={ onImport }><RefreshCw size={ 14 } />{ __( 'Scan past orders', 'coupon-lock' ) }</Button>
				) }
			</section>

			<dl className="m-0 grid grid-cols-2 border border-[#E5E5E0] bg-white md:grid-cols-4">
				<Figure n={ 1 } label={ __( 'Rings', 'coupon-lock' ) } value={ stats.rings } />
				<Figure n={ 2 } label={ __( 'Accounts in rings', 'coupon-lock' ) } value={ stats.ring_customers } />
				<Figure n={ 3 } label={ __( 'Orders in rings', 'coupon-lock' ) } value={ stats.orders_in_rings } of={ stats.indexed } />
				<Figure n={ 4 } label={ __( 'Coupons guarded', 'coupon-lock' ) } value={ stats.coupons } accent />
			</dl>

			<div className="flex flex-wrap items-start gap-x-12 gap-y-10">
				<Reveal className="min-w-0 flex-[999_1_560px]"><RingsTable data={ data } filters={ filters } setFilters={ setFilters } setPage={ setPage } onOpen={ onOpen } /></Reveal>
				<aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-5" aria-labelledby="ts-coupon-lock-latest">
					<div className="border-b border-[#E5E5E0] pb-4">
						<h2 id="ts-coupon-lock-latest" className="m-0"><SectionLabel>{ __( '02 / Latest checkouts', 'coupon-lock' ) }</SectionLabel></h2>
						<p className="mt-1.5 text-[13px] text-[#706F6A]">{ __( 'Checkouts that used a guarded coupon.', 'coupon-lock' ) }</p>
					</div>
					{ act && act.events.length === 0 && <p className="text-[#706F6A]">{ __( 'Nothing yet. Checkouts that use a guarded coupon show up here.', 'coupon-lock' ) }</p> }
					{ act && act.events.length > 0 && (
						<ol className="m-0 flex list-none flex-col gap-6 p-0">
							{ act.events.map( ( e ) => {
								const d = describe( e );
								const hot = e.type === 'blocked' || e.type === 'held' || e.type === 'ring';
								return (
									<li key={ e.id } className="relative m-0 flex flex-col gap-0.5 border-l border-[#E5E5E0] pl-6">
										<span className={ cn( 'absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full', hot ? 'bg-[#FF5A1F]' : 'bg-[#111]' ) } />
										<span className={ cn( MONO, 'text-[10px]', hot ? 'text-[#FF5A1F]' : 'text-[#9A9A93]' ) }>{ ago( e.created ) }</span>
										<span className="font-medium">{ d.title }</span>
										<span className="font-mono text-[11px] text-[#706F6A]">{ e.coupon ? `${ e.coupon }: ${ d.outcome }` : d.outcome }</span>
									</li>
								);
							} ) }
						</ol>
					) }
					<div className="border-t border-[#E5E5E0] pt-4">
						<div className="mb-2 flex items-center gap-2 font-mono text-[12px] font-semibold"><Lock size={ 14 } />{ __( 'Zero-exposure standard', 'coupon-lock' ) }</div>
						<p className="m-0 font-mono text-[11px] leading-[18px] text-[#706F6A]">{ __( 'Emails, phones and addresses are kept as one-way hashes in your own database. Nothing is sent anywhere.', 'coupon-lock' ) }</p>
					</div>
				</aside>
			</div>
		</div>
	);
}
