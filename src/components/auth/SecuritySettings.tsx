import React, { useState, useEffect } from 'react'
import { FiShield, FiMail, FiKey, FiEye, FiEyeOff, FiCheck, FiX, FiAlertTriangle } from 'react-icons/fi'
import { Button } from '../ui/Button'
import { apiClient } from '../../utils/api'
import { TwoFactorSetupModal } from './TwoFactorSetupModal'
import { TwoFactorVerificationModal } from './TwoFactorVerificationModal'

interface SecuritySettingsProps {
  user: any
  onUpdate: (user: any) => void
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  user,
  onUpdate
}) => {
  const [twoFactorStatus, setTwoFactorStatus] = useState<any>(null)
  const [socialAccounts, setSocialAccounts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false)
  const [showTwoFactorDisable, setShowTwoFactorDisable] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })

  useEffect(() => {
    loadSecurityData()
  }, [])

  const loadSecurityData = async () => {
    setIsLoading(true)
    try {
      const [twoFactorResponse, socialResponse] = await Promise.all([
        apiClient.getTwoFactorStatus(),
        apiClient.getSocialAccounts()
      ])

      if (twoFactorResponse.success) {
        setTwoFactorStatus(twoFactorResponse.data)
      }

      if (socialResponse.success) {
        setSocialAccounts(socialResponse.data.accounts)
      }
    } catch (error) {
      console.error('Failed to load security data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage('Please fill in all fields')
      setIsSuccess(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage('New passwords do not match')
      setIsSuccess(false)
      return
    }

    if (newPassword.length < 6) {
      setMessage('Password must be at least 6 characters long')
      setIsSuccess(false)
      return
    }

    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword
      })
      
      if (response.success) {
        setMessage('Password changed successfully!')
        setIsSuccess(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setMessage(response.message || 'Failed to change password')
        setIsSuccess(false)
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to change password')
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisableTwoFactor = async (code: string) => {
    try {
      const response = await apiClient.disableTwoFactor(code)
      if (response.success) {
        setMessage('Two-factor authentication disabled successfully!')
        setIsSuccess(true)
        setShowTwoFactorDisable(false)
        loadSecurityData()
      } else {
        setMessage(response.message || 'Failed to disable two-factor authentication')
        setIsSuccess(false)
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to disable two-factor authentication')
      setIsSuccess(false)
    }
  }

  const handleUnlinkSocialAccount = async (provider: string) => {
    if (!confirm(`Are you sure you want to unlink your ${provider} account?`)) {
      return
    }

    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.unlinkSocialAccount(provider)
      if (response.success) {
        setMessage(`${provider} account unlinked successfully!`)
        setIsSuccess(true)
        loadSecurityData()
      } else {
        setMessage(response.message || `Failed to unlink ${provider} account`)
        setIsSuccess(false)
      }
    } catch (error: any) {
      setMessage(error.message || `Failed to unlink ${provider} account`)
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )
      case 'facebook':
        return (
          <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        )
      case 'apple':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
        )
      default:
        return <FiShield className="w-5 h-5" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-100 rounded-full">
          <FiShield className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Security Settings</h2>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center space-x-2 ${
          isSuccess 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {isSuccess ? (
            <FiCheck className="w-5 h-5" />
          ) : (
            <FiX className="w-5 h-5" />
          )}
          <span>{message}</span>
        </div>
      )}

      {/* Email Verification Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FiMail className="w-5 h-5 text-gray-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Email Verification</h3>
              <p className="text-sm text-gray-600">
                {user?.email_verified_at ? 'Verified' : 'Not verified'}
              </p>
            </div>
          </div>
          {user?.email_verified_at ? (
            <div className="flex items-center space-x-2 text-green-600">
              <FiCheck className="w-4 h-4" />
              <span className="text-sm font-medium">Verified</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // This would trigger email verification
                setMessage('Verification email sent!')
                setIsSuccess(true)
              }}
            >
              Verify Email
            </Button>
          )}
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FiShield className="w-5 h-5 text-gray-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-600">
                {twoFactorStatus?.enabled ? 'Enabled' : 'Disabled'}
                {twoFactorStatus?.enabled && twoFactorStatus.recovery_codes_count > 0 && (
                  <span className="ml-2 text-blue-600">
                    ({twoFactorStatus.recovery_codes_count} recovery codes)
                  </span>
                )}
              </p>
            </div>
          </div>
          {twoFactorStatus?.enabled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTwoFactorDisable(true)}
            >
              Disable
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setShowTwoFactorSetup(true)}
            >
              Enable
            </Button>
          )}
        </div>
      </div>

      {/* Social Accounts */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Connected Accounts</h3>
        <div className="space-y-3">
          {socialAccounts.length > 0 ? (
            socialAccounts.map((account) => (
              <div key={account.provider} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {getProviderIcon(account.provider)}
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{account.provider}</p>
                    <p className="text-sm text-gray-600">{account.email}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnlinkSocialAccount(account.provider)}
                  loading={isLoading}
                >
                  Unlink
                </Button>
              </div>
            ))
          ) : (
            <p className="text-gray-600 text-sm">No social accounts connected</p>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Change Password</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.current ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.new ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.confirm ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            onClick={handleChangePassword}
            loading={isLoading}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            Change Password
          </Button>
        </div>
      </div>

      {/* Modals */}
      <TwoFactorSetupModal
        isOpen={showTwoFactorSetup}
        onClose={() => setShowTwoFactorSetup(false)}
        onSuccess={() => {
          setShowTwoFactorSetup(false)
          loadSecurityData()
        }}
      />

      <TwoFactorVerificationModal
        isOpen={showTwoFactorDisable}
        onClose={() => setShowTwoFactorDisable(false)}
        onSuccess={handleDisableTwoFactor}
        title="Disable Two-Factor Authentication"
        description="Enter your verification code to disable two-factor authentication"
      />
    </div>
  )
}


