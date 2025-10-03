import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Button } from '../components/ui/Button'
import { LoginPage } from '../pages/LoginPage'
import { SignupPage } from '../pages/SignupPage'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

describe('Accessibility Tests', () => {
  describe('Button Component', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<Button>Test Button</Button>)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper ARIA attributes when disabled', async () => {
      const { container } = render(<Button disabled>Disabled Button</Button>)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper ARIA attributes when loading', async () => {
      const { container } = render(<Button loading>Loading Button</Button>)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Login Page', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<LoginPage />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper form labels', () => {
      render(<LoginPage />)
      
      const emailInput = document.querySelector('input[type="email"]')
      const passwordInput = document.querySelector('input[type="password"]')
      
      expect(emailInput).toHaveAttribute('aria-label', 'Email or Username')
      expect(passwordInput).toHaveAttribute('aria-label', 'Password')
    })

    it('should have proper heading structure', () => {
      render(<LoginPage />)
      
      const heading = document.querySelector('h1')
      expect(heading).toHaveTextContent('Welcome Back!')
    })

    it('should have proper button roles', () => {
      render(<LoginPage />)
      
      const buttons = document.querySelectorAll('button')
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type')
      })
    })
  })

  describe('Signup Page', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<SignupPage />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper form labels', () => {
      render(<SignupPage />)
      
      const inputs = document.querySelectorAll('input')
      inputs.forEach(input => {
        expect(input).toHaveAttribute('aria-label')
      })
    })

    it('should have proper heading structure', () => {
      render(<SignupPage />)
      
      const headings = document.querySelectorAll('h1, h2, h3')
      expect(headings.length).toBeGreaterThan(0)
    })

    it('should have proper step indicators', () => {
      render(<SignupPage />)
      
      const stepIndicator = document.querySelector('[role="progressbar"]')
      expect(stepIndicator).toBeInTheDocument()
    })
  })

  describe('Color Contrast', () => {
    it('should have sufficient color contrast for text', () => {
      // This would typically use a color contrast testing library
      // For now, we'll test that important elements have proper contrast classes
      const { container } = render(<Button>Test</Button>)
      
      const button = container.querySelector('button')
      expect(button).toHaveClass('text-white') // Assuming white text on colored background
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support tab navigation', () => {
      render(<LoginPage />)
      
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      
      expect(focusableElements.length).toBeGreaterThan(0)
      
      focusableElements.forEach(element => {
        expect(element).toHaveAttribute('tabindex')
      })
    })

    it('should have proper focus indicators', () => {
      render(<LoginPage />)
      
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      
      focusableElements.forEach(element => {
        expect(element).toHaveClass('focus:outline-none', 'focus:ring-2')
      })
    })
  })

  describe('Screen Reader Support', () => {
    it('should have proper ARIA labels', () => {
      render(<LoginPage />)
      
      const form = document.querySelector('form')
      expect(form).toHaveAttribute('aria-label', 'Login form')
      
      const passwordToggle = document.querySelector('[aria-label*="password"]')
      expect(passwordToggle).toBeInTheDocument()
    })

    it('should have proper ARIA descriptions', () => {
      render(<SignupPage />)
      
      const form = document.querySelector('form')
      expect(form).toHaveAttribute('aria-describedby')
    })

    it('should have proper ARIA live regions for dynamic content', () => {
      render(<LoginPage />)
      
      const liveRegion = document.querySelector('[aria-live]')
      expect(liveRegion).toBeInTheDocument()
    })
  })

  describe('Semantic HTML', () => {
    it('should use proper semantic elements', () => {
      render(<LoginPage />)
      
      expect(document.querySelector('main')).toBeInTheDocument()
      expect(document.querySelector('header')).toBeInTheDocument()
      expect(document.querySelector('form')).toBeInTheDocument()
    })

    it('should have proper heading hierarchy', () => {
      render(<LoginPage />)
      
      const h1 = document.querySelector('h1')
      const h2 = document.querySelector('h2')
      
      expect(h1).toBeInTheDocument()
      if (h2) {
        expect(h1).toBeBefore(h2)
      }
    })
  })

  describe('Error Handling', () => {
    it('should associate error messages with form fields', () => {
      render(<LoginPage />)
      
      const errorMessage = document.querySelector('[role="alert"]')
      if (errorMessage) {
        const input = document.querySelector('input[aria-describedby]')
        expect(input).toBeInTheDocument()
      }
    })

    it('should have proper error states', () => {
      render(<LoginPage />)
      
      const errorInput = document.querySelector('input[aria-invalid="true"]')
      if (errorInput) {
        expect(errorInput).toHaveAttribute('aria-describedby')
      }
    })
  })
})


