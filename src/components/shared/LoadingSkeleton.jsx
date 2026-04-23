/**
 * Minimal loading skeletons (#31). Replaces spinners in key places for a
 * less-flickery perceived load.
 */
export function SkeletonRow({ className = '' }) {
  return (
    <div className={`h-4 bg-gray-800 rounded animate-pulse ${className}`} />
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3 ${className}`}>
      <SkeletonRow className="w-1/3" />
      <SkeletonRow className="w-2/3" />
      <SkeletonRow className="w-1/2" />
    </div>
  );
}

export function SkeletonList({ rows = 6 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border border-gray-800/40 rounded">
          <div className="w-4 h-4 rounded-full bg-gray-800 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <SkeletonRow className="w-1/2" />
            <SkeletonRow className="w-1/3 h-3" />
          </div>
          <SkeletonRow className="w-16 h-3" />
        </div>
      ))}
    </div>
  );
}