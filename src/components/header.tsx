import { applyFilters } from '@wordpress/hooks';
import { __, _n, sprintf } from '@wordpress/i18n';
import { cn } from '../lib/utils';
import { MONO } from '../screens/overview';
import type { ExtraTab, Stats, Tab } from '../types';

const TABS: [ Tab, string ][] = [
	[ 'overview', __( 'Overview', 'coupon-lock' ) ],
	[ 'accounts', __( 'Linked accounts', 'coupon-lock' ) ],
	[ 'rules', __( 'Rules', 'coupon-lock' ) ],
	[ 'activity', __( 'Activity', 'coupon-lock' ) ],
	[ 'settings', __( 'Settings', 'coupon-lock' ) ],
];

/** Add-on tabs from the `couponLock.tabs` filter, read at render time; ids that clash with built-in tabs are ignored. */
export function extraTabs(): ExtraTab[] {
	const extras = applyFilters( 'couponLock.tabs', [] ) as ExtraTab[];
	return extras.filter( ( t, i ) => ! TABS.some( ( [ id ] ) => id === t.id ) && extras.findIndex( ( e ) => e.id === t.id ) === i );
}

export function Header( { tab, setTab, enabled, stats }: { tab: Tab; setTab: ( t: Tab ) => void; enabled: boolean; stats?: Stats } ) {
	const guarding = stats && stats.coupons > 0;
	let status: string = __( 'Guard paused', 'coupon-lock' );
	if ( enabled ) {
		status = guarding
			? sprintf( _n( 'Guarding %d coupon', 'Guarding %d coupons', stats.coupons, 'coupon-lock' ), stats.coupons )
			: __( 'No coupons guarded yet', 'coupon-lock' );
	}
	return (
		<div className="mb-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-b border-[#E5E5E0]">
			<div className="flex flex-wrap items-center gap-x-8 gap-y-2">
				<div className="flex items-center gap-2.5">
					<svg width="28" height="22" viewBox="0 0 28 22" aria-hidden="true">
						<circle cx="9" cy="11" r="8" fill="#111" />
						<circle cx="19" cy="11" r="8" fill="#FF5A1F" style={ { mixBlendMode: 'multiply' } } />
					</svg>
					<span className="text-[17px] font-semibold tracking-[-0.02em]">Coupon Lock</span>
					{ stats && <span className={ cn( MONO, 'text-[10px] text-[#9A9A93]' ) }>{ stats.version }</span> }
				</div>
				<nav className="flex flex-wrap gap-x-6" aria-label={ __( 'Coupon Lock sections', 'coupon-lock' ) }>
					{ [ ...TABS, ...extraTabs().map( ( t ): [ Tab, string ] => [ t.id, t.label ] ) ].map( ( [ id, label ] ) => (
						<button
							key={ id }
							type="button"
							aria-current={ tab === id ? 'page' : undefined }
							onClick={ () => setTab( id ) }
							className={ cn( MONO, '-mb-px border-b py-[18px] text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]', tab === id ? 'border-[#111] font-semibold text-[#111]' : 'border-transparent font-medium text-[#706F6A] hover:text-[#FF5A1F]' ) }
						>
							{ label }
						</button>
					) ) }
				</nav>
			</div>
			<span className={ cn( MONO, 'inline-flex items-center gap-2 py-2 text-[11px] font-semibold', enabled && guarding ? 'text-[#111]' : 'text-[#706F6A]' ) }>
				<span className={ cn( 'h-2 w-2 rounded-full', enabled && guarding ? 'bg-[#FF5A1F]' : 'bg-[#9A9A93]' ) } />
				{ status }
			</span>
		</div>
	);
}
