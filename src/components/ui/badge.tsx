import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badge = cva( 'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em]', {
	variants: {
		tone: {
			neutral: 'border-[#E5E5E0] bg-[#F0F0EC] text-[#706F6A]',
			warn: 'border-[#FF5A1F] bg-[#FFE7DD] text-[#852400]',
			danger: 'border-[#FF5A1F] bg-[#FFE7DD] text-[#FF5A1F]',
			info: 'border-[#E5E5E0] bg-[#FAFAF7] text-[#111]',
			quiet: 'border-transparent bg-[#F0F0EC] text-[#706F6A]',
		},
	},
	defaultVariants: { tone: 'neutral' },
} );

type Props = React.HTMLAttributes< HTMLSpanElement > & VariantProps< typeof badge >;

export const Badge = ( { className, tone, ...props }: Props ) => (
	<span className={ cn( badge( { tone } ), className ) } { ...props } />
);
