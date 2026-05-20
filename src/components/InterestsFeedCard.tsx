import React from 'react';
import { FiX } from 'react-icons/fi';
import DiscoverAmbientCanvas from './DiscoverAmbientCanvas';
import { INTEREST_OPTIONS, MAX_INTEREST_SELECTIONS } from '../constants/interestOptions';

type Props = {
  selected: string[];
  onToggle: (interest: string) => void;
  onSave: () => void;
  onSkip: () => void;
  saving?: boolean;
};

/** In-feed onboarding — pick up to 5 interests; card is removed after save. */
export default function InterestsFeedCard({ selected, onToggle, onSave, onSkip, saving = false }: Props) {
  const atMax = selected.length >= MAX_INTEREST_SELECTIONS;

  return (
    <article className="relative mx-2.5 mb-3 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0711] shadow-lg">
      <DiscoverAmbientCanvas fixed={false} />

      <div className="relative z-[2]">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
          <h2 className="text-base font-semibold text-white">Your interests</h2>
          <p className="mt-1 text-xs text-gray-400">
            Optional — pick up to {MAX_INTEREST_SELECTIONS} for your profile. Your feed stays based on location.
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="shrink-0 rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white"
          aria-label="Skip for now"
        >
          <FiX className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((interest) => {
            const isSelected = selected.includes(interest);
            const disabled = !isSelected && atMax;
            return (
              <button
                key={interest}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(interest)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  isSelected
                    ? 'border-[#8ab4ff] bg-[#8ab4ff]/15 text-[#dce9ff]'
                    : disabled
                      ? 'border-white/10 text-gray-600 cursor-not-allowed'
                      : 'border-white/20 text-gray-300 hover:border-white/40'
                }`}
              >
                {interest}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-gray-500">
          {selected.length} of {MAX_INTEREST_SELECTIONS} selected
          {atMax ? ' — you&apos;re all set.' : ''}
        </p>
      </div>

      <div className="flex gap-2 border-t border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/5"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || selected.length === 0}
          className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : atMax ? 'Done' : 'Save'}
        </button>
      </div>
      </div>
    </article>
  );
}
