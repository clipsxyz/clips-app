import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../context/Auth'

// Mock the theme provider
const MockThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return <div data-testid="theme-provider">{children}</div>
}

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MockThemeProvider>
          {children}
        </MockThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Mock API responses
export const mockApiResponse = (data: any, success = true) => {
  return Promise.resolve({
    ok: success,
    json: () => Promise.resolve({
      success,
      data,
      message: success ? 'Success' : 'Error'
    })
  })
}

// Mock user data
export const mockUser = {
  id: '1',
  name: 'Test User',
  username: 'testuser',
  email: 'test@example.com',
  bio: 'Test bio',
  website: 'https://test.com',
  location: 'Test Location',
  profileImage: 'https://via.placeholder.com/100',
  isVerified: false,
  isPrivate: false,
  postsCount: 10,
  followingCount: 50,
  followersCount: 100,
  createdAt: '2024-01-01T00:00:00Z'
}

// Mock post data
export const mockPost = {
  id: '1',
  user: mockUser,
  content: 'Test post content',
  image: 'https://via.placeholder.com/400x300',
  likesCount: 5,
  commentsCount: 2,
  sharesCount: 1,
  isLiked: false,
  isBookmarked: false,
  createdAt: '2024-01-01T00:00:00Z',
  location: {
    local: 'Finglas',
    regional: 'Dublin',
    national: 'Ireland'
  }
}

// Helper to wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Helper to mock localStorage
export const mockLocalStorage = (data: Record<string, string>) => {
  Object.entries(data).forEach(([key, value]) => {
    localStorage.setItem(key, value)
  })
}

// Helper to clear all mocks
export const clearAllMocks = () => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }


