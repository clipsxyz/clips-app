import React from 'react';
import { FiPlus } from 'react-icons/fi';

interface StoryHighlight {
  id: string;
  title: string;
  thumbnail: string;
  count: number;
}

interface StoryHighlightsProps {
  highlights: StoryHighlight[];
  onAddHighlight?: () => void;
  onHighlightClick?: (highlight: StoryHighlight) => void;
  isOwnProfile?: boolean;
}

export default function StoryHighlights({ 
  highlights, 
  onAddHighlight, 
  onHighlightClick,
  isOwnProfile = false 
}: StoryHighlightsProps) {
  if (highlights.length === 0 && !isOwnProfile) {
    return null;
  }

  return (
    <div className="px-4 py-3">
      <div className="flex gap-4 overflow-x-auto scrollbar-hide">
        {/* Add new highlight (only for own profile) */}
        {isOwnProfile && (
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <button
              onClick={onAddHighlight}
              className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
              aria-label="Add story highlight"
            >
              <FiPlus size={20} className="text-gray-400" />
            </button>
            <span className="text-xs text-gray-600 dark:text-gray-400 text-center">New</span>
          </div>
        )}

        {/* Existing highlights */}
        {highlights.map((highlight) => (
          <div key={highlight.id} className="flex flex-col items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onHighlightClick?.(highlight)}
              className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-gray-200 dark:ring-gray-700 hover:ring-gray-300 dark:hover:ring-gray-600 transition-colors"
              aria-label={`View ${highlight.title} highlight`}
            >
              <img
                src={highlight.thumbnail}
                alt={highlight.title}
                className="w-full h-full object-cover"
              />
              {highlight.count > 1 && (
                <div className="absolute bottom-0 right-0 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {highlight.count}
                </div>
              )}
            </button>
            <span className="text-xs text-gray-600 dark:text-gray-400 text-center max-w-16 truncate">
              {highlight.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

