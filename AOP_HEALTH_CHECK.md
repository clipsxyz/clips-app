# AOP Health Check System

## Overview

The AOP (Application Operational Performance) Health Check System is a comprehensive monitoring solution that provides real-time health status for all application components. It continuously monitors API connectivity, authentication, storage, network, and performance metrics to ensure optimal application operation.

## Features

### 🔍 **Comprehensive Monitoring**
- **API Health**: Monitors API connectivity, response times, and success rates
- **Authentication**: Tracks token validity, expiration, and session status
- **Storage**: Checks localStorage and IndexedDB availability and integrity
- **Network**: Monitors connectivity, latency, and connection type
- **Performance**: Tracks memory usage, CPU performance, and load times

### 📊 **Real-time Metrics**
- Success rates and error rates for API calls
- Average response times across all components
- Memory usage and performance indicators
- Network latency and connection status
- Uptime tracking and version information

### 🚨 **Alert Management**
- Multi-level alert system (info, warning, error, critical)
- Real-time alert generation and tracking
- Alert resolution and management
- Historical alert logging

### 🎯 **Continuous Monitoring**
- Configurable monitoring intervals
- Automatic health checks
- Background monitoring capabilities
- Start/stop monitoring controls

## Architecture

### Core Components

1. **AOPHealthChecker** (`src/utils/healthCheck.ts`)
   - Main health checking engine
   - Component health evaluation
   - Metrics collection and analysis
   - Alert management

2. **useHealthCheck Hook** (`src/hooks/useHealthCheck.ts`)
   - React hook for health status integration
   - Real-time health data access
   - Monitoring controls

3. **HealthStatus Component** (`src/components/HealthStatus.tsx`)
   - UI component for health display
   - Compact and detailed views
   - Alert management interface

4. **HealthPage** (`src/pages/HealthPage.tsx`)
   - Dedicated health monitoring page
   - Comprehensive health dashboard
   - System information display

## Usage

### Basic Health Check

```typescript
import { aopHealthChecker } from './utils/healthCheck';

// Perform a single health check
const healthStatus = await aopHealthChecker.performHealthCheck();
console.log('System Status:', healthStatus.status);
```

### React Integration

```typescript
import { useHealthCheck } from './hooks/useHealthCheck';

function MyComponent() {
  const { healthStatus, isLoading, alerts, refreshHealth } = useHealthCheck();
  
  return (
    <div>
      <h2>System Health: {healthStatus?.status}</h2>
      <button onClick={refreshHealth}>Refresh</button>
    </div>
  );
}
```

### Continuous Monitoring

```typescript
import { aopHealthChecker } from './utils/healthCheck';

// Start monitoring with 30-second intervals
aopHealthChecker.startMonitoring(30000);

// Stop monitoring
aopHealthChecker.stopMonitoring();
```

### Alert Management

```typescript
import { aopHealthChecker } from './utils/healthCheck';

// Get all alerts
const alerts = aopHealthChecker.getAlerts();

// Resolve an alert
aopHealthChecker.resolveAlert('alert-id');

// Clear all alerts
aopHealthChecker.clearAlerts();
```

## Health Status Levels

### 🟢 **Healthy**
- All components operating normally
- No critical issues detected
- Performance within acceptable ranges

### 🟡 **Degraded**
- Some components experiencing issues
- Performance may be impacted
- Non-critical alerts present

### 🔴 **Unhealthy**
- Critical components failing
- System functionality compromised
- Immediate attention required

### ❓ **Unknown**
- Unable to determine status
- Check system or network issues

## Component Health Checks

### API Health
- **Endpoint**: `/api/health`
- **Checks**: Connectivity, response time, status codes
- **Thresholds**: < 5s response time, 200 status code
- **Alerts**: Connection failures, slow responses, server errors

### Authentication Health
- **Checks**: Token validity, expiration, refresh capability
- **Thresholds**: Token expires within 5 minutes
- **Alerts**: Expired tokens, authentication failures

### Storage Health
- **Checks**: localStorage read/write, IndexedDB availability
- **Thresholds**: Successful read/write operations
- **Alerts**: Storage corruption, quota exceeded

### Network Health
- **Checks**: Online status, latency measurement
- **Thresholds**: < 2s latency, online status
- **Alerts**: Offline status, high latency

### Performance Health
- **Checks**: Memory usage, load times, CPU performance
- **Thresholds**: < 90% memory usage, < 5s load time
- **Alerts**: High memory usage, slow performance

## UI Components

### Compact Health Indicator
```typescript
<HealthStatus compact={true} className="fixed top-4 right-4" />
```

### Detailed Health Dashboard
```typescript
<HealthStatus showDetails={true} />
```

### Full Health Page
Navigate to `/health` for comprehensive health monitoring dashboard.

## Configuration

### Environment Variables
```bash
VITE_API_URL=http://localhost:8000/api
VITE_APP_VERSION=1.0.0
```

### Monitoring Intervals
- **Default**: 30 seconds
- **Fast**: 10 seconds (for critical monitoring)
- **Slow**: 60 seconds (for background monitoring)

## Testing

### Unit Tests
```bash
npm test src/utils/__tests__/healthCheck.test.ts
```

### Demo
```typescript
import { runHealthCheckDemo } from './demo/healthCheckDemo';
runHealthCheckDemo();
```

## Integration Points

### TopBar Integration
- Health status indicator in navigation
- Click to access health page
- Visual alerts for critical issues

### App-wide Monitoring
- Automatic health checks on app load
- Background monitoring during usage
- Health status display in UI

## Best Practices

### 1. **Regular Monitoring**
- Enable continuous monitoring in production
- Set appropriate monitoring intervals
- Monitor critical components more frequently

### 2. **Alert Management**
- Respond to critical alerts immediately
- Resolve alerts when issues are fixed
- Review alert history regularly

### 3. **Performance Optimization**
- Monitor memory usage trends
- Track API response times
- Optimize based on performance metrics

### 4. **User Experience**
- Display health status prominently
- Provide clear error messages
- Offer recovery options when possible

## Troubleshooting

### Common Issues

1. **Health Check Fails**
   - Check network connectivity
   - Verify API endpoint availability
   - Review browser console for errors

2. **False Alerts**
   - Adjust alert thresholds
   - Review component health logic
   - Check for temporary network issues

3. **Performance Issues**
   - Monitor memory usage
   - Check for memory leaks
   - Optimize health check frequency

### Debug Mode
```typescript
// Enable detailed logging
console.log('Health Check Debug:', healthStatus);
```

## Future Enhancements

- [ ] Custom health check endpoints
- [ ] Health check scheduling
- [ ] Advanced alerting (email, webhooks)
- [ ] Health trend analysis
- [ ] Performance benchmarking
- [ ] Health check plugins
- [ ] Distributed health monitoring

## Contributing

1. Follow existing code patterns
2. Add tests for new features
3. Update documentation
4. Ensure backward compatibility

## License

This health check system is part of the main application and follows the same licensing terms.