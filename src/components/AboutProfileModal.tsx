import React from 'react';
import { FiX, FiUser, FiEye } from 'react-icons/fi';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreateProfile: () => void;
};

export default function AboutProfileModal({ isOpen, onClose, onCreateProfile }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Card */}
      <div
        className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-labelledby="about-profile-title"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors z-10"
          aria-label="Close"
        >
          <FiX className="w-5 h-5" />
        </button>

        <div className="pt-6 pb-8 px-6 sm:px-8">
          {/* Illustration */}
          <div className="flex justify-center mb-6">
            <img
              src="/profile-cards/about-profile-people.png"
              alt=""
              className="w-full max-w-[280px] h-auto object-contain"
            />
          </div>

          <h2 id="about-profile-title" className="text-xl font-bold text-center text-gray-900 mb-6">
            About your profile
          </h2>

          <div className="space-y-4 mb-8">
            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <FiUser className="w-4 h-4 text-gray-600" />
              </div>
              <p className="text-sm text-gray-700 pt-0.5">
                Your profile is how you introduce yourself on Gazetteer.
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <FiEye className="w-4 h-4 text-gray-600" />
              </div>
              <p className="text-sm text-gray-700 pt-0.5">
                Users can see your profile and get to know a little more about you.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              onCreateProfile();
            }}
            className="w-full py-3 px-4 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            Create your profile
          </button>
        </div>
      </div>
    </div>
  );
}
