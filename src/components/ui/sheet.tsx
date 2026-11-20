import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { __ } from '@wordpress/i18n';

/** Right-hand side panel (shadcn Sheet). Portals into #ts-coupon-lock-root so the scoped Tailwind styles still apply. */
export function Sheet( { open, onClose, title, description, children, footer }: { open: boolean; onClose: () => void; title: React.ReactNode; description: string; children: React.ReactNode; footer?: React.ReactNode } ) {
	return (
		<Dialog.Root open={ open } onOpenChange={ ( o ) => ! o && onClose() }>
			<Dialog.Portal container={ document.getElementById( 'ts-coupon-lock-root' ) }>
				<Dialog.Overlay className="ts-overlay fixed inset-0 z-[100000] bg-[#111]/40" />
				<Dialog.Content className="ts-sheet fixed inset-y-0 right-0 z-[100001] flex w-full max-w-[560px] flex-col border-l border-[#111] bg-[#FAFAF7] focus:outline-none">
					<div className="flex items-start justify-between gap-3 border-b border-[#E5E5E0] p-5">
						<div className="min-w-0"><Dialog.Title asChild><div className="font-mono text-[12px] font-semibold uppercase leading-5 tracking-[0.06em] text-[#111]">{ title }</div></Dialog.Title><Dialog.Description className="mt-1 font-mono text-[11px] text-[#706F6A]">{ description }</Dialog.Description></div>
						<Dialog.Close className="rounded border border-transparent p-1.5 text-[#706F6A] hover:border-[#111] hover:text-[#111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]" aria-label={ __( 'Close', 'coupon-lock' ) }><X size={ 18 } /></Dialog.Close>
					</div>
					<div className="flex-1 overflow-y-auto p-5">{ children }</div>
					{ footer && <div className="flex flex-wrap items-center gap-2 border-t border-[#E5E5E0] p-4">{ footer }</div> }
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
