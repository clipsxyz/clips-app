import React, { useState } from 'react'
import { FiMail, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi'
import { Button } from '../ui/Button'
import { apiClient } from '../../utils/api'

interface EmailVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  email: string
  onVerified: () => void
}

export const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  isOpen,
  onClose,
  email,
  onVerified
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const handleResendVerification = async () => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.resendEmailVerification(email)
      if (response.success) {
        setMessage('Verification email sent successfully!')
        setIsSuccess(true)
      } else {
        setMessage(response.message || 'Failed to send verification email')
        setIsSuccess(false)
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to send verification email')
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckStatus = async () => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.getEmailVerificationStatus(email)
      if (response.verified) {
        setMessage('Email verified successfully!')
        setIsSuccess(true)
        setTimeout(() => {
          onVerified()
          onClose()
        }, 1500)
      } else {
        setMessage('Email not yet verified. Please check your inbox.')
        setIsSuccess(false)
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to check verification status')
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <FiMail className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Verify Your Email</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-gray-600">
            We've sent a verification email to <strong>{email}</strong>. 
            Please check your inbox and click the verification link.
          </p>

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
              onClick={handleResendVerification}
              loading={isLoading}
              className="flex-1"
            >
              <FiRefreshCw className="w-4 h-4 mr-2" />
              Resend Email
            </Button>
            
            <Button
              onClick={handleCheckStatus}
              loading={isLoading}
              className="flex-1"
            >
              <FiCheck className="w-4 h-4 mr-2" />
              Check Status
            </Button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-500">
              Didn't receive the email? Check your spam folder or try resending.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}


