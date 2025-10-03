import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuth } from '../../context/Auth'

// Mock the API client
const mockApiClient = {
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  getCurrentUser: vi.fn(),
  updateProfile: vi.fn(),
}

vi.mock('../../utils/api', () => ({
  apiClient: mockApiClient
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()
  })

  it('initializes with no user', () => {
    const { result } = renderHook(() => useAuth())
    
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('handles successful login', async () => {
    const mockUser = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      username: 'testuser'
    }

    const mockResponse = {
      success: true,
      user: mockUser,
      access_token: 'mock-token'
    }

    mockApiClient.login.mockResolvedValue(mockResponse)
    mockLocalStorage.getItem.mockReturnValue(null)

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.login('test@example.com', 'password123')
    })

    expect(mockApiClient.login).toHaveBeenCalledWith('test@example.com', 'password123')
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser))
  })

  it('handles login failure', async () => {
    const mockError = new Error('Invalid credentials')
    mockApiClient.login.mockRejectedValue(mockError)

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      try {
        await result.current.login('test@example.com', 'wrongpassword')
      } catch (error) {
        expect(error).toBe(mockError)
      }
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('handles successful registration', async () => {
    const mockUser = {
      id: '1',
      name: 'New User',
      email: 'new@example.com',
      username: 'newuser'
    }

    const mockResponse = {
      success: true,
      user: mockUser,
      access_token: 'mock-token'
    }

    mockApiClient.register.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.register({
        name: 'New User',
        email: 'new@example.com',
        username: 'newuser',
        password: 'password123',
        password_confirmation: 'password123'
      })
    })

    expect(mockApiClient.register).toHaveBeenCalledWith({
      name: 'New User',
      email: 'new@example.com',
      username: 'newuser',
      password: 'password123',
      password_confirmation: 'password123'
    })
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('handles logout', async () => {
    const mockUser = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      username: 'testuser'
    }

    mockApiClient.logout.mockResolvedValue({ success: true })
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockUser))

    const { result } = renderHook(() => useAuth())

    // Set initial user state
    act(() => {
      result.current.setUser(mockUser)
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)

    await act(async () => {
      await result.current.logout()
    })

    expect(mockApiClient.logout).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user')
  })

  it('loads user from localStorage on initialization', () => {
    const mockUser = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      username: 'testuser'
    }

    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockUser))

    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('handles invalid localStorage data', () => {
    mockLocalStorage.getItem.mockReturnValue('invalid-json')

    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('updates user profile', async () => {
    const mockUser = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      username: 'testuser'
    }

    const updatedUser = {
      ...mockUser,
      name: 'Updated Name',
      bio: 'New bio'
    }

    const mockResponse = {
      success: true,
      user: updatedUser
    }

    mockApiClient.updateProfile.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useAuth())

    // Set initial user state
    act(() => {
      result.current.setUser(mockUser)
    })

    await act(async () => {
      await result.current.updateUser({
        name: 'Updated Name',
        bio: 'New bio'
      })
    })

    expect(mockApiClient.updateProfile).toHaveBeenCalledWith({
      name: 'Updated Name',
      bio: 'New bio'
    })
    expect(result.current.user).toEqual(updatedUser)
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(updatedUser))
  })

  it('handles update profile failure', async () => {
    const mockUser = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      username: 'testuser'
    }

    const mockError = new Error('Update failed')
    mockApiClient.updateProfile.mockRejectedValue(mockError)

    const { result } = renderHook(() => useAuth())

    // Set initial user state
    act(() => {
      result.current.setUser(mockUser)
    })

    await act(async () => {
      try {
        await result.current.updateUser({ name: 'Updated Name' })
      } catch (error) {
        expect(error).toBe(mockError)
      }
    })

    // User should remain unchanged
    expect(result.current.user).toEqual(mockUser)
  })

  it('clears error state', () => {
    const { result } = renderHook(() => useAuth())

    // Set an error
    act(() => {
      result.current.setError('Test error')
    })

    expect(result.current.error).toBe('Test error')

    // Clear error
    act(() => {
      result.current.clearError()
    })

    expect(result.current.error).toBeNull()
  })
})


