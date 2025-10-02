import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiMapPin, FiGlobe, FiCamera, FiCheck, FiSkipForward, FiEdit3, FiArrowRight } from 'react-icons/fi';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import Logo from '../components/Logo';
import { cn } from '../utils/cn';
import { useAuth } from '../context/Auth';

interface BioData {
  bio: string;
  website: string;
  location: string;
  profileImage?: string;
}

export default function CompleteBioPage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [bioData, setBioData] = useState<BioData>({
    bio: '',
    website: '',
    location: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (bioData.website && !bioData.website.match(/^https?:\/\/.+/)) {
      newErrors.website = 'Please enter a valid URL (starting with http:// or https://)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Update user profile with bio information
      const updates = {
        bio: bioData.bio.trim() || undefined,
        website: bioData.website.trim() || undefined,
        location: bioData.location.trim() || undefined,
      };

      // Remove empty fields
      Object.keys(updates).forEach(key => {
        if (!updates[key as keyof typeof updates]) {
          delete updates[key as keyof typeof updates];
        }
      });

      // Update user context
      updateUser(updates);

      // TODO: Send updates to API
      console.log('Bio updates:', updates);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Navigate to feed with success
      navigate('/feed', { 
        state: { message: 'Welcome to Gossapp! Your profile is ready.' }
      });
    } catch (error) {
      setErrors({ submit: 'Failed to update profile. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/feed', { 
      state: { message: 'Welcome to Gossapp! You can complete your profile later.' }
    });
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // TODO: Implement image upload
      console.log('Image upload:', file);
      // For demo, just show that something happened
      setBioData({ ...bioData, profileImage: URL.createObjectURL(file) });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-40 h-40 bg-gradient-to-r from-indigo-400/20 to-purple-400/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-1/4 -right-20 w-32 h-32 bg-gradient-to-r from-pink-400/20 to-rose-400/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md animate-fade-in-up">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <Logo size="md" animated />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Complete Your Profile
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Tell the community a bit about yourself
            </p>
          </div>

          {/* Welcome Message */}
          <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <FiCheck size={16} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-green-800 dark:text-green-200">
                  Account Created Successfully!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Welcome to Gossapp, {user?.name}! 🎉
                </p>
              </div>
            </div>
          </div>

          {/* Profile Picture Upload */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              <FiCamera className="inline mr-2" size={16} />
              Profile Picture <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg overflow-hidden">
                  {bioData.profileImage ? (
                    <img 
                      src={bioData.profileImage} 
                      alt="Profile preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user?.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <button
                  onClick={() => document.getElementById('image-upload')?.click()}
                  className="absolute -bottom-1 -right-1 w-7 h-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110"
                >
                  <FiCamera size={12} />
                </button>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Upload a photo to help others recognize you
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('image-upload')?.click()}
                  className="mt-2"
                >
                  Choose Photo
                </Button>
              </div>
            </div>
          </div>

          {/* Bio Form */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <FiEdit3 className="inline mr-2" size={16} />
                Bio <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <textarea
                placeholder="Tell people a bit about yourself..."
                value={bioData.bio}
                onChange={(e) => setBioData({ ...bioData, bio: e.target.value })}
                rows={3}
                maxLength={160}
                className={cn(
                  'w-full px-4 py-3 rounded-xl border transition-all duration-200 resize-none',
                  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                  'border-gray-300 dark:border-gray-600',
                  'focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                  'placeholder-gray-500 dark:placeholder-gray-400'
                )}
              />
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
                {bioData.bio.length}/160 characters
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <FiGlobe className="inline mr-2" size={16} />
                Website <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                type="url"
                placeholder="https://your-website.com"
                value={bioData.website}
                onChange={(e) => setBioData({ ...bioData, website: e.target.value })}
                className={cn(
                  'w-full px-4 py-3 rounded-xl border transition-all duration-200',
                  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                  'border-gray-300 dark:border-gray-600',
                  'focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                  'placeholder-gray-500 dark:placeholder-gray-400',
                  errors.website && 'border-red-500 dark:border-red-400'
                )}
              />
              {errors.website && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.website}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <FiMapPin className="inline mr-2" size={16} />
                Location <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="City, Country"
                value={bioData.location}
                onChange={(e) => setBioData({ ...bioData, location: e.target.value })}
                className={cn(
                  'w-full px-4 py-3 rounded-xl border transition-all duration-200',
                  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                  'border-gray-300 dark:border-gray-600',
                  'focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                  'placeholder-gray-500 dark:placeholder-gray-400'
                )}
              />
            </div>

            {errors.submit && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-8">
            <Button
              variant="secondary"
              onClick={handleSkip}
              className="flex-1 hover-scale"
              leftIcon={<FiSkipForward size={16} />}
            >
              Skip for Now
            </Button>

            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={isLoading}
              className="flex-1 hover-scale"
              rightIcon={
                !isLoading ? (
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center ml-2">
                    <FiArrowRight size={14} />
                  </div>
                ) : undefined
              }
            >
              {isLoading ? 'Saving Profile...' : 'Complete Profile'}
            </Button>
          </div>

          {/* Helpful Info */}
          <div className="text-center mt-6">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              You can always update your profile information later in settings
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
