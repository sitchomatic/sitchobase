import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function getPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export default function NotificationSettings() {
  const [permission, setPermission] = useState(getPermission);

  useEffect(() => {
    const sync = () => setPermission(getPermission());
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

  const request = async () => {
    if (permission === 'unsupported') return toast.error('Notifications not supported in this browser');
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') toast.success('Desktop notifications enabled');
    else if (result === 'denied') toast.error('Permission denied — enable it in your browser settings');
  };

  const test = () => {
    if (permission !== 'granted') return toast.error('Grant permission first');
    new Notification('BB Command Center test', { body: 'Fleet alerts will look like this.' });
  };

  const toneClass = permission === 'granted' ? 'text-emerald-400' : permission === 'denied' ? 'text-red-400' : 'text-gray-400';
  const label = {
    granted: 'Enabled — desktop notifications will fire on fleet alerts.',
    denied: 'Blocked — re-enable in your browser site settings.',
    default: 'Not yet asked — click below to enable.',
    unsupported: 'This browser does not support desktop notifications.',
  }[permission];
  const Icon = permission === 'granted' ? BellRing : permission === 'denied' ? BellOff : Bell;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
      <div className="text-sm font-semibold text-white flex items-center gap-2">
        <Icon className={`w-4 h-4 ${toneClass}`} /> Fleet Alert Notifications
      </div>
      <p className="text-xs text-gray-500">{label}</p>
      <div className="flex gap-2">
        <Button onClick={request} disabled={permission === 'granted' || permission === 'unsupported'} className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2">
          <Bell className="w-4 h-4" /> {permission === 'granted' ? 'Enabled' : 'Enable'}
        </Button>
        <Button onClick={test} disabled={permission !== 'granted'} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
          <BellRing className="w-4 h-4" /> Test
        </Button>
      </div>
    </div>
  );
}