import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IoGlobeOutline, IoLocationOutline, IoShieldCheckmarkOutline } from 'react-icons/io5';

const CANVAS = 'linear-gradient(180deg, #000000 0%, #23104F 100%)';

const FEATURES = [
  {
    icon: IoGlobeOutline,
    title: 'Global Location Switching',
    description:
      'Jump to any city, town, or venue instantly. You control the location, not a feed recommendation engine.',
  },
  {
    icon: IoShieldCheckmarkOutline,
    title: 'Zero Algorithmic Noise',
    description:
      'Pure chronological posts straight from real users, creators, and local automated feeds.',
  },
  {
    icon: IoLocationOutline,
    title: 'Hyperlocal Media & Events',
    description:
      'Immersive video cards, community news, weather updates, and gig guides mapped straight to the location.',
  },
] as const;

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen justify-center text-white" style={{ background: CANVAS }}>
      <div
        className="flex h-full w-full max-w-[430px] flex-col"
        style={{
          paddingTop: 'calc(12px + env(safe-area-inset-top))',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        <section
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-white/12"
          style={{ background: CANVAS }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pb-4 pt-7">
            <p className="mb-3.5 text-[13px] font-semibold tracking-[0.2px] text-white">
              ✨ No Algorithms. Just Places.
            </p>
            <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.3px] text-white">
              Explore Any Feed in the World
            </h1>
            <p className="mt-3 text-sm leading-[21px] text-[#E2E8F0]">
              Explore authentic stories, real-time events, and local media from any city, town, or
              venue on Earth—completely unfiltered.
            </p>

            <ul className="mt-7 space-y-[18px]">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li key={feature.title} className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/12">
                      <Icon size={20} color="#FFFFFF" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5">
                      <span className="mb-1 block text-[15px] font-semibold text-white">
                        {feature.title}
                      </span>
                      <span className="block text-[13px] leading-[18px] text-[#94A3B8]">
                        {feature.description}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-white/10 px-[22px] pb-5 pt-3">
            <button
              type="button"
              onClick={() => navigate('/login?mode=signup')}
              className="rounded-full bg-white py-3.5 text-[15px] font-bold text-black"
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => navigate('/login?mode=login')}
              className="rounded-full border border-white/28 bg-white/[0.04] py-[13px] text-sm font-semibold text-white"
            >
              Log in
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
