import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiGlobe, FiMapPin, FiShield } from 'react-icons/fi';

const FEATURES = [
  {
    icon: FiGlobe,
    title: 'Global Location Switching',
    description:
      'Jump to any city, town, or venue instantly. You control the location, not a feed recommendation engine.',
  },
  {
    icon: FiShield,
    title: 'Zero Algorithmic Noise',
    description:
      'Pure chronological posts straight from real users, creators, and local automated feeds.',
  },
  {
    icon: FiMapPin,
    title: 'Hyperlocal Media & Events',
    description:
      'Immersive video cards, community news, weather updates, and gig guides mapped straight to the location.',
  },
] as const;

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#060d16] text-white">
      <div className="flex flex-1 items-center justify-center px-4 py-3 sm:px-6">
        <div
          className="flex h-full max-h-[920px] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/12 shadow-2xl"
          style={{
            background: 'linear-gradient(145deg, #0a0f1d 0%, #0d1b2a 55%, #0a1622 100%)',
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-7 pb-4 sm:px-6">
            <p className="mb-3.5 text-[13px] font-bold tracking-wide text-[#3d9b8f]">
              ✨ No Algorithms. Just Places.
            </p>
            <h1 className="text-[28px] font-extrabold leading-[1.2] tracking-tight text-white sm:text-[30px]">
              Explore Any Feed in the World
            </h1>
            <p className="mt-3 text-sm leading-[1.5] text-slate-300/80">
              Explore authentic stories, real-time events, and local media from any city, town, or
              venue on Earth—completely unfiltered.
            </p>

            <div className="mt-7 space-y-[18px]">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#3d9b8f]/30 bg-[#3d9b8f]/15">
                    <Icon className="h-5 w-5 text-[#3d9b8f]" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h2 className="mb-1 text-[15px] font-bold text-white">{title}</h2>
                    <p className="text-[13px] leading-[1.4] text-slate-400/90">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="shrink-0 space-y-2.5 border-t border-white/10 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
            <button
              type="button"
              onClick={() => navigate('/login?mode=signup')}
              className="w-full rounded-full bg-white py-3.5 text-[15px] font-bold text-[#0a0f1d] transition-colors hover:bg-gray-100"
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => navigate('/login?mode=login')}
              className="w-full rounded-full border border-white/30 bg-white/[0.04] py-3.5 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/10"
            >
              Log in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
