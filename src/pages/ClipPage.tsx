import React from 'react';
import { useAuth } from '../context/Auth';
import { FiCamera, FiMapPin, FiVideo } from 'react-icons/fi';

export default function ClipPage() {
  const { user } = useAuth();
  const [text, setText] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [mediaFile, setMediaFile] = React.useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = React.useState<string | null>(null);
  const [isVideo, setIsVideo] = React.useState(false);

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaFile(file);
    setIsVideo(file.type.startsWith('video/'));
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setMediaPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Story submitted:', { text, location, mediaFile });
    alert('Story shared! (Check console for data)');
  };

  return (
    <div className="mx-auto max-w-md min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="px-4 h-11 flex items-center justify-between">
          <span className="font-semibold">Create Story</span>
          <button 
            onClick={handleSubmit}
            className="px-3 py-1.5 rounded bg-brand-600 text-white text-sm font-medium"
          >
            Post
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Username */}
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {user?.name || 'darraghdublin'}
        </div>

        {/* Media Upload Area */}
        <div className="relative">
          <div className="relative w-full aspect-square rounded-xl border-2 border-gray-300 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900">
            {mediaPreview ? (
              <div className="relative w-full h-full">
                {isVideo ? (
                  <video 
                    src={mediaPreview} 
                    className="w-full h-full object-cover"
                    controls
                  />
                ) : (
                  <img 
                    src={mediaPreview} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                )}
                {/* Diagonal line overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line x1="0" y1="100" x2="100" y2="0" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full border-2 border-gray-300 dark:border-gray-700 flex items-center justify-center mb-4">
                  <FiCamera className="w-8 h-8 text-gray-400" />
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  Tap to add photo or video
                </div>
              </div>
            )}
            
            {/* Hidden file input */}
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleMediaUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          {/* Video duration indicator */}
          {isVideo && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 text-white px-2 py-1 rounded text-xs">
              <FiVideo className="w-3 h-3" />
              <span>30s</span>
            </div>
          )}
        </div>

        {/* Text Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Story Text
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Input Story Text"
            className="w-full h-32 p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {/* Location Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Location
          </label>
          <div className="relative">
            <FiMapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add Story Location"
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!text.trim() && !mediaFile}
          className="w-full py-3 rounded-lg bg-brand-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-700 transition-colors"
        >
          Share Story
        </button>
      </div>
    </div>
  );
}