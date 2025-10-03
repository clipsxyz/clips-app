import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../api'

// Mock fetch
global.fetch = vi.fn()

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('Authentication', () => {
    it('handles successful login', async () => {
      const mockResponse = {
        success: true,
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
        access_token: 'mock-token'
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await apiClient.login('test@example.com', 'password123')

      expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123'
        })
      })

      expect(result).toEqual(mockResponse)
      expect(localStorage.getItem('access_token')).toBe('mock-token')
    })

    it('handles login failure', async () => {
      const mockError = {
        success: false,
        message: 'Invalid credentials'
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve(mockError)
      } as Response)

      await expect(apiClient.login('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials')
    })

    it('handles successful registration', async () => {
      const mockResponse = {
        success: true,
        user: { id: '1', name: 'New User', email: 'new@example.com' },
        access_token: 'mock-token'
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const userData = {
        name: 'New User',
        email: 'new@example.com',
        password: 'password123',
        password_confirmation: 'password123'
      }

      const result = await apiClient.register(userData)

      expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      expect(result).toEqual(mockResponse)
    })

    it('handles logout', async () => {
      localStorage.setItem('access_token', 'mock-token')

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      } as Response)

      await apiClient.logout()

      expect(fetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer mock-token'
        }
      })

      expect(localStorage.getItem('access_token')).toBeNull()
    })

    it('gets current user', async () => {
      const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' }
      localStorage.setItem('access_token', 'mock-token')

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, user: mockUser })
      } as Response)

      const result = await apiClient.getCurrentUser()

      expect(fetch).toHaveBeenCalledWith('/api/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer mock-token'
        }
      })

      expect(result.user).toEqual(mockUser)
    })
  })

  describe('Posts', () => {
    it('fetches posts', async () => {
      const mockPosts = [
        { id: '1', content: 'Test post 1' },
        { id: '2', content: 'Test post 2' }
      ]

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, posts: mockPosts })
      } as Response)

      const result = await apiClient.getPosts()

      expect(fetch).toHaveBeenCalledWith('/api/posts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })

      expect(result.posts).toEqual(mockPosts)
    })

    it('creates a post', async () => {
      const mockPost = { id: '1', content: 'New post' }
      const postData = { content: 'New post' }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, post: mockPost })
      } as Response)

      const result = await apiClient.createPost(postData)

      expect(fetch).toHaveBeenCalledWith('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(postData)
      })

      expect(result.post).toEqual(mockPost)
    })

    it('likes a post', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      } as Response)

      await apiClient.likePost('1')

      expect(fetch).toHaveBeenCalledWith('/api/posts/1/like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
    })

    it('unlikes a post', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      } as Response)

      await apiClient.unlikePost('1')

      expect(fetch).toHaveBeenCalledWith('/api/posts/1/like', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
    })
  })

  describe('Error Handling', () => {
    it('handles network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(apiClient.getPosts()).rejects.toThrow('Network error')
    })

    it('handles 500 server errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal server error' })
      } as Response)

      await expect(apiClient.getPosts()).rejects.toThrow('Internal server error')
    })

    it('handles 404 errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Not found' })
      } as Response)

      await expect(apiClient.getPosts()).rejects.toThrow('Not found')
    })
  })

  describe('Token Management', () => {
    it('includes authorization header when token exists', async () => {
      localStorage.setItem('access_token', 'mock-token')

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, posts: [] })
      } as Response)

      await apiClient.getPosts()

      expect(fetch).toHaveBeenCalledWith('/api/posts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer mock-token'
        }
      })
    })

    it('does not include authorization header when no token', async () => {
      localStorage.removeItem('access_token')

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, posts: [] })
      } as Response)

      await apiClient.getPosts()

      expect(fetch).toHaveBeenCalledWith('/api/posts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
    })
  })
})


