import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Download, Film, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

/**
 * Browserbase /recording returns either:
 *  - { url: string }            → direct video file
 *  - { data: [...rrweb events] } → rrweb event array
 *  - array of rrweb events directly
 */
export default function SessionRecordingPlayer({ recording, evidence, loading }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Determine recording type
  const videoUrl = recording?.url || (typeof recording === 'string' ? recording : null);
  const rrwebEvents = recording?.data ?? (Array.isArray(recording) ? recording : null);
  const inspectorUrl = evidence?.recordingUrl;
  const hasRecording = !!(videoUrl || rrwebEvents || inspectorUrl);

  // Video element sync
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTime = () => {
      setCurrentTime(vid.currentTime);
      setProgress(vid.duration ? (vid.currentTime / vid.duration) * 100 : 0);
    };
    const onMeta = () => setDuration(vid.duration);
    const onEnded = () => setPlaying(false);
    vid.addEventListener('timeupdate', onTime);
    vid.addEventListener('loadedmetadata', onMeta);
    vid.addEventListener('ended', onEnded);
    return () => {
      vid.removeEventListener('timeupdate', onTime);
      vid.removeEventListener('loadedmetadata', onMeta);
      vid.removeEventListener('ended', onEnded);
    };
  }, [videoUrl]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (playing) { vid.pause(); setPlaying(false); }
    else { vid.play(); setPlaying(true); }
  };

  const restart = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = 0;
    vid.play();
    setPlaying(true);
  };

  const seek = ([val]) => {
    const vid = videoRef.current;
    if (!vid || !duration) return;
    vid.currentTime = (val / 100) * duration;
    setProgress(val);
  };

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        <span className="text-xs">Loading recording…</span>
      </div>
    );
  }

  if (!hasRecording) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-600">
        <Film className="w-8 h-8 opacity-30" />
        <div className="text-xs text-center">
          No Browserbase recording file is available for this session.<br />
          <span className="text-gray-700">Use the failure replay panel above and the live CDP / Network tabs for full debugging.</span>
        </div>
      </div>
    );
  }

  if (inspectorUrl && !videoUrl && !rrwebEvents) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          Browserbase recording evidence is linked for this automation session.
        </div>
        <iframe
          src={`${inspectorUrl}?embed=true`}
          title="Browserbase Session Inspector"
          className="w-full h-72 rounded-lg border border-gray-800 bg-black"
        />
        <a href={inspectorUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 gap-2 text-xs">
            <ExternalLink className="w-3.5 h-3.5" /> Open Browserbase Inspector
          </Button>
        </a>
      </div>
    );
  }

  // ── Video file player ──────────────────────────────────────────────────────
  if (videoUrl) {
    return (
      <div className="space-y-3">
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            preload="metadata"
          />
          {/* Overlay play button when paused */}
          {!playing && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/20 transition-all">
                <Play className="w-5 h-5 text-white ml-0.5" />
              </div>
            </button>
          )}
        </div>

        {/* Controls bar */}
        <div className="bg-gray-800/80 rounded-lg px-3 py-2.5 space-y-2">
          <Slider
            min={0} max={100} step={0.1}
            value={[progress]}
            onValueChange={seek}
            className="w-full"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost"
                onClick={togglePlay}
                className="w-7 h-7 text-gray-300 hover:text-white hover:bg-gray-700">
                {playing
                  ? <Pause className="w-3.5 h-3.5" />
                  : <Play className="w-3.5 h-3.5" />}
              </Button>
              <Button size="icon" variant="ghost"
                onClick={restart}
                className="w-7 h-7 text-gray-400 hover:text-white hover:bg-gray-700">
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs text-gray-400 ml-1 font-mono tabular-nums">
                {fmt(currentTime)} / {fmt(duration)}
              </span>
            </div>
            <a href={videoUrl} download target="_blank" rel="noopener noreferrer">
              <Button size="icon" variant="ghost"
                className="w-7 h-7 text-gray-400 hover:text-white hover:bg-gray-700">
                <Download className="w-3.5 h-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── rrweb event dump (no built-in rrweb player available) ──────────────────
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2.5">
        <AlertCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-300 leading-relaxed">
          This session recorded <strong>{rrwebEvents.length}</strong> DOM events (rrweb format).
          A full in-browser replay requires the rrweb player library. Raw events shown below.
        </p>
      </div>
      <div className="bg-gray-800 rounded-lg p-3 max-h-64 overflow-y-auto">
        <div className="space-y-1 font-mono text-xs text-gray-400">
          {rrwebEvents.slice(0, 100).map((ev, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-gray-600 flex-shrink-0 w-8 text-right">{i + 1}</span>
              <span className="truncate">
                t={ev.timestamp ?? '?'} type={ev.type ?? '?'}
                {ev.data?.source !== undefined ? ` src=${ev.data.source}` : ''}
              </span>
            </div>
          ))}
          {rrwebEvents.length > 100 && (
            <div className="text-gray-600 text-center pt-1">… {rrwebEvents.length - 100} more events</div>
          )}
        </div>
      </div>
    </div>
  );
}