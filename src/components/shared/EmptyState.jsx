export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-gray-500" />
        </div>
      )}
      <div className="text-gray-300 font-medium mb-1">{title}</div>
      {description && <div className="text-sm text-gray-500 max-w-xs mb-4">{description}</div>}
      {action}
    </div>
  );
}