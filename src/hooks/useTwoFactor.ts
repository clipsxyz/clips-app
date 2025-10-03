import { useState, useCallback } from 'react'
import { apiClient } from '../utils/api'

interface TwoFactorData {
  secret: string
  qr_code_url: string
  recovery_codes: string[]
}

interface TwoFactorStatus {
  enabled: boolean
  confirmed_at: string | null
  recovery_codes_count: number
}

interface UseTwoFactorReturn {
  isLoading: boolean
  message: string
  isSuccess: boolean
  twoFactorData: TwoFactorData | null
  twoFactorStatus: TwoFactorStatus | null
  enableTwoFactor: () => Promise<TwoFactorData | null>
  confirmTwoFactor: (code: string) => Promise<boolean>
  disableTwoFactor: (code: string) => Promise<boolean>
  verifyTwoFactor: (code: string) => Promise<boolean>
  regenerateRecoveryCodes: () => Promise<string[] | null>
  getStatus: () => Promise<TwoFactorStatus | null>
  clearMessage: () => void
}

export const useTwoFactor = (): UseTwoFactorReturn => {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [twoFactorData, setTwoFactorData] = useState<TwoFactorData | null>(null)
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null)

  const enableTwoFactor = useCallback(async (): Promise<TwoFactorData | null> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.enableTwoFactor()
      if (response.success) {
        setTwoFactorData(response.data)
        setMessage('Two-factor authentication setup initiated')
        setIsSuccess(true)
        return response.data
      } else {
        setMessage(response.message || 'Failed to enable two-factor authentication')
        setIsSuccess(false)
        return null
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to enable two-factor authentication')
      setIsSuccess(false)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const confirmTwoFactor = useCallback(async (code: string): Promise<boolean> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.confirmTwoFactor(code)
      if (response.success) {
        setMessage('Two-factor authentication enabled successfully!')
        setIsSuccess(true)
        setTwoFactorData(null)
        await getStatus()
        return true
      } else {
        setMessage(response.message || 'Invalid verification code')
        setIsSuccess(false)
        return false
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to confirm two-factor authentication')
      setIsSuccess(false)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const disableTwoFactor = useCallback(async (code: string): Promise<boolean> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.disableTwoFactor(code)
      if (response.success) {
        setMessage('Two-factor authentication disabled successfully!')
        setIsSuccess(true)
        await getStatus()
        return true
      } else {
        setMessage(response.message || 'Failed to disable two-factor authentication')
        setIsSuccess(false)
        return false
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to disable two-factor authentication')
      setIsSuccess(false)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const verifyTwoFactor = useCallback(async (code: string): Promise<boolean> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.verifyTwoFactor(code)
      if (response.success) {
        setMessage('Two-factor authentication verified successfully!')
        setIsSuccess(true)
        return true
      } else {
        setMessage(response.message || 'Invalid verification code')
        setIsSuccess(false)
        return false
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to verify two-factor authentication')
      setIsSuccess(false)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const regenerateRecoveryCodes = useCallback(async (): Promise<string[] | null> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.regenerateRecoveryCodes()
      if (response.success) {
        setMessage('Recovery codes regenerated successfully!')
        setIsSuccess(true)
        await getStatus()
        return response.data.recovery_codes
      } else {
        setMessage(response.message || 'Failed to regenerate recovery codes')
        setIsSuccess(false)
        return null
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to regenerate recovery codes')
      setIsSuccess(false)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getStatus = useCallback(async (): Promise<TwoFactorStatus | null> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.getTwoFactorStatus()
      if (response.success) {
        setTwoFactorStatus(response.data)
        return response.data
      } else {
        setMessage(response.message || 'Failed to get two-factor status')
        setIsSuccess(false)
        return null
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to get two-factor status')
      setIsSuccess(false)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearMessage = useCallback(() => {
    setMessage('')
    setIsSuccess(false)
  }, [])

  return {
    isLoading,
    message,
    isSuccess,
    twoFactorData,
    twoFactorStatus,
    enableTwoFactor,
    confirmTwoFactor,
    disableTwoFactor,
    verifyTwoFactor,
    regenerateRecoveryCodes,
    getStatus,
    clearMessage
  }
}


