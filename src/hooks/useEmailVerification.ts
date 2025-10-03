import { useState, useCallback } from 'react'
import { apiClient } from '../utils/api'

interface UseEmailVerificationReturn {
  isLoading: boolean
  message: string
  isSuccess: boolean
  sendVerification: (email: string) => Promise<void>
  resendVerification: (email: string) => Promise<void>
  checkStatus: (email: string) => Promise<boolean>
  clearMessage: () => void
}

export const useEmailVerification = (): UseEmailVerificationReturn => {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const sendVerification = useCallback(async (email: string) => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.sendEmailVerification(email)
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
  }, [])

  const resendVerification = useCallback(async (email: string) => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.resendEmailVerification(email)
      if (response.success) {
        setMessage('Verification email sent successfully!')
        setIsSuccess(true)
      } else {
        setMessage(response.message || 'Failed to resend verification email')
        setIsSuccess(false)
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to resend verification email')
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const checkStatus = useCallback(async (email: string): Promise<boolean> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.getEmailVerificationStatus(email)
      if (response.verified) {
        setMessage('Email verified successfully!')
        setIsSuccess(true)
        return true
      } else {
        setMessage('Email not yet verified. Please check your inbox.')
        setIsSuccess(false)
        return false
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to check verification status')
      setIsSuccess(false)
      return false
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
    sendVerification,
    resendVerification,
    checkStatus,
    clearMessage
  }
}


