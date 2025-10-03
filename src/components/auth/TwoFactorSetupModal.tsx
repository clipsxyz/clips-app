import React, { useState, useEffect } from 'react'
import { FiShield, FiCopy, FiCheck, FiX, FiDownload } from 'react-icons/fi'
import { Button } from '../ui/Button'
import { apiClient } from '../../utils/api'

interface TwoFactorSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const TwoFactorSetupModal: React.FC<TwoFactorSetupModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'setup' | 'confirm'>('setup')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [twoFactorData, setTwoFactorData] = useState<{
    secret: string
    qr_code_url: string
    recovery_codes: string[]
  } | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [copiedCodes, setCopiedCodes] = useState<boolean[]>([])

  useEffect(() => {
    if (isOpen && step === 'setup') {
      handleEnableTwoFactor()
    }
  }, [isOpen, step])

  const handleEnableTwoFactor = async () => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.enableTwoFactor()
      if (response.success) {
        setTwoFactorData(response.data)
        setStep('confirm')
      } else {
        setMessage(response.message || 'Failed to enable two-factor authentication')
        setIsSuccess(false)
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to enable two-factor authentication')
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmTwoFactor = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setMessage('Please enter a valid 6-digit code')
      setIsSuccess(false)
      return
    }

    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.confirmTwoFactor(verificationCode)
      if (response.success) {
        setMessage('Two-factor authentication enabled successfully!')
        setIsSuccess(true)
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1500)
      } else {
        setMessage(response.message || 'Invalid verification code')
        setIsSuccess(false)
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to confirm two-factor authentication')
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCodes(prev => {
        const newCopied = [...prev]
        newCopied[index] = true
        return newCopied
      })
      setTimeout(() => {
        setCopiedCodes(prev => {
          const newCopied = [...prev]
          newCopied[index] = false
          return newCopied
        })
      }, 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const downloadRecoveryCodes = () => {
    if (!twoFactorData) return
    
    const content = `Gossapp Two-Factor Authentication Recovery Codes\n\n` +
      `Generated: ${new Date().toLocaleString()}\n\n` +
      `IMPORTANT: Store these codes in a safe place. Each code can only be used once.\n\n` +
      twoFactorData.recovery_codes.map((code, index) => `${index + 1}. ${code}`).join('\n') +
      `\n\nIf you lose access to your authenticator app and run out of recovery codes, you may lose access to your account.`
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gossapp-recovery-codes.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-full">
              <FiShield className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {step === 'setup' ? 'Enable Two-Factor Authentication' : 'Confirm Setup'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {step === 'setup' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Setting up two-factor authentication...</p>
              </div>
            ) : (
              <>
                <p className="text-gray-600">
                  Two-factor authentication adds an extra layer of security to your account.
                </p>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Important:</strong> Make sure to save your recovery codes in a safe place. 
                    You'll need them if you lose access to your authenticator app.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'confirm' && twoFactorData && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Scan QR Code
              </h3>
              <p className="text-gray-600 mb-4">
                Use your authenticator app to scan this QR code
              </p>
              
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                <img 
                  src={twoFactorData.qr_code_url} 
                  alt="QR Code for 2FA setup"
                  className="w-48 h-48"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Manual Entry Key
              </label>
              <div className="flex items-center space-x-2">
                <code className="flex-1 bg-gray-100 p-2 rounded text-sm font-mono">
                  {twoFactorData.secret}
                </code>
                <button
                  onClick={() => copyToClipboard(twoFactorData.secret, -1)}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                >
                  {copiedCodes[-1] ? (
                    <FiCheck className="w-4 h-4 text-green-600" />
                  ) : (
                    <FiCopy className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recovery Codes
              </label>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                  {twoFactorData.recovery_codes.map((code, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span>{code}</span>
                      <button
                        onClick={() => copyToClipboard(code, index)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        {copiedCodes[index] ? (
                          <FiCheck className="w-3 h-3 text-green-600" />
                        ) : (
                          <FiCopy className="w-3 h-3 text-gray-600" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={downloadRecoveryCodes}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <FiDownload className="w-3 h-3 mr-1" />
                  Download as text file
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Verification Code
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-lg font-mono"
                maxLength={6}
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
                onClick={handleConfirmTwoFactor}
                loading={isLoading}
                disabled={verificationCode.length !== 6}
                className="flex-1"
              >
                Confirm & Enable
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


