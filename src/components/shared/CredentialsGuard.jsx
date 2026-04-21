import { Link } from 'react-router-dom';
import { Settings, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CredentialsGuard() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
      <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-yellow-400" />
      </div>
      <div className="text-lg font-semibold text-white">API Credentials Required</div>
      <p className="text-gray-400 text-sm max-w-xs text-center">
        Configure your Browserbase API Key and Project ID in Settings to start using the Command Center.
      </p>
      <Link to="/settings">
        <Button className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2">
          <Settings className="w-4 h-4" /> Go to Settings
        </Button>
      </Link>
    </div>
  );
}