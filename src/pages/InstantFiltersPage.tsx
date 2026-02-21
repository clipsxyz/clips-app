import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';

export default function InstantFiltersPage() {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: any };

  const videoUrl = state?.videoUrl as string | undefined;

  if (!videoUrl) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
        <p className="text-lg font-semibold">
          No video found.
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

  const goToCreate = () => {
    navigate('/create', {
      state: {
        videoUrl,
        videoDuration: state?.videoDuration,
        filterInfo: state?.filterInfo || {},
        filtered: state?.filtered,
        mediaType: state?.mediaType || 'video',
        musicTrackId: state?.musicTrackId
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-4">
      <h1 className="text-xl font-semibold mb-4">Preview</h1>
      <video
        className="max-w-[400px] w-full rounded-xl border border-white/10"
        src={videoUrl}
        controls
        autoPlay
        playsInline
      />
      <p className="mt-4 text-sm text-white/70 text-center max-w-md">
        Add filters and stickers on the next screen.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
        >
          <FiArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={goToCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white"
        >
          Next
          <FiArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

