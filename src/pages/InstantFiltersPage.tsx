import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

export default function InstantFiltersPage() {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: any };

  const videoUrl = state?.videoUrl as string | undefined;

  if (!videoUrl) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
        <p className="text-lg font-semibold">
          No video found for instant filters.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
        >
          <FiArrowLeft className="w-4 h-4" />
          <span>Go back</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-4">
      <h1 className="text-xl font-semibold mb-4">Instant Filters Preview</h1>
      <video
        className="max-w-[400px] w-full rounded-xl border border-white/10"
        src={videoUrl}
        controls
        autoPlay
        playsInline
      />
      <p className="mt-4 text-sm text-white/70 text-center max-w-md">
        This is a simplified instant-filters preview screen so the app can run
        safely. We can add more editing controls here later.
      </p>
    </div>
  );
}

