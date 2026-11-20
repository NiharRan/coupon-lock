import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const button = cva(
	'inline-flex items-center justify-center gap-2 rounded border font-mono text-[11px] font-medium uppercase leading-none tracking-[0.06em] h-9 px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
	{
		variants: {
			variant: {
				primary: 'border-[#111] bg-[#111] text-[#FAFAF7] hover:border-[#FF5A1F] active:bg-[#333]',
				secondary: 'border-[#111] bg-transparent text-[#111] hover:border-[#FF5A1F] hover:text-[#FF5A1F]',
				ghost: 'border-transparent text-[#706F6A] hover:bg-[#F4F4F1] hover:text-[#111]',
			},
		},
		defaultVariants: { variant: 'primary' },
	}
);

type Props = React.ButtonHTMLAttributes< HTMLButtonElement > & VariantProps< typeof button >;

export function Button( { className, variant, ...props }: Props ) {
	return <button type="button" className={ cn( button( { variant } ), className ) } { ...props } />;
}
