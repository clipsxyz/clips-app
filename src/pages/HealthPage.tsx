import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiActivity, FiTrendingUp, FiAlertTriangle } from 'react-icons/fi';
import HealthStatus from '../components/HealthStatus';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/cn';

export default function HealthPage() {
  const navigate = useNavigate();
  const { healthStatus, isLoading, alerts, startMonitoring, stopMonitoring } = useHealthCheck();

  const activeAlerts = alerts.filter(alert => !alert.resolved);
  const criticalAlerts = activeAlerts.filter(alert => alert.level === 'critical' || alert.level === 'error');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="mx-auto max-w-4xl min-h-screen relative pb-[calc(80px+env(safe-area-inset-bottom))]">
        {/* Header */}
        <div className="sticky top-0 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 z-30">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="hover-scale"
              >
                <FiArrowLeft size={20} />
              </Button>
              <div className="flex items-center gap-2">
                <FiActivity className="text-indigo-600 dark:text-indigo-400" size={24} />
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  System Health
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {criticalAlerts.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-sm">
                  <FiAlertTriangle size={14} />
                  {criticalAlerts.length} Critical
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => startMonitoring(10000)} // 10 second intervals
                className="hover-scale"
              >
                <FiTrendingUp size={16} />
                Start Monitoring
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Main Health Status */}
          <HealthStatus showDetails={true} />

          {/* Quick Stats */}
          {healthStatus && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <FiActivity className="text-green-600 dark:text-green-400" size={24} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {healthStatus.components.filter(c => c.status === 'healthy').length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Healthy Components
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                    <FiAlertTriangle className="text-yellow-600 dark:text-yellow-400" size={24} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {activeAlerts.length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Active Alerts
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <FiTrendingUp className="text-blue-600 dark:text-blue-400" size={24} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {healthStatus.metrics?.api?.successRate?.toFixed(1) || '0'}%
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      API Success Rate
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* System Information */}
          {healthStatus && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                System Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Application Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Version:</span>
                      <span className="text-gray-900 dark:text-gray-100 font-mono">
                        {healthStatus.version}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Uptime:</span>
                      <span className="text-gray-900 dark:text-gray-100 font-mono">
                        {Math.floor(healthStatus.uptime / 1000 / 60)} minutes
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Last Check:</span>
                      <span className="text-gray-900 dark:text-gray-100 font-mono">
                        {new Date(healthStatus.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Performance Metrics
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Memory Usage:</span>
                      <span className="text-gray-900 dark:text-gray-100 font-mono">
                        {healthStatus.metrics?.performance?.memoryUsage ? 
                          (healthStatus.metrics.performance.memoryUsage * 100).toFixed(1) + '%' : 
                          'N/A'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Load Time:</span>
                      <span className="text-gray-900 dark:text-gray-100 font-mono">
                        {healthStatus.metrics?.performance?.loadTime ? 
                          healthStatus.metrics.performance.loadTime.toFixed(0) + 'ms' : 
                          'N/A'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Network Latency:</span>
                      <span className="text-gray-900 dark:text-gray-100 font-mono">
                        {healthStatus.metrics?.network?.latency ? 
                          healthStatus.metrics.network.latency.toFixed(0) + 'ms' : 
                          'N/A'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Component Status Grid */}
          {healthStatus && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Component Status
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {healthStatus.components.map((component) => (
                  <div
                    key={component.name}
                    className={cn(
                      "p-4 rounded-lg border transition-all duration-200",
                      component.status === 'healthy' && "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
                      component.status === 'degraded' && "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800",
                      component.status === 'unhealthy' && "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
                      component.status === 'unknown' && "bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800"
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {component.status === 'healthy' && (
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      )}
                      {component.status === 'degraded' && (
                        <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
                      )}
                      {component.status === 'unhealthy' && (
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      )}
                      {component.status === 'unknown' && (
                        <div className="w-3 h-3 bg-gray-500 rounded-full" />
                      )}
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {component.name}
                      </h4>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {component.details}
                    </p>
                    
                    {component.responseTime && (
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        Response: {component.responseTime.toFixed(0)}ms
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Actions */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Health Check Actions
            </h3>
            
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => startMonitoring(30000)}
                className="hover-scale"
              >
                Start Continuous Monitoring (30s)
              </Button>
              <Button
                variant="outline"
                onClick={() => startMonitoring(10000)}
                className="hover-scale"
              >
                Start Fast Monitoring (10s)
              </Button>
              <Button
                variant="outline"
                onClick={() => stopMonitoring()}
                className="hover-scale"
              >
                Stop Monitoring
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="hover-scale"
              >
                Refresh Application
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}