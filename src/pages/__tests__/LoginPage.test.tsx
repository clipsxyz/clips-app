import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../test/test-utils'
import { LoginPage } from '../LoginPage'

// Mock the auth context
vi.mock('../../context/Auth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    user: null,
    logout: vi.fn(),
    updateUser: vi.fn()
  })
}))

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form', () => {
    render(<LoginPage />)
    
    expect(screen.getByText('Welcome Back!')).toBeInTheDocument()
    expect(screen.getByText('Sign in to continue to Gossapp')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Email or Username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows validation errors for empty fields', async () => {
    render(<LoginPage />)
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Please fill in all fields')).toBeInTheDocument()
    })
  })

  it('allows user to input email/username and password', () => {
    render(<LoginPage />)
    
    const emailInput = screen.getByPlaceholderText('Email or Username')
    const passwordInput = screen.getByPlaceholderText('Password')
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    
    expect(emailInput).toHaveValue('test@example.com')
    expect(passwordInput).toHaveValue('password123')
  })

  it('toggles password visibility', () => {
    render(<LoginPage />)
    
    const passwordInput = screen.getByPlaceholderText('Password')
    const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i })
    
    expect(passwordInput).toHaveAttribute('type', 'password')
    
    fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'text')
    
    fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('toggles remember me checkbox', () => {
    render(<LoginPage />)
    
    const rememberMeCheckbox = screen.getByRole('checkbox', { name: /remember me/i })
    
    expect(rememberMeCheckbox).not.toBeChecked()
    
    fireEvent.click(rememberMeCheckbox)
    expect(rememberMeCheckbox).toBeChecked()
  })

  it('shows social login buttons', () => {
    render(<LoginPage />)
    
    expect(screen.getByText('Google')).toBeInTheDocument()
    expect(screen.getByText('Apple')).toBeInTheDocument()
  })

  it('shows sign up link', () => {
    render(<LoginPage />)
    
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument()
  })

  it('handles form submission with valid data', async () => {
    const mockLogin = vi.fn()
    vi.mocked(require('../../context/Auth').useAuth).mockReturnValue({
      login: mockLogin,
      user: null,
      logout: vi.fn(),
      updateUser: vi.fn()
    })

    render(<LoginPage />)
    
    const emailInput = screen.getByPlaceholderText('Email or Username')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123', false)
    })
  })

  it('shows loading state during submission', async () => {
    const mockLogin = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    vi.mocked(require('../../context/Auth').useAuth).mockReturnValue({
      login: mockLogin,
      user: null,
      logout: vi.fn(),
      updateUser: vi.fn()
    })

    render(<LoginPage />)
    
    const emailInput = screen.getByPlaceholderText('Email or Username')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)
    
    expect(screen.getByText('Signing In...')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
  })

  it('handles keyboard navigation', () => {
    render(<LoginPage />)
    
    const emailInput = screen.getByPlaceholderText('Email or Username')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    // Tab navigation
    emailInput.focus()
    fireEvent.keyDown(emailInput, { key: 'Tab' })
    expect(passwordInput).toHaveFocus()
    
    fireEvent.keyDown(passwordInput, { key: 'Tab' })
    expect(submitButton).toHaveFocus()
  })

  it('submits form on Enter key press', async () => {
    const mockLogin = vi.fn()
    vi.mocked(require('../../context/Auth').useAuth).mockReturnValue({
      login: mockLogin,
      user: null,
      logout: vi.fn(),
      updateUser: vi.fn()
    })

    render(<LoginPage />)
    
    const emailInput = screen.getByPlaceholderText('Email or Username')
    const passwordInput = screen.getByPlaceholderText('Password')
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.keyDown(passwordInput, { key: 'Enter' })
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123', false)
    })
  })
})


