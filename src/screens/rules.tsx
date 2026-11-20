import { useEffect, useMemo, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { AtSign, Home, Phone, Plus, Search, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Input, Select } from '../components/ui/input';
import { getCoupons, getRules, saveCouponRules, type Coupon, type RuleDef } from '../lib/api';
import { cn } from '../lib/utils';
import type { Overview } from '../types';
import { MONO, SectionLabel } from './overview';

const PER_PAGE = 10;
/** Own checkbox look: wp-admin's checked style can blend into the popover background. Ink fill with a white tick, WP's own tick hidden. */
const CHECK = 'ts-check m-0 mt-0.5 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-[3px] border border-[#111] bg-white before:hidden checked:bg-[#111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] focus-visible:ring-offset-1';
type Has = '' | 'has' | 'none';

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

/** Popover to pick any mix of rules for one coupon, or all at once. Applies on "Apply". */
function RulePicker( { coupon, defs, onApply }: { coupon: Coupon; defs: RuleDef[]; onApply: ( rules: string[] ) => void } ) {
	const [ open, setOpen ] = useState( false );
	const [ draft, setDraft ] = useState< string[] >( coupon.rules );
	const everything = defs.length > 0 && defs.every( ( d ) => draft.includes( d.id ) );
	const flip = ( id: string ) => setDraft( ( d ) => ( d.includes( id ) ? d.filter( ( x ) => x !== id ) : [ ...d, id ] ) );
	const row = 'flex w-full cursor-pointer items-start gap-2.5 border-b border-[#E5E5E0] px-3 py-2.5 last:border-b-0 hover:bg-[#F4F4F1]';
	return (
		<Popover open={ open } onOpenChange={ ( o ) => { setOpen( o ); o && setDraft( coupon.rules ); } }>
			<PopoverTrigger className={ cn( MONO, 'inline-flex h-6 items-center gap-1 rounded border border-[#E5E5E0] bg-white px-2 text-[10px] text-[#111] hover:border-[#111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]' ) }>
				<Plus size={ 10 } />{ __( 'Add rule', 'coupon-lock' ) }
			</PopoverTrigger>
			<PopoverContent>
				<label className={ row }>
					<input type="checkbox" className={ CHECK } checked={ everything } onChange={ () => setDraft( everything ? [] : defs.map( ( d ) => d.id ) ) } />
					<span className={ cn( MONO, 'text-[11px] font-semibold text-[#111]' ) }>{ __( 'All rules', 'coupon-lock' ) }</span>
				</label>
				{ defs.map( ( d ) => (
					<label key={ d.id } className={ row }>
						<input type="checkbox" className={ CHECK } checked={ draft.includes( d.id ) } onChange={ () => flip( d.id ) } />
						<span>
							<span className={ cn( MONO, 'block text-[11px] font-semibold text-[#111]' ) }>{ d.label }</span>
							<span className="mt-0.5 block text-[12px] leading-[16px] text-[#706F6A]">{ d.description }</span>
							{ d.warning && <span className="mt-0.5 block text-[12px] leading-[16px] text-[#FF5A1F]">{ d.warning }</span> }
						</span>
					</label>
				) ) }
				<div className="flex justify-end gap-2 border-t border-[#E5E5E0] p-2">
					<Button variant="secondary" onClick={ () => setOpen( false ) }>{ __( 'Cancel', 'coupon-lock' ) }</Button>
					<Button onClick={ () => { onApply( draft ); setOpen( false ); } }>{ __( 'Apply', 'coupon-lock' ) }</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

export function Rules( { enabled }: { data: Overview | null; enabled: boolean } ) {
	const [ coupons, setCoupons ] = useState< Coupon[] | null >( null );
	const [ error, setError ] = useState( '' );
	const [ search, setSearch ] = useState( '' );
	const [ defs, setDefs ] = useState< RuleDef[] >( [] );
	const [ has, setHas ] = useState< Has >( '' );
	const [ ruleId, setRuleId ] = useState( '' );
	const [ type, setType ] = useState( '' );
	const [ page, setPage ] = useState( 1 );

	useEffect( () => {
		Promise.all( [ getRules(), getCoupons() ] )
			.then( ( [ d, c ] ) => {
				setDefs( d );
				setCoupons( c );
			} )
			.catch( () => setError( __( 'Could not load coupons.', 'coupon-lock' ) ) );
	}, [] );

	const setRules = ( c: Coupon, rules: string[] ) => {
		const set = ( list: string[] ) => setCoupons( ( l ) => l && l.map( ( x ) => ( x.id === c.id ? { ...x, rules: list } : x ) ) );
		set( rules );
		setError( '' );
		saveCouponRules( c.id, rules ).then( ( r ) => set( r.rules ) ).catch( () => {
			set( c.rules );
			setError( __( 'Could not save. Try again.', 'coupon-lock' ) );
		} );
	};

	const all = coupons ?? [];
	const withRules = all.filter( ( c ) => c.rules.length ).length;
	const filtered = useMemo(
		() => all.filter( ( c ) => c.code.toLowerCase().includes( search.trim().toLowerCase() ) && ( ! type || c.type === type ) && ( ! has || ( has === 'has' ) === c.rules.length > 0 ) && ( ! ruleId || c.rules.includes( ruleId ) ) ),
		[ all, search, type, has, ruleId ]
	);
	const pages = Math.max( 1, Math.ceil( filtered.length / PER_PAGE ) );
	const current = Math.min( page, pages );
	const shown = filtered.slice( ( current - 1 ) * PER_PAGE, current * PER_PAGE );
	const types = Array.from( new Set( all.map( ( c ) => c.type ) ) );
	const reset = () => { setSearch( '' ); setHas( '' ); setRuleId( '' ); setType( '' ); setPage( 1 ); };
	const chips: [ Has, string ][] = [
		[ '', sprintf( __( 'All %d', 'coupon-lock' ), all.length ) ],
		[ 'has', sprintf( __( 'Has rules %d', 'coupon-lock' ), withRules ) ],
		[ 'none', sprintf( __( 'No rules %d', 'coupon-lock' ), all.length - withRules ) ],
	];

	return (
		<div className="flex flex-col gap-8">
			<section className="flex min-w-0 flex-col gap-5" aria-labelledby="ts-coupon-lock-coupons">
				<div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#E5E5E0] pb-4">
					<div>
						<h2 id="ts-coupon-lock-coupons" className="m-0"><SectionLabel>{ __( '01 / Coupon rules', 'coupon-lock' ) }</SectionLabel></h2>
						<p className="mt-1.5 text-[13px] text-[#706F6A]">
							{ enabled
								? __( 'A coupon is refused when the shopper matches an earlier order on any rule added to it.', 'coupon-lock' )
								: __( 'Blocking is paused in Plugin Settings. Orders are still indexed.', 'coupon-lock' ) }
						</p>
					</div>
					<div className="relative w-full max-w-[280px] flex items-center">
						<Search size={ 16 } className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
						<Input className="w-full flex-1 pl-9" placeholder={ __( 'Find a coupon code', 'coupon-lock' ) } value={ search } onChange={ ( e ) => { setSearch( e.target.value ); setPage( 1 ); } } aria-label={ __( 'Search coupons', 'coupon-lock' ) } />
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-1.5">
					{ chips.map( ( [ id, label ] ) => (
						<button
							key={ id }
							type="button"
							aria-pressed={ has === id }
							onClick={ () => { setHas( id ); setPage( 1 ); } }
							className={ cn( 'h-9 rounded border px-3 font-mono text-[11px] uppercase tracking-[0.06em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] focus-visible:ring-offset-2', has === id ? 'border-[#111] bg-[#111] text-white' : 'border-[#E5E5E0] bg-white text-[#111] hover:border-[#111]' ) }
						>
							{ label }
						</button>
					) ) }
					<Select className="ml-auto" value={ ruleId } onChange={ ( e ) => { setRuleId( e.target.value ); setPage( 1 ); } } aria-label={ __( 'Rule', 'coupon-lock' ) }>
						<option value="">{ __( 'Any rule', 'coupon-lock' ) }</option>
						{ defs.map( ( d ) => <option key={ d.id } value={ d.id }>{ d.label }</option> ) }
					</Select>
					{ types.length > 1 && (
						<Select value={ type } onChange={ ( e ) => { setType( e.target.value ); setPage( 1 ); } } aria-label={ __( 'Discount type', 'coupon-lock' ) }>
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
								<div className="relative flex flex-[1_1_260px] flex-wrap items-center gap-1.5">
									{ c.rules.map( ( id ) => {
										const d = defs.find( ( x ) => x.id === id );
										return d ? (
											<span key={ id } title={ d.warning || d.description } className={ cn( MONO, 'inline-flex items-center gap-1 rounded border border-[#111] bg-[#111] py-0.5 pl-2 pr-1 text-[10px] text-white' ) }>
												{ d.label }
												<button type="button" onClick={ () => setRules( c, c.rules.filter( ( r ) => r !== id ) ) } aria-label={ sprintf( __( 'Remove %1$s rule from %2$s', 'coupon-lock' ), d.label, c.code ) } className="flex h-4 w-4 items-center justify-center rounded text-white hover:text-[#FF5A1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"><X size={ 10 } /></button>
											</span>
										) : null;
									} ) }
									{ ! c.rules.length && <span className={ cn( MONO, 'text-[10px] text-[#9A9A93]' ) }>{ __( 'No rules', 'coupon-lock' ) }</span> }
									<RulePicker coupon={ c } defs={ defs } onApply={ ( r ) => setRules( c, r ) } />
								</div>
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
				<p className="m-0 text-[13px] text-[#706F6A]">{ __( 'IP matching is off unless you add the IP rule to a coupon, because shared networks can block innocent shoppers. If a detail is missing, nothing matches and checkout continues.', 'coupon-lock' ) }</p>
			</section>
		</div>
	);
}
