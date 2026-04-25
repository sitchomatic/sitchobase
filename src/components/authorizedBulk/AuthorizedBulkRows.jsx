import AuthorizedBulkRowItem from '@/components/authorizedBulk/AuthorizedBulkRowItem';
import WindowedList from '@/components/shared/WindowedList';

export default function AuthorizedBulkRows({ rows }) {
  if (!rows.length) return null;
  return (
    <WindowedList
      items={rows}
      rowHeight={82}
      className="max-h-[70vh] overflow-auto pr-1"
      renderRow={(row) => (
        <div key={row.index} className="pb-2">
          <AuthorizedBulkRowItem row={row} />
        </div>
      )}
    />
  );
}