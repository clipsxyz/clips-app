import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMapPin, FiGlobe, FiUser, FiMail, FiLock, FiPhone, FiArrowLeft, FiArrowRight, FiCheck, FiChevronRight } from 'react-icons/fi';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import Logo from '../components/Logo';
import { cn } from '../utils/cn';
import { useAuth } from '../context/Auth';

interface LocationData {
  local: string;
  regional: string;
  national: string;
}

interface UserData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form data
  const [locationData, setLocationData] = useState<LocationData>({
    local: '',
    regional: '',
    national: '',
  });

  const [userData, setUserData] = useState<UserData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });

  // Validation functions
  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!locationData.local.trim()) {
      newErrors.local = 'Local region is required';
    }
    if (!locationData.regional.trim()) {
      newErrors.regional = 'Regional area is required';
    }
    if (!locationData.national.trim()) {
      newErrors.national = 'National area is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!userData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!userData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(userData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!userData.password) {
      newErrors.password = 'Password is required';
    } else if (userData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (userData.password !== userData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (userData.phone && !/^\+?[\d\s\-\(\)]+$/.test(userData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigation handlers
  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else {
      navigate('/login');
    }
  };

  // Form submission
  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setIsLoading(true);
    try {
      // Create user account with location preferences
      const signupData = {
        ...userData,
        username: userData.email.split('@')[0], // Generate username from email
        locationPreferences: locationData,
      };

      // TODO: Replace with actual API call
      console.log('Signup data:', signupData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For demo, just login with the name
      await login({
        login: userData.email,
        password: userData.password,
      });
      
      // Store location preferences in localStorage for demo
      localStorage.setItem('userLocationPreferences', JSON.stringify(locationData));
      
      // Redirect to bio completion page
      navigate('/profile/complete-bio');
    } catch (error) {
      setErrors({ submit: 'Failed to create account. Please try again.' });
    } finally {
      setIsLoading(false);
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
              Join Gossapp
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {currentStep === 1 
                ? 'Tell us about your location for personalized feeds'
                : 'Complete your profile to get started'
              }
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-4">
              {/* Step 1 */}
              <div className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200',
                currentStep >= 1 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              )}>
                {currentStep > 1 ? <FiCheck size={16} /> : '1'}
              </div>
              
              {/* Connector */}
              <div className={cn(
                'w-12 h-1 rounded-full transition-all duration-200',
                currentStep >= 2 
                  ? 'bg-indigo-600' 
                  : 'bg-gray-200 dark:bg-gray-700'
              )} />
              
              {/* Step 2 */}
              <div className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200',
                currentStep >= 2 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              )}>
                2
              </div>
            </div>
          </div>

          {/* Step 1: Location Setup */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <FiMapPin className="inline mr-2" size={16} />
                  Local Region
                </label>
                <input
                  type="text"
                  placeholder="e.g., Finglas, Manhattan, Camden"
                  value={locationData.local}
                  onChange={(e) => setLocationData({ ...locationData, local: e.target.value })}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border transition-all duration-200',
                    'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                    'border-gray-300 dark:border-gray-600',
                    'focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                    'placeholder-gray-500 dark:placeholder-gray-400',
                    errors.local && 'border-red-500 dark:border-red-400'
                  )}
                />
                {errors.local && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.local}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <FiGlobe className="inline mr-2" size={16} />
                  Regional Area
                </label>
                <input
                  type="text"
                  placeholder="e.g., Dublin, New York, London"
                  value={locationData.regional}
                  onChange={(e) => setLocationData({ ...locationData, regional: e.target.value })}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border transition-all duration-200',
                    'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                    'border-gray-300 dark:border-gray-600',
                    'focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                    'placeholder-gray-500 dark:placeholder-gray-400',
                    errors.regional && 'border-red-500 dark:border-red-400'
                  )}
                />
                {errors.regional && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.regional}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <FiGlobe className="inline mr-2" size={16} />
                  National Area
                </label>
                <input
                  type="text"
                  placeholder="e.g., Ireland, USA, United Kingdom"
                  value={locationData.national}
                  onChange={(e) => setLocationData({ ...locationData, national: e.target.value })}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border transition-all duration-200',
                    'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                    'border-gray-300 dark:border-gray-600',
                    'focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                    'placeholder-gray-500 dark:placeholder-gray-400',
                    errors.national && 'border-red-500 dark:border-red-400'
                  )}
                />
                {errors.national && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.national}</p>
                )}
              </div>

              {/* Preview of feed tabs */}
              {(locationData.local || locationData.regional || locationData.national) && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800">
                  <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200 mb-2">
                    Your personalized feed tabs will be:
                  </p>
                  <div className="flex gap-2 text-xs">
                    <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg">
                      {locationData.local || 'Local'}
                    </span>
                    <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg">
                      {locationData.regional || 'Regional'}
                    </span>
                    <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg">
                      {locationData.national || 'National'}
                    </span>
                    <span className="px-3 py-1 bg-gray-500 text-white rounded-lg">
                      Following
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: User Details */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <FiUser className="inline mr-2" size={16} />
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={userData.name}
                  onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border transition-all duration-200',
                    'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                    'border-gray-300 dark:border-gray-600',
                    'focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                    'placeholder-gray-500 dark:placeholder-gray-400',
                    errors.name && 'border-red-500 dark:border-red-400'
                  )}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <FiMail className="inline mr-2" size={16} />
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={userData.email}
                  onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border transition-all duration-200',
                    'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                    'border-gray-300 dark:border-gray-600',
                    'focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                    'placeholder-gray-500 dark:placeholder-gray-400',
                    errors.email && 'border-red-500 dark:border-red-400'
                  )}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <FiLock className="inline mr-2" size={16} />
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Create a secure password"
                  value={userData.password}
                  onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border transition-all duration-200',
                    'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                    'border-gray-300 dark:border-gray-600',
                    'focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                    'placeholder-gray-500 dark:placeholder-gray-400',
                    errors.password && 'border-red-500 dark:border-red-400'
                  )}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <FiLock className="inline mr-2" size={16} />
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="Confirm your password"
                  value={userData.confirmPassword}
                  onChange={(e) => setUserData({ ...userData, confirmPassword: e.target.value })}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border transition-all duration-200',
                    'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                    'border-gray-300 dark:border-gray-600',
                    'focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                    'placeholder-gray-500 dark:placeholder-gray-400',
                    errors.confirmPassword && 'border-red-500 dark:border-red-400'
                  )}
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.confirmPassword}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <FiPhone className="inline mr-2" size={16} />
                  Phone Number <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={userData.phone}
                  onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border transition-all duration-200',
                    'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                    'border-gray-300 dark:border-gray-600',
                    'focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                    'placeholder-gray-500 dark:placeholder-gray-400',
                    errors.phone && 'border-red-500 dark:border-red-400'
                  )}
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.phone}</p>
                )}
              </div>

              {errors.submit && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 mt-8">
            <Button
              variant="secondary"
              onClick={handleBack}
              className="flex-1 hover-scale"
              leftIcon={<FiArrowLeft size={16} />}
            >
              {currentStep === 1 ? 'Back to Login' : 'Previous'}
            </Button>

            {currentStep === 1 ? (
              <Button
                variant="primary"
                onClick={handleNext}
                className="flex-1 hover-scale"
                rightIcon={
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center ml-2">
                    <FiChevronRight size={14} />
                  </div>
                }
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={isLoading}
                className="flex-1 hover-scale"
                rightIcon={
                  !isLoading ? (
                    <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center ml-2">
                      <FiChevronRight size={14} />
                    </div>
                  ) : undefined
                }
              >
                {isLoading ? 'Creating Account...' : 'Complete Setup'}
              </Button>
            )}
          </div>

          {/* Login Link */}
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                Sign In
              </button>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
