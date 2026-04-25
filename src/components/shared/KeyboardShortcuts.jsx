/**
 * Global keyboard shortcuts (#32).
 *   g d  — Dashboard
 *   g s  — Sessions
 *   g j  — Joe Ignite
 *   g t  — Status
 *   ?    — Show help
 *   /    — Focus search (if present)
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

const ROUTES = {
  d: '/',
  s: '/sessions',
  b: '/bulk',
  a: '/audit',
  h: '/health',
  t: '/status',
  r: '/reports',
  p: '/proxies',
  f: '/fleet',
  m: '/monitor',
};

export default function KeyboardShortcuts() {
  const nav = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const [prefix, setPrefix] = useState(null);
  const [prefixAt, setPrefixAt] = useState(0);

  useEffect(() => {
    const onKey = (e) => {
      // Ignore while typing in inputs
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?') { setHelpOpen(true); return; }
      if (e.key === '/') {
        const el = document.querySelector('input[placeholder*="earch"]');
        if (el) { e.preventDefault(); el.focus(); }
        return;
      }
      if (e.key === 'g') {
        setPrefix('g');
        setPrefixAt(Date.now());
        return;
      }
      if (prefix === 'g' && Date.now() - prefixAt < 1500) {
        const route = ROUTES[e.key];
        if (route) { nav(route); setPrefix(null); }
        return;
      }
      setPrefix(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav, prefix, prefixAt]);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="bg-gray-900 border-gray-800 text-gray-200 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Keyboard className="w-4 h-4" /> Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          {[
            ['g d', 'Go to Dashboard'],
            ['g s', 'Go to Sessions'],
            ['g b', 'Go to Authorized QA'],
            ['g f', 'Go to Fleet Launcher'],
            ['g p', 'Go to Proxies'],
            ['g r', 'Go to Test Reports'],
            ['g m', 'Go to Monitor'],
            ['g a', 'Go to Audit Log'],
            ['g h', 'Go to Health Checklist'],
            ['g t', 'Go to Status'],
            ['/', 'Focus search'],
            ['?', 'Show this help'],
          ].map(([k, label]) => (
            <div key={k} className="flex justify-between py-1 border-b border-gray-800/60">
              <span className="text-gray-400">{label}</span>
              <code className="bg-gray-800 px-1.5 rounded text-xs text-emerald-400">{k}</code>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}