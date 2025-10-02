import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheck } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import ProfilePictureUpload from '../components/ProfilePictureUpload';

export default function EditProfilePage() {
  const nav = useNavigate();
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = React.useState({
    name: user?.name || '',
    username: user?.username || user?.id || '',
    bio: user?.bio || 'CEO Gossapp',
    website: user?.website || '',
    location: user?.location || 'Dublin, Ireland',
    profileImage: user?.profileImage || ''
  });
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update the user context with the new data
    updateUser({
      name: formData.name,
      username: formData.username,
      bio: formData.bio,
      website: formData.website,
      location: formData.location,
      profileImage: formData.profileImage
    });
    
    setIsSaving(false);
    nav(-1);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!user) {
    return (
      <div className="p-6">
        <p>Please sign in to edit your profile.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <button 
          onClick={() => nav(-1)}
          className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors"
          aria-label="Cancel"
        >
          <FiArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Edit Profile</h1>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white rounded-lg font-semibold transition-colors"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <FiCheck size={16} />
          )}
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Profile Picture */}
        <div className="flex flex-col items-center gap-4">
          <ProfilePictureUpload
            currentImage={formData.profileImage}
            onImageChange={(imageUrl) => handleInputChange('profileImage', imageUrl)}
            userName={formData.name}
          />
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            Tap to change your profile picture
          </p>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="Your name"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => {
                // Remove spaces and special characters, keep only letters, numbers, and underscores
                const cleanUsername = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                handleInputChange('username', cleanUsername);
              }}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="Username (letters, numbers, underscore only)"
              maxLength={30}
            />
            <div className="text-right text-sm text-gray-500 mt-1">
              {formData.username.length}/30
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              rows={3}
              maxLength={150}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
              placeholder="Tell people about yourself..."
            />
            <div className="text-right text-sm text-gray-500 mt-1">
              {formData.bio.length}/150
            </div>
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Website
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => handleInputChange('website', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="https://yourwebsite.com"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="Where are you based?"
            />
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
          <h3 className="text-lg font-semibold mb-4">Privacy Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Private Account</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Only followers can see your posts
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Activity Status</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Show when you're active
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

