// AOP Health Check Demo
// This demonstrates the health check functionality

import { AOPHealthChecker } from '../utils/healthCheck';

// Mock browser APIs for demo
const mockBrowserAPIs = () => {
  // Mock fetch
  global.fetch = async (url: string) => {
    if (url.includes('/api/health')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ status: 'ok', timestamp: new Date().toISOString() }),
      } as Response;
    }
    if (url.includes('/api/ping')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
      } as Response;
    }
    throw new Error('Network error');
  };

  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => {
        const mockData: Record<string, string> = {
          'access_token': 'mock-access-token',
          'token_type': 'Bearer',
          'expires_at': new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        };
        return mockData[key] || null;
      },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    },
    writable: true,
  });

  // Mock navigator
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true,
  });

  // Mock performance
  Object.defineProperty(window, 'performance', {
    value: {
      now: () => Date.now(),
      getEntriesByType: () => [
        {
          loadEventEnd: Date.now(),
          loadEventStart: Date.now() - 1000,
        },
      ],
      memory: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
      },
    },
    writable: true,
  });

  // Mock IndexedDB
  Object.defineProperty(window, 'indexedDB', {
    value: {
      open: () => ({
        onsuccess: (event: any) => {
          event.target.result.close();
        },
        onerror: () => {},
        onupgradeneeded: () => {},
      }),
      deleteDatabase: () => {},
    },
    writable: true,
  });
};

// Demo function
export async function runHealthCheckDemo() {
  console.log('🏥 AOP Health Check Demo Starting...\n');

  // Mock browser APIs
  mockBrowserAPIs();

  // Create health checker instance
  const healthChecker = new AOPHealthChecker();

  try {
    // Perform initial health check
    console.log('📊 Performing initial health check...');
    const healthStatus = await healthChecker.performHealthCheck();

    console.log('\n✅ Health Check Results:');
    console.log(`Overall Status: ${healthStatus.status.toUpperCase()}`);
    console.log(`Uptime: ${Math.floor(healthStatus.uptime / 1000 / 60)} minutes`);
    console.log(`Version: ${healthStatus.version}`);
    console.log(`Timestamp: ${healthStatus.timestamp}`);

    console.log('\n🔧 Component Status:');
    healthStatus.components.forEach(component => {
      const statusIcon = component.status === 'healthy' ? '✅' : 
                        component.status === 'degraded' ? '⚠️' : 
                        component.status === 'unhealthy' ? '❌' : '❓';
      console.log(`  ${statusIcon} ${component.name}: ${component.status}`);
      if (component.details) {
        console.log(`     Details: ${component.details}`);
      }
      if (component.responseTime) {
        console.log(`     Response Time: ${component.responseTime.toFixed(0)}ms`);
      }
    });

    console.log('\n📈 Performance Metrics:');
    if (healthStatus.metrics) {
      console.log(`  API Success Rate: ${healthStatus.metrics.api.successRate.toFixed(1)}%`);
      console.log(`  API Avg Response: ${healthStatus.metrics.api.averageResponseTime.toFixed(0)}ms`);
      console.log(`  Network Status: ${healthStatus.metrics.network.online ? 'Online' : 'Offline'}`);
      console.log(`  Network Latency: ${healthStatus.metrics.network.latency.toFixed(0)}ms`);
      console.log(`  Memory Usage: ${(healthStatus.metrics.performance.memoryUsage * 100).toFixed(1)}%`);
    }

    console.log('\n🚨 Active Alerts:');
    const activeAlerts = healthStatus.alerts.filter(alert => !alert.resolved);
    if (activeAlerts.length === 0) {
      console.log('  No active alerts');
    } else {
      activeAlerts.forEach(alert => {
        const alertIcon = alert.level === 'critical' ? '🔴' : 
                         alert.level === 'error' ? '🔴' : 
                         alert.level === 'warning' ? '🟡' : '🔵';
        console.log(`  ${alertIcon} [${alert.level.toUpperCase()}] ${alert.component}: ${alert.message}`);
      });
    }

    // Demonstrate monitoring
    console.log('\n🔄 Starting continuous monitoring (5 seconds)...');
    healthChecker.startMonitoring(1000); // 1 second intervals for demo

    // Wait for a few checks
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Stop monitoring
    healthChecker.stopMonitoring();
    console.log('⏹️ Monitoring stopped');

    // Show final metrics
    const finalAlerts = healthChecker.getAlerts();
    console.log(`\n📊 Total alerts generated: ${finalAlerts.length}`);

    console.log('\n🎉 Health Check Demo Complete!');
    console.log('\nThe AOP Health Check system provides:');
    console.log('• Real-time monitoring of all application components');
    console.log('• Performance metrics tracking');
    console.log('• Alert management and resolution');
    console.log('• Comprehensive health status reporting');
    console.log('• Continuous monitoring capabilities');

  } catch (error) {
    console.error('❌ Health check demo failed:', error);
  }
}

// Run demo if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment
  (window as any).runHealthCheckDemo = runHealthCheckDemo;
  console.log('Health check demo loaded. Run window.runHealthCheckDemo() to start the demo.');
} else {
  // Node environment
  runHealthCheckDemo().catch(console.error);
}