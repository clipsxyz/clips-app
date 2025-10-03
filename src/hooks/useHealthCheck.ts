import { useState, useEffect, useCallback } from 'react';
import { aopHealthChecker, HealthStatus, HealthAlert } from '../utils/healthCheck';

export interface UseHealthCheckReturn {
  healthStatus: HealthStatus | null;
  isLoading: boolean;
  error: string | null;
  alerts: HealthAlert[];
  refreshHealth: () => Promise<void>;
  resolveAlert: (alertId: string) => boolean;
  clearAlerts: () => void;
  startMonitoring: (intervalMs?: number) => void;
  stopMonitoring: () => void;
}

export function useHealthCheck(initialMonitoring: boolean = false): UseHealthCheckReturn {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);

  const refreshHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const status = await aopHealthChecker.performHealthCheck();
      setHealthStatus(status);
      setAlerts(aopHealthChecker.getAlerts());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Health check failed';
      setError(errorMessage);
      console.error('Health check error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resolveAlert = useCallback((alertId: string): boolean => {
    const resolved = aopHealthChecker.resolveAlert(alertId);
    if (resolved) {
      setAlerts(aopHealthChecker.getAlerts());
    }
    return resolved;
  }, []);

  const clearAlerts = useCallback(() => {
    aopHealthChecker.clearAlerts();
    setAlerts([]);
  }, []);

  const startMonitoring = useCallback((intervalMs: number = 30000) => {
    aopHealthChecker.startMonitoring(intervalMs);
  }, []);

  const stopMonitoring = useCallback(() => {
    aopHealthChecker.stopMonitoring();
  }, []);

  // Initial health check
  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  // Start monitoring if requested
  useEffect(() => {
    if (initialMonitoring) {
      startMonitoring();
      return () => stopMonitoring();
    }
  }, [initialMonitoring, startMonitoring, stopMonitoring]);

  // Update alerts periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setAlerts(aopHealthChecker.getAlerts());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    healthStatus,
    isLoading,
    error,
    alerts,
    refreshHealth,
    resolveAlert,
    clearAlerts,
    startMonitoring,
    stopMonitoring
  };
}