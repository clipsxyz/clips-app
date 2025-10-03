import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AOPHealthChecker } from '../healthCheck';

// Mock fetch globally
global.fetch = vi.fn();

describe('AOPHealthChecker', () => {
  let healthChecker: AOPHealthChecker;

  beforeEach(() => {
    healthChecker = new AOPHealthChecker();
    vi.clearAllMocks();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
    });

    // Mock performance
    Object.defineProperty(window, 'performance', {
      value: {
        now: vi.fn(() => Date.now()),
        getEntriesByType: vi.fn(() => []),
        memory: {
          usedJSHeapSize: 1000000,
          totalJSHeapSize: 2000000,
        },
      },
      writable: true,
    });
  });

  afterEach(() => {
    healthChecker.stopMonitoring();
  });

  describe('API Health Check', () => {
    it('should return healthy status when API responds successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ status: 'ok' }),
      } as Response);

      const result = await healthChecker.performHealthCheck();
      
      expect(result.status).toBe('healthy');
      expect(result.components).toHaveLength(5);
      
      const apiComponent = result.components.find(c => c.name === 'API');
      expect(apiComponent).toBeDefined();
      expect(apiComponent?.status).toBe('healthy');
    });

    it('should return degraded status when API returns error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: 'Internal server error' }),
      } as Response);

      const result = await healthChecker.performHealthCheck();
      
      expect(result.status).toBe('degraded');
      
      const apiComponent = result.components.find(c => c.name === 'API');
      expect(apiComponent?.status).toBe('degraded');
    });

    it('should return unhealthy status when API connection fails', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await healthChecker.performHealthCheck();
      
      expect(result.status).toBe('unhealthy');
      
      const apiComponent = result.components.find(c => c.name === 'API');
      expect(apiComponent?.status).toBe('unhealthy');
    });
  });

  describe('Authentication Health Check', () => {
    it('should return healthy status when no token is present', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const result = await healthChecker.performHealthCheck();
      
      const authComponent = result.components.find(c => c.name === 'Authentication');
      expect(authComponent?.status).toBe('healthy');
    });

    it('should return healthy status when token is valid', async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      vi.mocked(localStorage.getItem)
        .mockReturnValueOnce('valid-token') // access_token
        .mockReturnValueOnce('Bearer') // token_type
        .mockReturnValueOnce(futureTime); // expires_at

      const result = await healthChecker.performHealthCheck();
      
      const authComponent = result.components.find(c => c.name === 'Authentication');
      expect(authComponent?.status).toBe('healthy');
    });

    it('should return degraded status when token is expired', async () => {
      const pastTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      vi.mocked(localStorage.getItem)
        .mockReturnValueOnce('expired-token') // access_token
        .mockReturnValueOnce('Bearer') // token_type
        .mockReturnValueOnce(pastTime); // expires_at

      const result = await healthChecker.performHealthCheck();
      
      const authComponent = result.components.find(c => c.name === 'Authentication');
      expect(authComponent?.status).toBe('degraded');
    });
  });

  describe('Storage Health Check', () => {
    it('should return healthy status when localStorage works correctly', async () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {});
      vi.mocked(localStorage.getItem).mockImplementation((key) => {
        if (key === 'health_check_test') return Date.now().toString();
        return null;
      });
      vi.mocked(localStorage.removeItem).mockImplementation(() => {});

      const result = await healthChecker.performHealthCheck();
      
      const storageComponent = result.components.find(c => c.name === 'Storage');
      expect(storageComponent?.status).toBe('healthy');
    });

    it('should return unhealthy status when localStorage is corrupted', async () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {});
      vi.mocked(localStorage.getItem).mockImplementation((key) => {
        if (key === 'health_check_test') return 'different-value';
        return null;
      });
      vi.mocked(localStorage.removeItem).mockImplementation(() => {});

      const result = await healthChecker.performHealthCheck();
      
      const storageComponent = result.components.find(c => c.name === 'Storage');
      expect(storageComponent?.status).toBe('unhealthy');
    });
  });

  describe('Network Health Check', () => {
    it('should return healthy status when online', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
      });

      const result = await healthChecker.performHealthCheck();
      
      const networkComponent = result.components.find(c => c.name === 'Network');
      expect(networkComponent?.status).toBe('healthy');
    });

    it('should return unhealthy status when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      const result = await healthChecker.performHealthCheck();
      
      const networkComponent = result.components.find(c => c.name === 'Network');
      expect(networkComponent?.status).toBe('unhealthy');
    });
  });

  describe('Performance Health Check', () => {
    it('should return healthy status when performance is good', async () => {
      vi.mocked(window.performance.memory).value = {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
      };

      const result = await healthChecker.performHealthCheck();
      
      const performanceComponent = result.components.find(c => c.name === 'Performance');
      expect(performanceComponent?.status).toBe('healthy');
    });

    it('should return degraded status when memory usage is high', async () => {
      vi.mocked(window.performance.memory).value = {
        usedJSHeapSize: 1900000, // 95% usage
        totalJSHeapSize: 2000000,
      };

      const result = await healthChecker.performHealthCheck();
      
      const performanceComponent = result.components.find(c => c.name === 'Performance');
      expect(performanceComponent?.status).toBe('degraded');
    });
  });

  describe('Monitoring', () => {
    it('should start and stop monitoring', () => {
      const startSpy = vi.spyOn(healthChecker, 'performHealthCheck');
      
      healthChecker.startMonitoring(100); // 100ms interval for testing
      
      // Wait for at least one check
      setTimeout(() => {
        expect(startSpy).toHaveBeenCalled();
        healthChecker.stopMonitoring();
      }, 150);
    });
  });

  describe('Alert Management', () => {
    it('should add and resolve alerts', () => {
      const alerts = healthChecker.getAlerts();
      expect(alerts).toHaveLength(0);

      // Add an alert
      healthChecker['addAlert']('error', 'TestComponent', 'Test message');
      
      const newAlerts = healthChecker.getAlerts();
      expect(newAlerts).toHaveLength(1);
      expect(newAlerts[0].level).toBe('error');
      expect(newAlerts[0].component).toBe('TestComponent');
      expect(newAlerts[0].message).toBe('Test message');
      expect(newAlerts[0].resolved).toBe(false);

      // Resolve the alert
      const resolved = healthChecker.resolveAlert(newAlerts[0].id);
      expect(resolved).toBe(true);

      const resolvedAlerts = healthChecker.getAlerts();
      expect(resolvedAlerts[0].resolved).toBe(true);
    });

    it('should clear all alerts', () => {
      healthChecker['addAlert']('error', 'TestComponent1', 'Test message 1');
      healthChecker['addAlert']('warning', 'TestComponent2', 'Test message 2');
      
      expect(healthChecker.getAlerts()).toHaveLength(2);
      
      healthChecker.clearAlerts();
      expect(healthChecker.getAlerts()).toHaveLength(0);
    });
  });

  describe('Overall Status Determination', () => {
    it('should return unhealthy when any component is unhealthy', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await healthChecker.performHealthCheck();
      expect(result.status).toBe('unhealthy');
    });

    it('should return degraded when any component is degraded', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: 'Server error' }),
      } as Response);

      const result = await healthChecker.performHealthCheck();
      expect(result.status).toBe('degraded');
    });

    it('should return healthy when all components are healthy', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ status: 'ok' }),
      } as Response);

      const result = await healthChecker.performHealthCheck();
      expect(result.status).toBe('healthy');
    });
  });
});