import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

const field =
	'h-9 rounded border border-[#E5E5E0] bg-white px-3 text-[13px] leading-none text-[#111] placeholder:text-[#9A9A93] hover:border-[#111] focus-visible:border-[#111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]';

export const Input = ( { className, ...props }: React.InputHTMLAttributes< HTMLInputElement > ) => <input className={ cn( field, className ) } { ...props } />;
export const Select = ( { className, ...props }: React.SelectHTMLAttributes< HTMLSelectElement > ) => <select className={ cn( field, 'pr-8', className ) } { ...props } />;

/** Icon sits in the flex row beside a borderless input, so wp-admin input padding can never overlap it. */
export const SearchInput = ( { className, ...props }: React.InputHTMLAttributes< HTMLInputElement > ) => (
	<div className={ cn( 'flex h-9 items-center gap-2 rounded border border-[#E5E5E0] bg-white px-3 hover:border-[#111] focus-within:border-[#111] focus-within:ring-2 focus-within:ring-[#FF5A1F]', className ) }>
		<Search size={ 16 } className="text-[#706F6A]" aria-hidden="true" />
		<input type="search" className="m-0 h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] leading-none text-[#111] outline-none placeholder:text-[#9A9A93]" { ...props } />
	</div>
);
