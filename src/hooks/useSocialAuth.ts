import { useState, useCallback } from 'react'
import { apiClient } from '../utils/api'

interface SocialAccount {
  provider: string
  name: string
  email: string
  avatar: string
  linked_at: string
  token_expired: boolean
}

interface UseSocialAuthReturn {
  isLoading: boolean
  message: string
  isSuccess: boolean
  socialAccounts: SocialAccount[]
  getRedirectUrl: (provider: string) => Promise<string | null>
  linkAccount: (provider: string) => Promise<boolean>
  unlinkAccount: (provider: string) => Promise<boolean>
  getAccounts: () => Promise<SocialAccount[]>
  clearMessage: () => void
}

export const useSocialAuth = (): UseSocialAuthReturn => {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])

  const getRedirectUrl = useCallback(async (provider: string): Promise<string | null> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.getSocialRedirectUrl(provider)
      if (response.success && response.redirect_url) {
        return response.redirect_url
      } else {
        setMessage('Failed to get redirect URL')
        setIsSuccess(false)
        return null
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to get redirect URL')
      setIsSuccess(false)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const linkAccount = useCallback(async (provider: string): Promise<boolean> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.linkSocialAccount(provider)
      if (response.success) {
        setMessage('Social account linked successfully!')
        setIsSuccess(true)
        await getAccounts()
        return true
      } else {
        setMessage(response.message || 'Failed to link social account')
        setIsSuccess(false)
        return false
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to link social account')
      setIsSuccess(false)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const unlinkAccount = useCallback(async (provider: string): Promise<boolean> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.unlinkSocialAccount(provider)
      if (response.success) {
        setMessage('Social account unlinked successfully!')
        setIsSuccess(true)
        await getAccounts()
        return true
      } else {
        setMessage(response.message || 'Failed to unlink social account')
        setIsSuccess(false)
        return false
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to unlink social account')
      setIsSuccess(false)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getAccounts = useCallback(async (): Promise<SocialAccount[]> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.getSocialAccounts()
      if (response.success) {
        setSocialAccounts(response.data.accounts)
        return response.data.accounts
      } else {
        setMessage(response.message || 'Failed to get social accounts')
        setIsSuccess(false)
        return []
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to get social accounts')
      setIsSuccess(false)
      return []
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
    socialAccounts,
    getRedirectUrl,
    linkAccount,
    unlinkAccount,
    getAccounts,
    clearMessage
  }
}


