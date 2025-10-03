import { useState, useCallback } from 'react'
import { apiClient } from '../utils/api'

interface UsePasswordResetReturn {
  isLoading: boolean
  message: string
  isSuccess: boolean
  sendResetLink: (email: string) => Promise<boolean>
  resetPassword: (data: {
    token: string
    email: string
    password: string
    password_confirmation: string
  }) => Promise<boolean>
  verifyToken: (token: string, email: string) => Promise<boolean>
  changePassword: (data: {
    current_password: string
    password: string
    password_confirmation: string
  }) => Promise<boolean>
  clearMessage: () => void
}

export const usePasswordReset = (): UsePasswordResetReturn => {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const sendResetLink = useCallback(async (email: string): Promise<boolean> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.sendPasswordResetLink(email)
      if (response.success) {
        setMessage('Password reset link sent to your email!')
        setIsSuccess(true)
        return true
      } else {
        setMessage(response.message || 'Failed to send reset link')
        setIsSuccess(false)
        return false
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to send reset link')
      setIsSuccess(false)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const resetPassword = useCallback(async (data: {
    token: string
    email: string
    password: string
    password_confirmation: string
  }): Promise<boolean> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.resetPassword(data)
      if (response.success) {
        setMessage('Password reset successfully!')
        setIsSuccess(true)
        return true
      } else {
        setMessage(response.message || 'Failed to reset password')
        setIsSuccess(false)
        return false
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to reset password')
      setIsSuccess(false)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const verifyToken = useCallback(async (token: string, email: string): Promise<boolean> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.verifyPasswordResetToken(token, email)
      if (response.success) {
        setMessage('Token is valid')
        setIsSuccess(true)
        return true
      } else {
        setMessage(response.message || 'Invalid or expired token')
        setIsSuccess(false)
        return false
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to verify token')
      setIsSuccess(false)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const changePassword = useCallback(async (data: {
    current_password: string
    password: string
    password_confirmation: string
  }): Promise<boolean> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.changePassword(data)
      if (response.success) {
        setMessage('Password changed successfully!')
        setIsSuccess(true)
        return true
      } else {
        setMessage(response.message || 'Failed to change password')
        setIsSuccess(false)
        return false
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to change password')
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
    sendResetLink,
    resetPassword,
    verifyToken,
    changePassword,
    clearMessage
  }
}


