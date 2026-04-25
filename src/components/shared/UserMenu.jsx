import { useState } from 'react';
import { LogOut, User as UserIcon, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

export default function UserMenu({ collapsed = false }) {
  const { user, logout } = useAuth() || {};
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const name = user.display_name || user.full_name || user.email;
  const initials = String(name || '?').slice(0, 1).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-gray-300 hover:bg-gray-800 transition-colors',
          collapsed && 'justify-center'
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 text-xs font-bold flex-shrink-0">
          {initials}
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-xs font-medium text-gray-200 truncate">{name}</div>
              <div className="text-[10px] text-gray-500 truncate">{user.role || 'user'}</div>
            </div>
            <ChevronDown className={cn('w-3 h-3 text-gray-500 transition-transform', open && 'rotate-180')} />
          </>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-2 z-40 rounded-lg border border-gray-800 bg-gray-900 shadow-xl shadow-black/60 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-800">
              <div className="text-xs font-medium text-gray-200 truncate">{name}</div>
              <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
            </div>
            <a
              href="/settings"
              className="flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <UserIcon className="w-3.5 h-3.5" /> Profile & Settings
            </a>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout?.();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}