import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import App from '../App'

// Mock the auth context
const mockUseAuth = vi.fn()
vi.mock('../../context/Auth', () => ({
  useAuth: () => mockUseAuth()
}))

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: () => ({ pathname: '/' }),
    useNavigate: () => vi.fn(),
  }
})

// Mock the feed page component
vi.mock('../../App', () => ({
  FeedPage: () => <div data-testid="feed-page">Feed Page</div>
}))

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders feed page when user is authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Test User' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn()
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('feed-page')).toBeInTheDocument()
    })
  })

  it('renders login page when user is not authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn()
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Welcome Back!')).toBeInTheDocument()
    })
  })

  it('shows loading state initially', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn()
    })

    render(<App />)

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('handles authentication state changes', async () => {
    const { rerender } = render(<App />)

    // Initially not authenticated
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn()
    })

    rerender(<App />)

    await waitFor(() => {
      expect(screen.getByText('Welcome Back!')).toBeInTheDocument()
    })

    // After authentication
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Test User' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn()
    })

    rerender(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('feed-page')).toBeInTheDocument()
    })
  })

  it('renders navigation tabs when authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Test User' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn()
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('bottom-navigation')).toBeInTheDocument()
      expect(screen.getByText('Feed')).toBeInTheDocument()
      expect(screen.getByText('Messages')).toBeInTheDocument()
      expect(screen.getByText('Create')).toBeInTheDocument()
      expect(screen.getByText('Live')).toBeInTheDocument()
      expect(screen.getByText('Profile')).toBeInTheDocument()
    })
  })

  it('does not render navigation tabs when not authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn()
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.queryByTestId('bottom-navigation')).not.toBeInTheDocument()
    })
  })

  it('handles tab switching', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Test User' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn()
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('bottom-navigation')).toBeInTheDocument()
    })

    // Click on Messages tab
    const messagesTab = screen.getByText('Messages')
    messagesTab.click()

    await waitFor(() => {
      expect(screen.getByTestId('messages-page')).toBeInTheDocument()
    })
  })

  it('shows error state when authentication fails', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      error: 'Authentication failed',
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn()
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Authentication failed')).toBeInTheDocument()
    })
  })

  it('handles offline state', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Test User' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn()
    })

    // Mock offline state
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('offline-indicator')).toBeInTheDocument()
    })
  })

  it('handles online state', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Test User' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn()
    })

    // Mock online state
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.queryByTestId('offline-indicator')).not.toBeInTheDocument()
    })
  })
})


