import AuthorizedBulkRunResultItem from '@/components/authorizedBulk/AuthorizedBulkRunResultItem';

export default function AuthorizedBulkRunResults({ results = [] }) {
  if (!results.length) {
    return <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center text-sm text-gray-500">No saved row results yet.</div>;
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 text-sm font-semibold text-white">Saved Results</div>
      <div className="divide-y divide-gray-800/70">
        {results.map((row) => <AuthorizedBulkRunResultItem key={`${row.index}-${row.username}`} row={row} />)}
      </div>
    </div>
  );
}