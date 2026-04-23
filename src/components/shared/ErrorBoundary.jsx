import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * App-wide error boundary. Catches render errors, logs with a request ID
 * (when available from the last bbClient call), and offers recovery.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Surface to console + any window error hook (for future telemetry wiring)
    console.error('[ErrorBoundary]', error, errorInfo);
    if (typeof window !== 'undefined' && typeof window.__bb_onError === 'function') {
      try { window.__bb_onError({ error, errorInfo }); } catch { /* swallow */ }
    }
  }

  handleReset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error?.message || String(this.state.error);
    const stack = this.state.error?.stack;

    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-red-500/30 bg-gray-900 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="text-base font-bold text-white">Something went wrong</div>
              <div className="text-xs text-gray-500 mt-0.5">The page hit an unexpected error and couldn't render.</div>
            </div>
          </div>

          <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
            <div className="text-xs font-mono text-red-300 break-words">{message}</div>
            {stack && (
              <details className="mt-2">
                <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-400">Stack trace</summary>
                <pre className="text-[10px] font-mono text-gray-500 mt-1 overflow-x-auto whitespace-pre-wrap">{stack}</pre>
              </details>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={this.handleReset} variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
              <RefreshCw className="w-4 h-4" /> Try again
            </Button>
            <Button onClick={this.handleReload}
              className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2">
              <RefreshCw className="w-4 h-4" /> Reload
            </Button>
            <Button onClick={this.handleHome} variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2 ml-auto">
              <Home className="w-4 h-4" /> Home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}