import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiGithub } from 'react-icons/fi';
import { FaGoogle, FaApple } from 'react-icons/fa';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import Logo from '../components/Logo';
import { cn } from '../utils/cn';
import { useAuth } from '../context/Auth';
import { SocialLoginButtons } from '../components/auth/SocialLoginButtons';
import { PasswordResetModal } from '../components/auth/PasswordResetModal';
import { TwoFactorVerificationModal } from '../components/auth/TwoFactorVerificationModal';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    login: '',
    password: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.login.trim()) {
      newErrors.login = 'Email or username is required';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await login({
        login: formData.login.trim(),
        password: formData.password,
        remember_me: formData.rememberMe,
      });
      navigate('/feed');
    } catch (error: any) {
      if (error.message?.includes('2FA') || error.message?.includes('two-factor')) {
        setRequiresTwoFactor(true);
        setShowTwoFactor(true);
      } else {
        setErrors({ submit: error.message || 'Invalid email/username or password' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorSuccess = async (code: string) => {
    try {
      // This would typically be handled by the login function
      // For now, we'll just navigate to the feed
      navigate('/feed');
    } catch (error: any) {
      setErrors({ submit: error.message || 'Invalid verification code' });
    }
  };

  const handleSocialLogin = (provider: string) => {
    // TODO: Implement social login
    console.log(`Login with ${provider}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-40 h-40 bg-gradient-to-r from-indigo-400/20 to-purple-400/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-1/4 -right-20 w-32 h-32 bg-gradient-to-r from-pink-400/20 to-rose-400/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-gradient-to-r from-cyan-400/10 to-blue-400/10 rounded-full blur-2xl animate-pulse"></div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md animate-fade-in-up">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <Logo size="md" animated />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Welcome Back
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Sign in to your Gossapp account
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email/Username Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <FiMail className="inline mr-2" size={16} />
                Email or Username
              </label>
              <input
                type="text"
                placeholder="Enter your email or username"
                value={formData.login}
                onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                className={cn(
                  'w-full px-4 py-3 rounded-xl border transition-all duration-200',
                  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                  'border-gray-300 dark:border-gray-600',
                  'focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                  'placeholder-gray-500 dark:placeholder-gray-400',
                  errors.login && 'border-red-500 dark:border-red-400'
                )}
              />
              {errors.login && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.login}</p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <FiLock className="inline mr-2" size={16} />
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={cn(
                    'w-full px-4 py-3 pr-12 rounded-xl border transition-all duration-200',
                    'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                    'border-gray-300 dark:border-gray-600',
                    'focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                    'placeholder-gray-500 dark:placeholder-gray-400',
                    errors.password && 'border-red-500 dark:border-red-400'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Remember me
                </span>
              </label>
              <button
                type="button"
                onClick={() => setShowPasswordReset(true)}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                Forgot password?
              </button>
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl animate-fade-in">
                <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
              </div>
            )}

            {/* Login Button */}
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isLoading}
              className="hover-scale"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
            <span className="px-4 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900">
              or continue with
            </span>
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
          </div>

          {/* Social Login Buttons */}
          <SocialLoginButtons
            onSuccess={(user) => {
              navigate('/feed');
            }}
            onError={(error) => {
              setErrors({ submit: error });
            }}
            disabled={isLoading}
          />

          {/* Sign Up Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/signup')}
                className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                Sign Up
              </button>
            </p>
          </div>

          {/* Demo Login Helper */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              Demo Account
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-300 mb-2">
              For testing, you can use any email and password combination
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFormData({
                  login: 'demo@gossapp.com',
                  password: 'demo123',
                  rememberMe: false,
                });
              }}
              className="text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            >
              Use Demo Credentials
            </Button>
          </div>
        </Card>
      </div>

      {/* Modals */}
      <PasswordResetModal
        isOpen={showPasswordReset}
        onClose={() => setShowPasswordReset(false)}
        onSuccess={() => {
          setShowPasswordReset(false);
          // Show success message or redirect
        }}
      />

      <TwoFactorVerificationModal
        isOpen={showTwoFactor}
        onClose={() => {
          setShowTwoFactor(false);
          setRequiresTwoFactor(false);
        }}
        onSuccess={handleTwoFactorSuccess}
        title="Two-Factor Authentication Required"
        description="Enter the 6-digit code from your authenticator app to complete login"
      />
    </div>
  );
}