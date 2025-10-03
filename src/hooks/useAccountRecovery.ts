import { useState, useCallback } from 'react'
import { apiClient } from '../utils/api'

interface RecoveryData {
  user: {
    id: string
    name: string
    email: string
    username: string
  }
  reason: string
  description: string
}

interface UseAccountRecoveryReturn {
  isLoading: boolean
  message: string
  isSuccess: boolean
  recoveryData: RecoveryData | null
  requestRecovery: (data: {
    email: string
    reason: string
    description?: string
  }) => Promise<boolean>
  verifyToken: (token: string) => Promise<RecoveryData | null>
  completeRecovery: (data: {
    token: string
    action: string
    password?: string
    password_confirmation?: string
    verification_code?: string
  }) => Promise<boolean>
  getStatus: (token: string) => Promise<any>
  cancelRecovery: (token: string) => Promise<boolean>
  clearMessage: () => void
}

export const useAccountRecovery = (): UseAccountRecoveryReturn => {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [recoveryData, setRecoveryData] = useState<RecoveryData | null>(null)

  const requestRecovery = useCallback(async (data: {
    email: string
    reason: string
    description?: string
  }): Promise<boolean> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.requestAccountRecovery(data)
      if (response.success) {
        setMessage('Recovery request submitted. Please check your email for instructions.')
        setIsSuccess(true)
        return true
      } else {
        setMessage(response.message || 'Failed to submit recovery request')
        setIsSuccess(false)
        return false
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to submit recovery request')
      setIsSuccess(false)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const verifyToken = useCallback(async (token: string): Promise<RecoveryData | null> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.verifyRecoveryToken(token)
      if (response.success) {
        setRecoveryData(response.data)
        setMessage('Recovery token verified successfully')
        setIsSuccess(true)
        return response.data
      } else {
        setMessage(response.message || 'Invalid or expired recovery token')
        setIsSuccess(false)
        return null
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to verify recovery token')
      setIsSuccess(false)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const completeRecovery = useCallback(async (data: {
    token: string
    action: string
    password?: string
    password_confirmation?: string
    verification_code?: string
  }): Promise<boolean> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.completeAccountRecovery(data)
      if (response.success) {
        setMessage('Account recovery completed successfully!')
        setIsSuccess(true)
        return true
      } else {
        setMessage(response.message || 'Failed to complete account recovery')
        setIsSuccess(false)
        return false
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to complete account recovery')
      setIsSuccess(false)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getStatus = useCallback(async (token: string): Promise<any> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.getRecoveryStatus(token)
      if (response.success) {
        return response.data
      } else {
        setMessage(response.message || 'Failed to get recovery status')
        setIsSuccess(false)
        return null
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to get recovery status')
      setIsSuccess(false)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const cancelRecovery = useCallback(async (token: string): Promise<boolean> => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await apiClient.cancelRecovery(token)
      if (response.success) {
        setMessage('Recovery request cancelled successfully')
        setIsSuccess(true)
        return true
      } else {
        setMessage(response.message || 'Failed to cancel recovery request')
        setIsSuccess(false)
        return false
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to cancel recovery request')
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
    recoveryData,
    requestRecovery,
    verifyToken,
    completeRecovery,
    getStatus,
    cancelRecovery,
    clearMessage
  }
}


