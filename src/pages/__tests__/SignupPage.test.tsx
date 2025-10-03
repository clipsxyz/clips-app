import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../test/test-utils'
import { SignupPage } from '../SignupPage'

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

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders step 1 (location selection)', () => {
    render(<SignupPage />)
    
    expect(screen.getByText('Choose Your Areas')).toBeInTheDocument()
    expect(screen.getByText('Select your local, regional, and national areas to personalize your feed')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Local Area (e.g., Finglas)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Regional Area (e.g., Dublin)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('National Area (e.g., Ireland)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
  })

  it('shows step indicator', () => {
    render(<SignupPage />)
    
    const stepDots = screen.getAllByTestId('step-dot')
    expect(stepDots).toHaveLength(2)
    expect(stepDots[0]).toHaveClass('bg-primary')
    expect(stepDots[1]).toHaveClass('bg-gray-300')
  })

  it('validates step 1 fields', async () => {
    render(<SignupPage />)
    
    const nextButton = screen.getByRole('button', { name: /next/i })
    fireEvent.click(nextButton)
    
    await waitFor(() => {
      expect(screen.getByText('Local area is required')).toBeInTheDocument()
      expect(screen.getByText('Regional area is required')).toBeInTheDocument()
      expect(screen.getByText('National area is required')).toBeInTheDocument()
    })
  })

  it('advances to step 2 when step 1 is valid', async () => {
    render(<SignupPage />)
    
    const localInput = screen.getByPlaceholderText('Local Area (e.g., Finglas)')
    const regionalInput = screen.getByPlaceholderText('Regional Area (e.g., Dublin)')
    const nationalInput = screen.getByPlaceholderText('National Area (e.g., Ireland)')
    const nextButton = screen.getByRole('button', { name: /next/i })
    
    fireEvent.change(localInput, { target: { value: 'Finglas' } })
    fireEvent.change(regionalInput, { target: { value: 'Dublin' } })
    fireEvent.change(nationalInput, { target: { value: 'Ireland' } })
    fireEvent.click(nextButton)
    
    await waitFor(() => {
      expect(screen.getByText('Create Account')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Full Name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Email Address')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Username')).toBeInTheDocument()
    })
  })

  it('shows step 2 form fields', async () => {
    render(<SignupPage />)
    
    // Fill step 1 and advance
    const localInput = screen.getByPlaceholderText('Local Area (e.g., Finglas)')
    const regionalInput = screen.getByPlaceholderText('Regional Area (e.g., Dublin)')
    const nationalInput = screen.getByPlaceholderText('National Area (e.g., Ireland)')
    const nextButton = screen.getByRole('button', { name: /next/i })
    
    fireEvent.change(localInput, { target: { value: 'Finglas' } })
    fireEvent.change(regionalInput, { target: { value: 'Dublin' } })
    fireEvent.change(nationalInput, { target: { value: 'Ireland' } })
    fireEvent.click(nextButton)
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Full Name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Email Address')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Username')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Confirm Password')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Phone Number (Optional)')).toBeInTheDocument()
    })
  })

  it('allows going back from step 2 to step 1', async () => {
    render(<SignupPage />)
    
    // Advance to step 2
    const localInput = screen.getByPlaceholderText('Local Area (e.g., Finglas)')
    const regionalInput = screen.getByPlaceholderText('Regional Area (e.g., Dublin)')
    const nationalInput = screen.getByPlaceholderText('National Area (e.g., Ireland)')
    const nextButton = screen.getByRole('button', { name: /next/i })
    
    fireEvent.change(localInput, { target: { value: 'Finglas' } })
    fireEvent.change(regionalInput, { target: { value: 'Dublin' } })
    fireEvent.change(nationalInput, { target: { value: 'Ireland' } })
    fireEvent.click(nextButton)
    
    await waitFor(() => {
      expect(screen.getByText('Create Account')).toBeInTheDocument()
    })
    
    // Go back
    const backButton = screen.getByRole('button', { name: /back/i })
    fireEvent.click(backButton)
    
    await waitFor(() => {
      expect(screen.getByText('Choose Your Areas')).toBeInTheDocument()
      expect(localInput).toHaveValue('Finglas')
      expect(regionalInput).toHaveValue('Dublin')
      expect(nationalInput).toHaveValue('Ireland')
    })
  })

  it('validates step 2 fields', async () => {
    render(<SignupPage />)
    
    // Advance to step 2
    const localInput = screen.getByPlaceholderText('Local Area (e.g., Finglas)')
    const regionalInput = screen.getByPlaceholderText('Regional Area (e.g., Dublin)')
    const nationalInput = screen.getByPlaceholderText('National Area (e.g., Ireland)')
    const nextButton = screen.getByRole('button', { name: /next/i })
    
    fireEvent.change(localInput, { target: { value: 'Finglas' } })
    fireEvent.change(regionalInput, { target: { value: 'Dublin' } })
    fireEvent.change(nationalInput, { target: { value: 'Ireland' } })
    fireEvent.click(nextButton)
    
    await waitFor(() => {
      expect(screen.getByText('Create Account')).toBeInTheDocument()
    })
    
    // Try to submit without filling fields
    const signupButton = screen.getByRole('button', { name: /sign up/i })
    fireEvent.click(signupButton)
    
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument()
      expect(screen.getByText('Email is required')).toBeInTheDocument()
      expect(screen.getByText('Username is required')).toBeInTheDocument()
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
  })

  it('validates email format', async () => {
    render(<SignupPage />)
    
    // Advance to step 2
    const localInput = screen.getByPlaceholderText('Local Area (e.g., Finglas)')
    const regionalInput = screen.getByPlaceholderText('Regional Area (e.g., Dublin)')
    const nationalInput = screen.getByPlaceholderText('National Area (e.g., Ireland)')
    const nextButton = screen.getByRole('button', { name: /next/i })
    
    fireEvent.change(localInput, { target: { value: 'Finglas' } })
    fireEvent.change(regionalInput, { target: { value: 'Dublin' } })
    fireEvent.change(nationalInput, { target: { value: 'Ireland' } })
    fireEvent.click(nextButton)
    
    await waitFor(() => {
      expect(screen.getByText('Create Account')).toBeInTheDocument()
    })
    
    // Enter invalid email
    const emailInput = screen.getByPlaceholderText('Email Address')
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    
    const signupButton = screen.getByRole('button', { name: /sign up/i })
    fireEvent.click(signupButton)
    
    await waitFor(() => {
      expect(screen.getByText('Email is invalid')).toBeInTheDocument()
    })
  })

  it('validates password confirmation', async () => {
    render(<SignupPage />)
    
    // Advance to step 2
    const localInput = screen.getByPlaceholderText('Local Area (e.g., Finglas)')
    const regionalInput = screen.getByPlaceholderText('Regional Area (e.g., Dublin)')
    const nationalInput = screen.getByPlaceholderText('National Area (e.g., Ireland)')
    const nextButton = screen.getByRole('button', { name: /next/i })
    
    fireEvent.change(localInput, { target: { value: 'Finglas' } })
    fireEvent.change(regionalInput, { target: { value: 'Dublin' } })
    fireEvent.change(nationalInput, { target: { value: 'Ireland' } })
    fireEvent.click(nextButton)
    
    await waitFor(() => {
      expect(screen.getByText('Create Account')).toBeInTheDocument()
    })
    
    // Enter mismatched passwords
    const passwordInput = screen.getByPlaceholderText('Password')
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password')
    
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'different123' } })
    
    const signupButton = screen.getByRole('button', { name: /sign up/i })
    fireEvent.click(signupButton)
    
    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })
  })

  it('toggles password visibility', async () => {
    render(<SignupPage />)
    
    // Advance to step 2
    const localInput = screen.getByPlaceholderText('Local Area (e.g., Finglas)')
    const regionalInput = screen.getByPlaceholderText('Regional Area (e.g., Dublin)')
    const nationalInput = screen.getByPlaceholderText('National Area (e.g., Ireland)')
    const nextButton = screen.getByRole('button', { name: /next/i })
    
    fireEvent.change(localInput, { target: { value: 'Finglas' } })
    fireEvent.change(regionalInput, { target: { value: 'Dublin' } })
    fireEvent.change(nationalInput, { target: { value: 'Ireland' } })
    fireEvent.click(nextButton)
    
    await waitFor(() => {
      expect(screen.getByText('Create Account')).toBeInTheDocument()
    })
    
    const passwordInput = screen.getByPlaceholderText('Password')
    const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i })
    
    expect(passwordInput).toHaveAttribute('type', 'password')
    
    fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'text')
    
    fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('shows login link', () => {
    render(<SignupPage />)
    
    expect(screen.getByText('Already have an account?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })

  it('handles successful form submission', async () => {
    const mockRegister = vi.fn().mockResolvedValue({ success: true })
    vi.mocked(require('../../context/Auth').useAuth).mockReturnValue({
      login: vi.fn(),
      user: null,
      logout: vi.fn(),
      updateUser: vi.fn(),
      register: mockRegister
    })

    render(<SignupPage />)
    
    // Fill step 1
    const localInput = screen.getByPlaceholderText('Local Area (e.g., Finglas)')
    const regionalInput = screen.getByPlaceholderText('Regional Area (e.g., Dublin)')
    const nationalInput = screen.getByPlaceholderText('National Area (e.g., Ireland)')
    const nextButton = screen.getByRole('button', { name: /next/i })
    
    fireEvent.change(localInput, { target: { value: 'Finglas' } })
    fireEvent.change(regionalInput, { target: { value: 'Dublin' } })
    fireEvent.change(nationalInput, { target: { value: 'Ireland' } })
    fireEvent.click(nextButton)
    
    await waitFor(() => {
      expect(screen.getByText('Create Account')).toBeInTheDocument()
    })
    
    // Fill step 2
    const nameInput = screen.getByPlaceholderText('Full Name')
    const emailInput = screen.getByPlaceholderText('Email Address')
    const usernameInput = screen.getByPlaceholderText('Username')
    const passwordInput = screen.getByPlaceholderText('Password')
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password')
    const signupButton = screen.getByRole('button', { name: /sign up/i })
    
    fireEvent.change(nameInput, { target: { value: 'Test User' } })
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
    fireEvent.click(signupButton)
    
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        password_confirmation: 'password123'
      })
    })
  })
})


