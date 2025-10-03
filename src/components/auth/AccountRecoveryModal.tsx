import React, { useState } from 'react'
import { FiShield, FiMail, FiCheck, FiX, FiAlertTriangle } from 'react-icons/fi'
import { Button } from '../ui/Button'
import { apiClient } from '../../utils/api'

interface AccountRecoveryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const AccountRecoveryModal: React.FC<AccountRecoveryModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'request' | 'verify' | 'complete'>('request')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [token, setToken] = useState('')
  const [recoveryData, setRecoveryData] = useState<any>(null)

  const recoveryReasons = [
    { value: 'forgot_password', label: 'Forgot Password' },
    { value: 'account_locked', label: 'Account Locked' },
    { value: 'suspicious_activity', label: 'Suspicious Activity' },
    { value: 'other', label: 'Other' }
  ]

  const handleRequestRecovery = async () => {
    if (!email || !reason) {
      setMessage('Please fill in all required fields')
      setIsSuccess(false)
      return
    }

    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.requestAccountRecovery({
        email,
        reason,
        description: description || undefined
      })
      
      if (response.success) {
        setMessage('Recovery request submitted. Please check your email for instructions.')
        setIsSuccess(true)
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 2000)
      } else {
        setMessage(response.message || 'Failed to submit recovery request')
        setIsSuccess(false)
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to submit recovery request')
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyToken = async () => {
    if (!token) {
      setMessage('Please enter the recovery token')
      setIsSuccess(false)
      return
    }

    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.verifyRecoveryToken(token)
      if (response.success) {
        setRecoveryData(response.data)
        setStep('complete')
        setMessage('Recovery token verified successfully')
        setIsSuccess(true)
      } else {
        setMessage(response.message || 'Invalid or expired recovery token')
        setIsSuccess(false)
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to verify recovery token')
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompleteRecovery = async (action: string) => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.completeAccountRecovery({
        token,
        action
      })
      
      if (response.success) {
        setMessage('Account recovery completed successfully!')
        setIsSuccess(true)
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1500)
      } else {
        setMessage(response.message || 'Failed to complete account recovery')
        setIsSuccess(false)
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to complete account recovery')
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  // Check if we have token from URL params
  React.useEffect(() => {
    if (isOpen) {
      const urlParams = new URLSearchParams(window.location.search)
      const tokenParam = urlParams.get('token')
      
      if (tokenParam) {
        setToken(tokenParam)
        setStep('verify')
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <FiShield className="w-6 h-6 text-orange-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {step === 'request' && 'Account Recovery'}
              {step === 'verify' && 'Verify Recovery Token'}
              {step === 'complete' && 'Complete Recovery'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {step === 'request' && (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <FiAlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="text-sm text-orange-800">
                    <strong>Account Recovery</strong> is for serious account issues. 
                    If you just forgot your password, use the password reset option instead.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recovery Reason *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">Select a reason</option>
                {recoveryReasons.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide additional details about your issue"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              />
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
              onClick={handleRequestRecovery}
              loading={isLoading}
              disabled={!email || !reason}
              className="w-full"
            >
              Submit Recovery Request
            </Button>

            <div className="text-center">
              <p className="text-sm text-gray-500">
                Just forgot your password?{' '}
                <button
                  onClick={onClose}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Use password reset instead
                </button>
              </p>
            </div>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <p className="text-gray-600">
              Enter the recovery token from your email to verify your identity.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recovery Token
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter recovery token"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono"
              />
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
                onClick={handleVerifyToken}
                loading={isLoading}
                disabled={!token}
                className="flex-1"
              >
                Verify Token
              </Button>
            </div>
          </div>
        )}

        {step === 'complete' && recoveryData && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Account:</strong> {recoveryData.user.email}<br />
                <strong>Reason:</strong> {recoveryData.reason.replace('_', ' ')}<br />
                {recoveryData.description && (
                  <>
                    <strong>Description:</strong> {recoveryData.description}
                  </>
                )}
              </p>
            </div>

            <p className="text-gray-600">
              Choose how you'd like to recover your account:
            </p>

            <div className="space-y-3">
              <Button
                onClick={() => handleCompleteRecovery('reset_password')}
                loading={isLoading}
                className="w-full justify-start"
                variant="outline"
              >
                <FiShield className="w-4 h-4 mr-2" />
                Reset Password
              </Button>

              <Button
                onClick={() => handleCompleteRecovery('unlock_account')}
                loading={isLoading}
                className="w-full justify-start"
                variant="outline"
              >
                <FiShield className="w-4 h-4 mr-2" />
                Unlock Account
              </Button>

              <Button
                onClick={() => handleCompleteRecovery('verify_identity')}
                loading={isLoading}
                className="w-full justify-start"
                variant="outline"
              >
                <FiShield className="w-4 h-4 mr-2" />
                Verify Identity
              </Button>
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
          </div>
        )}
      </div>
    </div>
  )
}


