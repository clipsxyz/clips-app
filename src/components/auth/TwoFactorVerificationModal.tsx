import React, { useState } from 'react'
import { FiShield, FiKey, FiCheck, FiX } from 'react-icons/fi'
import { Button } from '../ui/Button'

interface TwoFactorVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (code: string) => void
  title?: string
  description?: string
}

export const TwoFactorVerificationModal: React.FC<TwoFactorVerificationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Two-Factor Authentication',
  description = 'Enter the 6-digit code from your authenticator app'
}) => {
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!code || code.length !== 6) {
      setMessage('Please enter a valid 6-digit code')
      setIsSuccess(false)
      return
    }

    setIsLoading(true)
    setMessage('')
    
    try {
      onSuccess(code)
    } catch (error: any) {
      setMessage(error.message || 'Invalid verification code')
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecoveryCode = () => {
    // This would typically open a recovery code input modal
    // For now, we'll just show a message
    setMessage('Recovery code option would be available here')
    setIsSuccess(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <FiShield className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-gray-600 mb-6">{description}</p>
            
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl font-mono tracking-widest"
                maxLength={6}
                autoFocus
              />
              <FiKey className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
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
              onClick={handleSubmit}
              loading={isLoading}
              disabled={code.length !== 6}
              className="flex-1"
            >
              Verify
            </Button>
          </div>

          <div className="text-center">
            <button
              onClick={handleRecoveryCode}
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              Use recovery code instead
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


