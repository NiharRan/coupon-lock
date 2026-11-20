import { useEffect, useMemo, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { AtSign, Home, Phone, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input, Select } from '../components/ui/input';
import { getCoupons, lockCoupon, type Coupon } from '../lib/api';
import { cn } from '../lib/utils';
import type { Overview } from '../types';
import { MONO, SectionLabel } from './overview';

const PER_PAGE = 10;
type Rule = '' | 'on' | 'off';

const MATCHES = [
	{ icon: AtSign, title: __( 'Email', 'coupon-lock' ), text: __( 'Gmail dots and +tags are ignored.', 'coupon-lock' ) },
	{ icon: Phone, title: __( 'Phone', 'coupon-lock' ), text: __( 'Last 10 digits are compared.', 'coupon-lock' ) },
	{ icon: Home, title: __( 'Address', 'coupon-lock' ), text: __( 'Street line and postcode must both match.', 'coupon-lock' ) },
];

const TYPES: Record< string, string > = {
	percent: __( 'Percentage', 'coupon-lock' ),
	fixed_cart: __( 'Fixed cart', 'coupon-lock' ),
	fixed_product: __( 'Fixed product', 'coupon-lock' ),
};

const amount = ( c: Coupon ) => ( c.type === 'percent' ? `${ c.amount }%` : c.amount );

export function Rules( { enabled }: { data: Overview | null; enabled: boolean } ) {
	const [ coupons, setCoupons ] = useState< Coupon[] | null >( null );
	const [ error, setError ] = useState( '' );
	const [ search, setSearch ] = useState( '' );
	const [ rule, setRule ] = useState< Rule >( '' );
	const [ type, setType ] = useState( '' );
	const [ page, setPage ] = useState( 1 );

	useEffect( () => {
		getCoupons().then( setCoupons ).catch( () => setError( __( 'Could not load coupons.', 'coupon-lock' ) ) );
	}, [] );

	const toggle = ( c: Coupon ) => {
		const set = ( locked: boolean ) => setCoupons( ( list ) => list && list.map( ( x ) => ( x.id === c.id ? { ...x, locked } : x ) ) );
		set( ! c.locked );
		setError( '' );
		lockCoupon( c.id, ! c.locked ).catch( () => {
			set( c.locked );
			setError( __( 'Could not save. Try again.', 'coupon-lock' ) );
		} );
	};

	const all = coupons ?? [];
	const on = all.filter( ( c ) => c.locked ).length;
	const filtered = useMemo(
		() => all.filter( ( c ) => c.code.toLowerCase().includes( search.trim().toLowerCase() ) && ( ! type || c.type === type ) && ( ! rule || c.locked === ( rule === 'on' ) ) ),
		[ all, search, type, rule ]
	);
	const pages = Math.max( 1, Math.ceil( filtered.length / PER_PAGE ) );
	const current = Math.min( page, pages );
	const shown = filtered.slice( ( current - 1 ) * PER_PAGE, current * PER_PAGE );
	const types = Array.from( new Set( all.map( ( c ) => c.type ) ) );
	const reset = () => { setSearch( '' ); setRule( '' ); setType( '' ); setPage( 1 ); };
	const chips: [ Rule, string ][] = [
		[ '', sprintf( __( 'All %d', 'coupon-lock' ), all.length ) ],
		[ 'on', sprintf( __( 'New customers only %d', 'coupon-lock' ), on ) ],
		[ 'off', sprintf( __( 'No rule %d', 'coupon-lock' ), all.length - on ) ],
	];

	return (
		<div className="flex flex-col gap-8">
			<section className="flex min-w-0 flex-col gap-5" aria-labelledby="ts-coupon-lock-coupons">
				<div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#E5E5E0] pb-4">
					<div>
						<h2 id="ts-coupon-lock-coupons" className="m-0"><SectionLabel>{ __( '01 / Coupon rules', 'coupon-lock' ) }</SectionLabel></h2>
						<p className="mt-1.5 text-[13px] text-[#706F6A]">
							{ enabled
								? __( 'A coupon with “New customers only” is refused when the shopper’s email, phone or address matches an earlier order.', 'coupon-lock' )
								: __( 'Blocking is paused in Plugin Settings. Orders are still indexed.', 'coupon-lock' ) }
						</p>
					</div>
					<div className="relative w-full max-w-[280px]">
						<Search size={ 16 } className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
						<Input className="w-full rounded pl-9 font-mono text-[12px]" placeholder={ __( 'Find a coupon code', 'coupon-lock' ) } value={ search } onChange={ ( e ) => { setSearch( e.target.value ); setPage( 1 ); } } aria-label={ __( 'Search coupons', 'coupon-lock' ) } />
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-1.5">
					{ chips.map( ( [ id, label ] ) => (
						<button
							key={ id }
							type="button"
							aria-pressed={ rule === id }
							onClick={ () => { setRule( id ); setPage( 1 ); } }
							className={ cn( 'h-7 rounded border px-2.5 font-mono text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] focus-visible:ring-offset-2', rule === id ? 'border-[#111] bg-[#111] text-white' : 'border-[#E5E5E0] bg-white text-[#111] hover:border-[#111]' ) }
						>
							{ label }
						</button>
					) ) }
					{ types.length > 1 && (
						<Select className="ml-auto h-7 rounded font-mono text-[11px]" value={ type } onChange={ ( e ) => { setType( e.target.value ); setPage( 1 ); } } aria-label={ __( 'Discount type', 'coupon-lock' ) }>
							<option value="">{ __( 'Any discount type', 'coupon-lock' ) }</option>
							{ types.map( ( t ) => <option key={ t } value={ t }>{ TYPES[ t ] ?? t }</option> ) }
						</Select>
					) }
				</div>

				{ error && <p className="m-0 font-mono text-[12px] text-[#FF5A1F]" role="alert">{ error }</p> }

				<div className="overflow-hidden rounded border border-[#E5E5E0] bg-white">
					{ coupons === null && ! error && <p className="m-0 px-5 py-10 text-center text-muted">…</p> }
					{ coupons?.length === 0 && (
						<p className="m-0 px-5 py-10 text-center text-muted">
							{ __( 'No coupons yet.', 'coupon-lock' ) } <a className="text-[#111] underline hover:text-[#FF5A1F]" href="post-new.php?post_type=shop_coupon">{ __( 'Add a coupon', 'coupon-lock' ) }</a>
						</p>
					) }
					{ coupons && coupons.length > 0 && filtered.length === 0 && (
						<div className="px-5 py-10 text-center text-muted">
							<p className="m-0">{ __( 'No coupons match these filters.', 'coupon-lock' ) }</p>
							<Button variant="secondary" className="mt-3" onClick={ reset }>{ __( 'Clear filters', 'coupon-lock' ) }</Button>
						</div>
					) }
					<ul className="m-0 list-none p-0">
						{ shown.map( ( c ) => (
							<li key={ c.id } className="m-0 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#E5E5E0] px-5 py-4 last:border-b-0 hover:bg-[#F4F4F1]">
								<div className="flex min-w-0 flex-[1_1_220px] flex-wrap items-baseline gap-x-2.5">
									<a className="font-mono text-[14px] font-semibold text-[#111] hover:text-[#FF5A1F]" href={ `post.php?post=${ c.id }&action=edit` }>{ c.code }</a>
									{ c.status !== 'publish' && <span className={ cn( MONO, 'rounded border border-[#E5E5E0] bg-[#F9F9F6] px-1.5 py-0.5 text-[10px] text-[#706F6A]' ) }>{ c.status }</span> }
								</div>
								<span className={ cn( MONO, 'flex-[0_0_130px] text-[10px] text-[#706F6A]' ) }>{ TYPES[ c.type ] ?? c.type }</span>
								<span className="flex-[0_0_70px] text-right font-mono text-[13px] font-semibold tabular-nums">{ amount( c ) }</span>
								<span className={ cn( MONO, 'flex-[0_0_170px] text-right text-[10px]', c.locked ? 'text-[#111]' : 'text-[#9A9A93]' ) }>
									{ c.locked ? __( 'New customers only', 'coupon-lock' ) : __( 'No rule', 'coupon-lock' ) }
								</span>
								<button
									type="button"
									role="switch"
									aria-checked={ c.locked }
									aria-label={ sprintf( __( 'New customers only for %s', 'coupon-lock' ), c.code ) }
									onClick={ () => toggle( c ) }
									className={ cn( 'relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] focus-visible:ring-offset-2', c.locked ? 'border-[#111] bg-[#111]' : 'border-[#E5E5E0] bg-[#F4F4F1]' ) }
								>
									<span className={ cn( 'absolute top-[3px] h-4 w-4 rounded-full transition-all', c.locked ? 'left-[23px] bg-[#FF5A1F]' : 'left-[3px] bg-[#9A9A93]' ) } />
								</button>
							</li>
						) ) }
					</ul>
					{ filtered.length > 0 && (
						<div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E5E0] px-5 py-3.5 font-mono text-[12px] text-[#706F6A]">
							<span>{ sprintf( __( '%1$d of %2$d coupons', 'coupon-lock' ), shown.length, filtered.length ) }</span>
							{ pages > 1 && (
								<div className="flex items-center gap-2">
									<Button variant="secondary" disabled={ current <= 1 } onClick={ () => setPage( current - 1 ) }>{ __( 'Previous', 'coupon-lock' ) }</Button>
									<span className="px-1">{ current } / { pages }</span>
									<Button variant="secondary" disabled={ current >= pages } onClick={ () => setPage( current + 1 ) }>{ __( 'Next', 'coupon-lock' ) }</Button>
								</div>
							) }
						</div>
					) }
				</div>
			</section>

			<section className="flex flex-col gap-5" aria-labelledby="ts-coupon-lock-match">
				<div className="border-b border-[#E5E5E0] pb-4">
					<h2 id="ts-coupon-lock-match" className="m-0"><SectionLabel>{ __( '02 / What counts as a match', 'coupon-lock' ) }</SectionLabel></h2>
				</div>
				<div className="grid gap-6 md:grid-cols-3">
					{ MATCHES.map( ( r ) => (
						<div key={ r.title } className="flex gap-3">
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#E5E5E0] bg-[#F9F9F6] text-[#111]"><r.icon size={ 18 } /></span>
							<div><div className={ cn( MONO, 'text-[11px] font-semibold text-[#111]' ) }>{ r.title }</div><p className="mt-1 text-[13px] leading-[18px] text-[#706F6A]">{ r.text }</p></div>
						</div>
					) ) }
				</div>
				<p className="m-0 text-[13px] text-[#706F6A]">{ __( 'IP addresses are stored but never used to match. If a detail is missing, nothing matches and checkout continues.', 'coupon-lock' ) }</p>
			</section>
		</div>
	);
}
