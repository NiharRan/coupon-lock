import { cn } from '../../lib/utils';

const field =
	'h-9 rounded border border-[#E5E5E0] bg-white px-3 text-[13px] leading-none text-[#111] placeholder:text-[#9A9A93] hover:border-[#111] focus-visible:border-[#111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]';

export const Input = ( { className, ...props }: React.InputHTMLAttributes< HTMLInputElement > ) => <input className={ cn( field, className ) } { ...props } />;
export const Select = ( { className, ...props }: React.SelectHTMLAttributes< HTMLSelectElement > ) => <select className={ cn( field, 'pr-8', className ) } { ...props } />;
