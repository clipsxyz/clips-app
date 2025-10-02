import React from 'react';
import { FiCamera, FiX } from 'react-icons/fi';

interface ProfilePictureUploadProps {
  currentImage?: string;
  onImageChange: (imageUrl: string) => void;
  userName: string;
}

export default function ProfilePictureUpload({ currentImage, onImageChange, userName }: ProfilePictureUploadProps) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [showFullImage, setShowFullImage] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setIsUploading(true);
    
    try {
      // Create object URL for preview
      const imageUrl = URL.createObjectURL(file);
      
      // In a real app, you'd upload to a server here
      // For now, we'll just use the object URL
      onImageChange(imageUrl);
      
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const generateGradientAvatar = (name: string) => {
    const colors = [
      'from-blue-500 to-purple-600',
      'from-green-500 to-teal-600',
      'from-pink-500 to-rose-600',
      'from-yellow-500 to-orange-600',
      'from-indigo-500 to-blue-600',
      'from-red-500 to-pink-600'
    ];
    
    const colorIndex = name.charCodeAt(0) % colors.length;
    return colors[colorIndex];
  };

  const gradientClass = generateGradientAvatar(userName);

  return (
    <>
      <div className="relative group">
        <div 
          className="w-20 h-20 rounded-full overflow-hidden cursor-pointer relative"
          onClick={() => currentImage ? setShowFullImage(true) : triggerFileSelect()}
        >
          {currentImage ? (
            <img
              src={currentImage}
              alt={`${userName}'s profile`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white text-2xl font-bold`}>
              {userName.slice(0, 1).toUpperCase()}
            </div>
          )}
          
          {/* Upload overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <FiCamera className="text-white" size={20} />
          </div>
          
          {/* Loading overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Upload button */}
        <button
          onClick={triggerFileSelect}
          disabled={isUploading}
          className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
          aria-label="Change profile picture"
        >
          <FiCamera size={14} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Full image modal */}
      {showFullImage && currentImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-sm max-h-full">
            <img
              src={currentImage}
              alt={`${userName}'s profile`}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

