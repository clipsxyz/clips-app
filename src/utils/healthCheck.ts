// AOP (Application Operational Performance) Health Check System
// Comprehensive health monitoring for all application components

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  timestamp: string;
  uptime: number;
  version: string;
  components: ComponentHealth[];
  metrics: HealthMetrics;
  alerts: HealthAlert[];
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime?: number;
  lastCheck: string;
  details?: string;
  dependencies?: string[];
}

export interface HealthMetrics {
  api: {
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
  };
  auth: {
    activeSessions: number;
    failedLogins: number;
    tokenRefreshRate: number;
  };
  storage: {
    usage: number;
    quota: number;
    persistence: boolean;
  };
  network: {
    online: boolean;
    connectionType: string;
    latency: number;
  };
  performance: {
    memoryUsage: number;
    cpuUsage: number;
    loadTime: number;
  };
}

export interface HealthAlert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

class AOPHealthChecker {
  private startTime: number;
  private metrics: Partial<HealthMetrics> = {};
  private alerts: HealthAlert[] = [];
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startTime = Date.now();
    this.initializeMetrics();
  }

  private initializeMetrics() {
    this.metrics = {
      api: {
        totalRequests: 0,
        successRate: 100,
        averageResponseTime: 0,
        errorRate: 0
      },
      auth: {
        activeSessions: 0,
        failedLogins: 0,
        tokenRefreshRate: 100
      },
      storage: {
        usage: 0,
        quota: 0,
        persistence: false
      },
      network: {
        online: navigator.onLine,
        connectionType: 'unknown',
        latency: 0
      },
      performance: {
        memoryUsage: 0,
        cpuUsage: 0,
        loadTime: 0
      }
    };
  }

  // Start continuous health monitoring
  startMonitoring(intervalMs: number = 30000) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);

    // Initial health check
    this.performHealthCheck();
  }

  // Stop health monitoring
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Perform comprehensive health check
  async performHealthCheck(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;

    try {
      // Check all components in parallel
      const [
        apiHealth,
        authHealth,
        storageHealth,
        networkHealth,
        performanceHealth
      ] = await Promise.allSettled([
        this.checkAPIHealth(),
        this.checkAuthHealth(),
        this.checkStorageHealth(),
        this.checkNetworkHealth(),
        this.checkPerformanceHealth()
      ]);

      const components: ComponentHealth[] = [
        this.processHealthResult('API', apiHealth),
        this.processHealthResult('Authentication', authHealth),
        this.processHealthResult('Storage', storageHealth),
        this.processHealthResult('Network', networkHealth),
        this.processHealthResult('Performance', performanceHealth)
      ];

      // Determine overall status
      const overallStatus = this.determineOverallStatus(components);

      const healthStatus: HealthStatus = {
        status: overallStatus,
        timestamp,
        uptime,
        version: this.getAppVersion(),
        components,
        metrics: this.metrics as HealthMetrics,
        alerts: this.alerts
      };

      // Log health status
      console.log('AOP Health Check:', healthStatus);

      return healthStatus;
    } catch (error) {
      console.error('Health check failed:', error);
      this.addAlert('critical', 'HealthChecker', 'Health check system failure');
      
      return {
        status: 'unhealthy',
        timestamp,
        uptime,
        version: this.getAppVersion(),
        components: [],
        metrics: this.metrics as HealthMetrics,
        alerts: this.alerts
      };
    }
  }

  // Check API health
  private async checkAPIHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Test API connectivity with a simple request
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        this.updateAPIMetrics(true, responseTime);
        return {
          name: 'API',
          status: 'healthy',
          responseTime,
          lastCheck: new Date().toISOString(),
          details: `API responding normally (${responseTime}ms)`
        };
      } else {
        this.updateAPIMetrics(false, responseTime);
        this.addAlert('error', 'API', `API returned ${response.status}`);
        return {
          name: 'API',
          status: 'degraded',
          responseTime,
          lastCheck: new Date().toISOString(),
          details: `API returned status ${response.status}`
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateAPIMetrics(false, responseTime);
      this.addAlert('critical', 'API', 'API connection failed');
      
      return {
        name: 'API',
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        details: `API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Check authentication health
  private async checkAuthHealth(): Promise<ComponentHealth> {
    try {
      const token = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (!token) {
        return {
          name: 'Authentication',
          status: 'healthy',
          lastCheck: new Date().toISOString(),
          details: 'No active session (user not logged in)'
        };
      }

      // Check token expiration
      const expiresAt = localStorage.getItem('expires_at');
      if (expiresAt) {
        const expirationTime = new Date(expiresAt).getTime();
        const now = Date.now();
        const timeUntilExpiry = expirationTime - now;

        if (timeUntilExpiry < 0) {
          this.addAlert('warning', 'Authentication', 'Access token expired');
          return {
            name: 'Authentication',
            status: 'degraded',
            lastCheck: new Date().toISOString(),
            details: 'Access token has expired'
          };
        } else if (timeUntilExpiry < 300000) { // 5 minutes
          this.addAlert('info', 'Authentication', 'Access token expiring soon');
        }
      }

      return {
        name: 'Authentication',
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        details: 'Authentication system operational'
      };
    } catch (error) {
      this.addAlert('error', 'Authentication', 'Authentication check failed');
      return {
        name: 'Authentication',
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        details: `Authentication check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Check storage health
  private async checkStorageHealth(): Promise<ComponentHealth> {
    try {
      // Check localStorage availability
      const testKey = 'health_check_test';
      const testValue = Date.now().toString();
      
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      if (retrieved !== testValue) {
        this.addAlert('critical', 'Storage', 'LocalStorage corruption detected');
        return {
          name: 'Storage',
          status: 'unhealthy',
          lastCheck: new Date().toISOString(),
          details: 'LocalStorage corruption detected'
        };
      }

      // Check IndexedDB if available
      let indexedDBHealthy = true;
      if ('indexedDB' in window) {
        try {
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('health_check_db', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = () => {
              const db = request.result;
              db.createObjectStore('test');
            };
          });
          
          if (db) {
            (db as IDBDatabase).close();
            indexedDB.deleteDatabase('health_check_db');
          }
        } catch (error) {
          indexedDBHealthy = false;
          this.addAlert('warning', 'Storage', 'IndexedDB not available');
        }
      }

      return {
        name: 'Storage',
        status: indexedDBHealthy ? 'healthy' : 'degraded',
        lastCheck: new Date().toISOString(),
        details: 'Storage systems operational'
      };
    } catch (error) {
      this.addAlert('critical', 'Storage', 'Storage check failed');
      return {
        name: 'Storage',
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        details: `Storage check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Check network health
  private async checkNetworkHealth(): Promise<ComponentHealth> {
    try {
      const online = navigator.onLine;
      
      if (!online) {
        this.addAlert('critical', 'Network', 'Device is offline');
        return {
          name: 'Network',
          status: 'unhealthy',
          lastCheck: new Date().toISOString(),
          details: 'Device is offline'
        };
      }

      // Test network latency
      const latency = await this.measureLatency();
      
      // Check connection type if available
      const connection = (navigator as any).connection;
      const connectionType = connection ? connection.effectiveType || 'unknown' : 'unknown';

      let status: ComponentHealth['status'] = 'healthy';
      if (latency > 2000) {
        status = 'degraded';
        this.addAlert('warning', 'Network', 'High network latency detected');
      }

      return {
        name: 'Network',
        status,
        responseTime: latency,
        lastCheck: new Date().toISOString(),
        details: `Online, ${connectionType} connection, ${latency}ms latency`
      };
    } catch (error) {
      this.addAlert('error', 'Network', 'Network check failed');
      return {
        name: 'Network',
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        details: `Network check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Check performance health
  private async checkPerformanceHealth(): Promise<ComponentHealth> {
    try {
      // Check memory usage if available
      const memory = (performance as any).memory;
      const memoryUsage = memory ? memory.usedJSHeapSize / memory.totalJSHeapSize : 0;

      // Check if memory usage is high
      let status: ComponentHealth['status'] = 'healthy';
      if (memoryUsage > 0.9) {
        status = 'degraded';
        this.addAlert('warning', 'Performance', 'High memory usage detected');
      }

      // Check page load performance
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const loadTime = navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0;

      if (loadTime > 5000) {
        status = 'degraded';
        this.addAlert('warning', 'Performance', 'Slow page load detected');
      }

      return {
        name: 'Performance',
        status,
        lastCheck: new Date().toISOString(),
        details: `Memory: ${(memoryUsage * 100).toFixed(1)}%, Load time: ${loadTime.toFixed(0)}ms`
      };
    } catch (error) {
      this.addAlert('error', 'Performance', 'Performance check failed');
      return {
        name: 'Performance',
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        details: `Performance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Helper methods
  private processHealthResult(name: string, result: PromiseSettledResult<ComponentHealth>): ComponentHealth {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      this.addAlert('error', name, `Health check failed: ${result.reason}`);
      return {
        name,
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        details: `Health check failed: ${result.reason}`
      };
    }
  }

  private determineOverallStatus(components: ComponentHealth[]): HealthStatus['status'] {
    const statuses = components.map(c => c.status);
    
    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    } else if (statuses.includes('degraded')) {
      return 'degraded';
    } else if (statuses.every(s => s === 'healthy')) {
      return 'healthy';
    } else {
      return 'unknown';
    }
  }

  private async measureLatency(): Promise<number> {
    const startTime = performance.now();
    try {
      await fetch('/api/ping', {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      });
      return performance.now() - startTime;
    } catch {
      // Fallback to a simple measurement
      return performance.now() - startTime;
    }
  }

  private updateAPIMetrics(success: boolean, responseTime: number) {
    if (!this.metrics.api) return;

    this.metrics.api.totalRequests++;
    this.metrics.api.averageResponseTime = 
      (this.metrics.api.averageResponseTime * (this.metrics.api.totalRequests - 1) + responseTime) / 
      this.metrics.api.totalRequests;

    if (success) {
      this.metrics.api.successRate = 
        (this.metrics.api.successRate * (this.metrics.api.totalRequests - 1) + 100) / 
        this.metrics.api.totalRequests;
    } else {
      this.metrics.api.errorRate = 
        (this.metrics.api.errorRate * (this.metrics.api.totalRequests - 1) + 1) / 
        this.metrics.api.totalRequests;
    }
  }

  private addAlert(level: HealthAlert['level'], component: string, message: string) {
    const alert: HealthAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      component,
      message,
      timestamp: new Date().toISOString(),
      resolved: false
    };

    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Log critical alerts
    if (level === 'critical' || level === 'error') {
      console.error(`AOP Health Alert [${level.toUpperCase()}] ${component}: ${message}`);
    }
  }

  private getAppVersion(): string {
    return import.meta.env.VITE_APP_VERSION || '1.0.0';
  }

  // Public methods for external access
  getCurrentHealth(): HealthStatus {
    return {
      status: 'unknown',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: this.getAppVersion(),
      components: [],
      metrics: this.metrics as HealthMetrics,
      alerts: this.alerts
    };
  }

  getAlerts(): HealthAlert[] {
    return this.alerts;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  clearAlerts(): void {
    this.alerts = [];
  }
}

// Create singleton instance
export const aopHealthChecker = new AOPHealthChecker();

// Export types and instance
export { AOPHealthChecker };
export default aopHealthChecker;