import AuthorizedBulkRowItem from '@/components/authorizedBulk/AuthorizedBulkRowItem';

export default function AuthorizedBulkRows({ rows }) {
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      {rows.map((row) => <AuthorizedBulkRowItem key={row.index} row={row} />)}
    </div>
  );
}