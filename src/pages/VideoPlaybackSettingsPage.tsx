import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronLeft } from 'react-icons/fi';
import { getGlobalVideoMuted, setGlobalVideoMuted } from '../utils/globalVideoMute';

type FeedAutoplayPref = 'always' | 'wifi' | 'never';
const FEED_AUTOPLAY_PREF_KEY = 'clips:feedAutoplayPref';
const FEED_AUTOPLAY_PREF_EVENT = 'feedAutoplayPrefChanged';

const AUTOPLAY_OPTIONS: { id: FeedAutoplayPref; label: string; hint: string }[] = [
  { id: 'always', label: 'Always', hint: 'Autoplay on Wi-Fi and cellular' },
  { id: 'wifi', label: 'Wi-Fi only', hint: 'Autoplay when connected to Wi-Fi' },
  { id: 'never', label: 'Never', hint: 'Show the cover. Tap a video to play it' },
];

function readAutoplayPref(): FeedAutoplayPref {
  try {
    const raw = localStorage.getItem(FEED_AUTOPLAY_PREF_KEY);
    if (raw === 'always' || raw === 'wifi' || raw === 'never') return raw;
  } catch {
    /* ignore */
  }
  return 'wifi';
}

function connectionLabel(): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Offline. Wi-Fi only autoplay stays paused';
  }
  const type = (navigator as Navigator & { connection?: { type?: string } }).connection?.type;
  if (type === 'wifi') return 'Connected via Wi-Fi';
  if (type === 'cellular') return 'Connected via cellular';
  if (type === 'ethernet') return 'Connected via Ethernet';
  if (type) return `Connection: ${type}`;
  return typeof navigator !== 'undefined' && navigator.onLine ? 'Connected' : 'Connection unknown';
}

export default function VideoPlaybackSettingsPage() {
  const nav = useNavigate();
  const [autoplayPref, setAutoplayPref] = React.useState<FeedAutoplayPref>(readAutoplayPref);
  const [muted, setMuted] = React.useState(true);
  const [networkLabel, setNetworkLabel] = React.useState('Checking connection…');

  React.useEffect(() => {
    setMuted(getGlobalVideoMuted());
    setNetworkLabel(connectionLabel());
    const onChange = () => setNetworkLabel(connectionLabel());
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    return () => {
      window.removeEventListener('online', onChange);
      window.removeEventListener('offline', onChange);
    };
  }, []);

  const selectAutoplay = (pref: FeedAutoplayPref) => {
    setAutoplayPref(pref);
    try {
      localStorage.setItem(FEED_AUTOPLAY_PREF_KEY, pref);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(FEED_AUTOPLAY_PREF_EVENT, { detail: { pref } }));
  };

  const toggleMuted = () => {
    const next = !muted;
    setMuted(next);
    setGlobalVideoMuted(next);
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white">
      <div className="flex items-center justify-between px-2 py-2.5">
        <button type="button" onClick={() => nav(-1)} aria-label="Back" className="flex h-10 w-10 items-center justify-center">
          <FiChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <h1 className="text-lg font-bold">Video playback</h1>
        <div className="h-10 w-10" />
      </div>
      <div className="space-y-3 px-4 pb-8">
        <section className="space-y-2 rounded-2xl border border-[#2A2F3D] bg-[#161B22] p-3.5">
          <p className="text-xs font-bold uppercase tracking-[0.6px] text-[#8B949E]">Feed autoplay</p>
          <p className="text-sm leading-5 text-[#C9D1D9]">Choose when videos in the home feed play as you scroll.</p>
          <p className="text-[13px] font-semibold text-[#F472B6]">{networkLabel}</p>
          <div className="space-y-2">
            {AUTOPLAY_OPTIONS.map((option) => {
              const active = autoplayPref === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => selectAutoplay(option.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border bg-[#0B0E14] px-3 py-3 text-left ${active ? 'border-[rgba(244,114,182,0.7)]' : 'border-[#2A2F3D]'}`}
                >
                  <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${active ? 'border-[#F472B6]' : 'border-[#8B949E]'}`}>
                    {active ? <span className="h-2 w-2 rounded-full bg-[#F472B6]" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-white">{option.label}</span>
                    <span className="mt-0.5 block text-[13px] leading-[18px] text-[#8B949E]">{option.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="rounded-2xl border border-[#2A2F3D] bg-[#161B22] p-3.5">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.6px] text-[#8B949E]">Mute videos</p>
              <p className="mt-2 text-sm leading-5 text-[#C9D1D9]">
                On means feed, stories, and scenes start silent. You can still unmute a single video.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={muted}
              aria-label="Mute videos"
              onClick={toggleMuted}
              className={`flex h-[26px] w-[46px] shrink-0 items-center rounded-full px-[3px] ${muted ? 'justify-end bg-[#d91b5c]' : 'justify-start bg-[#30363D]'}`}
            >
              <span className="h-5 w-5 rounded-full bg-white" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
