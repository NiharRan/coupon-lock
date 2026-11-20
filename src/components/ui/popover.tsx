import * as P from '@radix-ui/react-popover';
import { cn } from '../../lib/utils';

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;

/** Flat popover (Twinspot Lab: 1px ink border, no shadow). Portals into #ts-coupon-lock-root so the scoped Tailwind styles still apply. */
export function PopoverContent( { className, ...props }: React.ComponentProps< typeof P.Content > ) {
	return (
		<P.Portal container={ document.getElementById( 'ts-coupon-lock-root' ) }>
			<P.Content align="start" sideOffset={ 4 } className={ cn( 'z-[100001] w-[300px] rounded border border-[#111] bg-white focus:outline-none', className ) } { ...props } />
		</P.Portal>
	);
}
