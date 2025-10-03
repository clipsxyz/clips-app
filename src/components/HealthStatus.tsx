import React, { useState } from 'react';
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiXCircle, FiRefreshCw, FiEye, FiEyeOff } from 'react-icons/fi';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { cn } from '../utils/cn';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface HealthStatusProps {
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

export function HealthStatus({ showDetails = false, compact = false, className }: HealthStatusProps) {
  const { healthStatus, isLoading, error, alerts, refreshHealth, resolveAlert, clearAlerts } = useHealthCheck();
  const [expanded, setExpanded] = useState(showDetails);
  const [showAlerts, setShowAlerts] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <FiCheckCircle className="text-green-500" size={16} />;
      case 'degraded':
        return <FiAlertTriangle className="text-yellow-500" size={16} />;
      case 'unhealthy':
        return <FiXCircle className="text-red-500" size={16} />;
      default:
        return <FiActivity className="text-gray-500" size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 dark:text-green-400';
      case 'degraded':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'unhealthy':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getAlertLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
      case 'error':
        return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300';
      default:
        return 'bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  const activeAlerts = alerts.filter(alert => !alert.resolved);
  const criticalAlerts = activeAlerts.filter(alert => alert.level === 'critical' || alert.level === 'error');

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        ) : healthStatus ? (
          <>
            {getStatusIcon(healthStatus.status)}
            <span className={cn("text-sm font-medium", getStatusColor(healthStatus.status))}>
              {healthStatus.status.toUpperCase()}
            </span>
            {criticalAlerts.length > 0 && (
              <span className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded-full">
                {criticalAlerts.length} alert{criticalAlerts.length > 1 ? 's' : ''}
              </span>
            )}
          </>
        ) : error ? (
          <>
            <FiXCircle className="text-red-500" size={16} />
            <span className="text-sm text-red-600 dark:text-red-400">ERROR</span>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            System Health
          </h3>
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          ) : healthStatus ? (
            <>
              {getStatusIcon(healthStatus.status)}
              <span className={cn("text-sm font-medium", getStatusColor(healthStatus.status))}>
                {healthStatus.status.toUpperCase()}
              </span>
            </>
          ) : null}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="hover-scale"
          >
            {expanded ? <FiEyeOff size={16} /> : <FiEye size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshHealth}
            disabled={isLoading}
            className="hover-scale"
          >
            <FiRefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <FiXCircle className="text-red-500" size={16} />
            <span className="text-sm text-red-700 dark:text-red-300">
              Health check failed: {error}
            </span>
          </div>
        </div>
      )}

      {healthStatus && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {Math.floor(healthStatus.uptime / 1000 / 60)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Minutes Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {healthStatus.components.length}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Components</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {activeAlerts.length}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Active Alerts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {healthStatus.version}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Version</div>
            </div>
          </div>

          {/* Alerts */}
          {activeAlerts.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Active Alerts ({activeAlerts.length})
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAlerts(!showAlerts)}
                  className="text-xs"
                >
                  {showAlerts ? 'Hide' : 'Show'} Details
                </Button>
              </div>
              
              {showAlerts && (
                <div className="space-y-2">
                  {activeAlerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        "p-3 rounded-lg border text-sm",
                        getAlertLevelColor(alert.level)
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{alert.component}</div>
                          <div className="text-xs opacity-75">{alert.message}</div>
                          <div className="text-xs opacity-50 mt-1">
                            {new Date(alert.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resolveAlert(alert.id)}
                          className="ml-2 text-xs"
                        >
                          Resolve
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {activeAlerts.length > 5 && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
                      ... and {activeAlerts.length - 5} more alerts
                    </div>
                  )}
                  
                  {activeAlerts.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAlerts}
                      className="w-full text-xs"
                    >
                      Clear All Alerts
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Component Details */}
          {expanded && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Component Status
              </h4>
              
              {healthStatus.components.map((component) => (
                <div
                  key={component.name}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(component.status)}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {component.name}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {component.details}
                      </div>
                    </div>
                  </div>
                  
                  {component.responseTime && (
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {component.responseTime.toFixed(0)}ms
                    </div>
                  )}
                </div>
              ))}

              {/* Metrics */}
              {healthStatus.metrics && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    Performance Metrics
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* API Metrics */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                        API Performance
                      </div>
                      <div className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
                        <div>Success Rate: {healthStatus.metrics.api.successRate.toFixed(1)}%</div>
                        <div>Avg Response: {healthStatus.metrics.api.averageResponseTime.toFixed(0)}ms</div>
                        <div>Total Requests: {healthStatus.metrics.api.totalRequests}</div>
                      </div>
                    </div>

                    {/* Network Metrics */}
                    <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <div className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                        Network Status
                      </div>
                      <div className="space-y-1 text-xs text-green-700 dark:text-green-300">
                        <div>Status: {healthStatus.metrics.network.online ? 'Online' : 'Offline'}</div>
                        <div>Latency: {healthStatus.metrics.network.latency.toFixed(0)}ms</div>
                        <div>Type: {healthStatus.metrics.network.connectionType}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default HealthStatus;