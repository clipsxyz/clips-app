import React, { useState } from 'react'
import { FiLock, FiMail, FiCheck, FiX, FiEye, FiEyeOff } from 'react-icons/fi'
import { Button } from '../ui/Button'
import { apiClient } from '../../utils/api'

interface PasswordResetModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [token, setToken] = useState('')

  const handleSendResetLink = async () => {
    if (!email) {
      setMessage('Please enter your email address')
      setIsSuccess(false)
      return
    }

    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.sendPasswordResetLink(email)
      if (response.success) {
        setMessage('Password reset link sent to your email!')
        setIsSuccess(true)
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 2000)
      } else {
        setMessage(response.message || 'Failed to send reset link')
        setIsSuccess(false)
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to send reset link')
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      setMessage('Please fill in all fields')
      setIsSuccess(false)
      return
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match')
      setIsSuccess(false)
      return
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters long')
      setIsSuccess(false)
      return
    }

    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.resetPassword({
        token,
        email,
        password,
        password_confirmation: confirmPassword
      })
      
      if (response.success) {
        setMessage('Password reset successfully!')
        setIsSuccess(true)
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1500)
      } else {
        setMessage(response.message || 'Failed to reset password')
        setIsSuccess(false)
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to reset password')
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  // Check if we have token and email from URL params
  React.useEffect(() => {
    if (isOpen) {
      const urlParams = new URLSearchParams(window.location.search)
      const tokenParam = urlParams.get('token')
      const emailParam = urlParams.get('email')
      
      if (tokenParam && emailParam) {
        setToken(tokenParam)
        setEmail(emailParam)
        setStep('reset')
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <FiLock className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {step === 'email' ? 'Reset Password' : 'Set New Password'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {step === 'email' && (
          <div className="space-y-4">
            <p className="text-gray-600">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {message && (
              <div className={`p-3 rounded-lg flex items-center space-x-2 ${
                isSuccess 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {isSuccess ? (
                  <FiCheck className="w-4 h-4" />
                ) : (
                  <FiX className="w-4 h-4" />
                )}
                <span className="text-sm">{message}</span>
              </div>
            )}

            <Button
              onClick={handleSendResetLink}
              loading={isLoading}
              disabled={!email}
              className="w-full"
            >
              Send Reset Link
            </Button>

            <div className="text-center">
              <p className="text-sm text-gray-500">
                Remember your password?{' '}
                <button
                  onClick={onClose}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        )}

        {step === 'reset' && (
          <div className="space-y-4">
            <p className="text-gray-600">
              Enter your new password below.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3 py-2 pl-10 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 pl-10 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {message && (
              <div className={`p-3 rounded-lg flex items-center space-x-2 ${
                isSuccess 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {isSuccess ? (
                  <FiCheck className="w-4 h-4" />
                ) : (
                  <FiX className="w-4 h-4" />
                )}
                <span className="text-sm">{message}</span>
              </div>
            )}

            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              
              <Button
                onClick={handleResetPassword}
                loading={isLoading}
                disabled={!password || !confirmPassword}
                className="flex-1"
              >
                Reset Password
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


