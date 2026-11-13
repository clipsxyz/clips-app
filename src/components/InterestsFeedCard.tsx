import React from 'react';
import { FiX } from 'react-icons/fi';
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
  const saveDisabled = saving || selected.length === 0;

  return (
    <article className="relative mx-2.5 mb-3 overflow-hidden rounded-2xl border border-white/15 bg-black">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, #000000 0%, #23104F 100%)' }}
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-start gap-2 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white">Your interests</h2>
            <p className="mt-1 text-xs leading-[17px] text-[#9CA3AF]">
              Optional — pick up to {MAX_INTEREST_SELECTIONS} for your profile. Your feed stays based on location.
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="shrink-0 p-1.5 text-[#9CA3AF]"
            aria-label="Skip for now"
          >
            <FiX className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {INTEREST_OPTIONS.map((interest) => {
            const isSelected = selected.includes(interest);
            const disabled = !isSelected && atMax;
            return (
              <button
                key={interest}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(interest)}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  isSelected
                    ? 'border-[#8ab4ff] bg-[#8ab4ff]/15 text-[#dce9ff]'
                    : 'border-white/20 text-[#D1D5DB]'
                } ${disabled ? 'opacity-[0.45]' : ''}`}
              >
                {interest}
              </button>
            );
          })}
        </div>
        <p className="px-4 pt-2.5 text-[11px] text-[#6B7280]">
          {selected.length} of {MAX_INTEREST_SELECTIONS} selected
          {atMax ? " — you're all set." : ''}
        </p>

        <div className="flex gap-2 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 rounded-xl border border-white/20 py-2.5 text-sm font-medium text-[#D1D5DB]"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled}
            className={`flex flex-1 items-center justify-center rounded-xl bg-white py-2.5 text-sm font-semibold text-[#111827] ${
              saveDisabled ? 'opacity-50' : ''
            }`}
          >
            {saving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#111827] border-t-transparent" aria-label="Saving" />
            ) : atMax ? (
              'Done'
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
