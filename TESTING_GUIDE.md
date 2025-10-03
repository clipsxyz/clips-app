# Testing Guide

This guide covers the comprehensive testing suite for the Gossapp frontend application.

## Overview

Our testing strategy includes:
- **Unit Tests** - Individual component and function testing
- **Integration Tests** - Component interaction testing
- **Accessibility Tests** - WCAG 2.1 AA compliance
- **Performance Tests** - Render time and memory usage
- **E2E Tests** - Full user flow testing (planned)

## Test Structure

```
src/
├── test/
│   ├── setup.ts              # Test environment setup
│   ├── test-utils.tsx        # Custom render utilities
│   ├── accessibility.test.ts # Accessibility compliance tests
│   └── performance.test.ts   # Performance benchmarks
├── components/
│   └── __tests__/
│       ├── Button.test.tsx   # Component unit tests
│       └── App.test.tsx      # App integration tests
├── pages/
│   └── __tests__/
│       ├── LoginPage.test.tsx
│       └── SignupPage.test.tsx
├── hooks/
│   └── __tests__/
│       └── useAuth.test.ts
└── utils/
    └── __tests__/
        └── api.test.ts
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests once (CI mode)
npm run test:run

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

### Specialized Tests

```bash
# Run accessibility tests only
npm run test:accessibility

# Run performance tests only
npm run test:performance
```

## Test Configuration

### Vitest Configuration (`vitest.config.ts`)

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.d.ts']
    }
  }
})
```

### Test Setup (`src/test/setup.ts`)

- Mock browser APIs (localStorage, sessionStorage, fetch)
- Configure testing library
- Set up global mocks and utilities

## Writing Tests

### Component Tests

```typescript
import { render, screen, fireEvent } from '../test/test-utils'
import { Button } from '../ui/Button'

describe('Button Component', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('handles click events', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### Page Tests

```typescript
import { render, screen, fireEvent, waitFor } from '../test/test-utils'
import { LoginPage } from '../LoginPage'

describe('LoginPage', () => {
  it('validates form fields', async () => {
    render(<LoginPage />)
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Please fill in all fields')).toBeInTheDocument()
    })
  })
})
```

### Hook Tests

```typescript
import { renderHook, act } from '@testing-library/react'
import { useAuth } from '../context/Auth'

describe('useAuth Hook', () => {
  it('handles successful login', async () => {
    const { result } = renderHook(() => useAuth())
    
    await act(async () => {
      await result.current.login('test@example.com', 'password123')
    })
    
    expect(result.current.user).toBeDefined()
    expect(result.current.isAuthenticated).toBe(true)
  })
})
```

## Accessibility Testing

### WCAG 2.1 AA Compliance

Our accessibility tests ensure:
- **Color Contrast** - Minimum 4.5:1 ratio for normal text
- **Keyboard Navigation** - All interactive elements accessible via keyboard
- **Screen Reader Support** - Proper ARIA labels and semantic HTML
- **Focus Management** - Visible focus indicators and logical tab order

### Example Accessibility Test

```typescript
import { axe, toHaveNoViolations } from 'jest-axe'

it('should not have accessibility violations', async () => {
  const { container } = render(<LoginPage />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

## Performance Testing

### Metrics Tracked

- **Render Time** - Component initialization speed
- **Memory Usage** - Memory leaks and garbage collection
- **Bundle Size** - JavaScript bundle optimization
- **Network Performance** - API call efficiency

### Example Performance Test

```typescript
it('should render within acceptable time', () => {
  const startTime = performance.now()
  render(<LoginPage />)
  const endTime = performance.now()
  
  expect(endTime - startTime).toBeLessThan(50) // 50ms threshold
})
```

## Mocking Strategies

### API Mocking

```typescript
// Mock API responses
const mockApiResponse = (data: any, success = true) => {
  return Promise.resolve({
    ok: success,
    json: () => Promise.resolve({ success, data })
  })
}

// Mock fetch
global.fetch = vi.fn().mockImplementation(mockApiResponse)
```

### Context Mocking

```typescript
// Mock React Context
vi.mock('../context/Auth', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn()
  })
}))
```

### Router Mocking

```typescript
// Mock React Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/' })
  }
})
```

## Test Utilities

### Custom Render Function

```typescript
// src/test/test-utils.tsx
const AllTheProviders = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </AuthProvider>
  </BrowserRouter>
)

const customRender = (ui, options) => 
  render(ui, { wrapper: AllTheProviders, ...options })
```

### Mock Data

```typescript
// src/test/test-utils.tsx
export const mockUser = {
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  username: 'testuser'
}

export const mockPost = {
  id: '1',
  content: 'Test post content',
  user: mockUser,
  likesCount: 5,
  commentsCount: 2
}
```

## Coverage Goals

- **Statements**: 90%
- **Branches**: 85%
- **Functions**: 90%
- **Lines**: 90%

## Best Practices

### 1. Test Structure
- Use descriptive test names
- Group related tests with `describe` blocks
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Component Testing
- Test user interactions, not implementation details
- Use semantic queries (`getByRole`, `getByLabelText`)
- Test error states and edge cases

### 3. Accessibility
- Include accessibility tests for all components
- Test keyboard navigation and screen reader support
- Validate ARIA attributes and semantic HTML

### 4. Performance
- Set performance budgets for render times
- Monitor memory usage and potential leaks
- Test with realistic data volumes

### 5. Maintenance
- Keep tests simple and focused
- Update tests when requirements change
- Remove obsolete tests and mocks

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - run: npm run test:accessibility
      - run: npm run test:performance
```

### Coverage Reporting

- HTML coverage reports in `coverage/` directory
- JSON coverage for CI integration
- Coverage thresholds enforced in CI

## Troubleshooting

### Common Issues

1. **Test Timeouts**
   - Increase timeout for async operations
   - Use `waitFor` for DOM updates

2. **Mock Issues**
   - Ensure mocks are reset between tests
   - Check mock implementation matches real API

3. **Accessibility Failures**
   - Review ARIA attributes and semantic HTML
   - Check color contrast ratios
   - Validate keyboard navigation

4. **Performance Fluctuations**
   - Run tests multiple times to get averages
   - Consider system load and background processes
   - Set reasonable performance budgets

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)
- [Axe Core Accessibility](https://github.com/dequelabs/axe-core)
- [Web Vitals](https://web.dev/vitals/)

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure accessibility compliance
3. Check performance impact
4. Update this guide if needed

For questions or issues, please refer to the project documentation or create an issue in the repository.


