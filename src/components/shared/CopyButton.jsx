import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Tiny copy-to-clipboard button (#46).
 */
export default function CopyButton({ text, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false);
  const onClick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error('Copy failed');
    }
  };
  return (
    <button
      onClick={onClick}
      title={`Copy ${label.toLowerCase()}`}
      aria-label={`Copy ${label.toLowerCase()}`}
      className={`inline-flex items-center justify-center w-5 h-5 rounded hover:bg-gray-700/50 text-gray-500 hover:text-gray-200 transition-colors ${className}`}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}