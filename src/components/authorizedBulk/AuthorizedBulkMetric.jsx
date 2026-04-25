export default function AuthorizedBulkMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold text-white mt-1">{value}</div>
    </div>
  );
}