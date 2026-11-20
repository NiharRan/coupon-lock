import { Spinner } from '../components/ui/spinner';
import { RingsTable, type TableProps } from './overview';

export function Accounts( props: Omit< TableProps, 'data' > & { data: TableProps[ 'data' ] | null } ) {
	if ( ! props.data ) {
		return <Spinner />;
	}
	return <RingsTable { ...props } data={ props.data } />;
}
