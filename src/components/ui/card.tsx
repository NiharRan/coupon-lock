import { cn } from '../../lib/utils';

export const Card = ( { className, ...props }: React.HTMLAttributes< HTMLDivElement > ) => (
	<div className={ cn( 'border-t border-[#E5E5E0]', className ) } { ...props } />
);
