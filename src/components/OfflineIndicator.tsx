import React, { useState, useEffect } from 'react';
import { FiWifiOff, FiWifi, FiClock, FiRefreshCw } from 'react-icons/fi';
import { useOfflineMode } from '../hooks/useOfflineMode';

export default function OfflineIndicator() {
  const { isOnline, pendingActions, syncPendingActions } = useOfflineMode();
  const [showIndicator, setShowIndicator] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    // Show indicator when offline or when there are pending actions
    setShowIndicator(!isOnline || pendingActions.length > 0);
  }, [isOnline, pendingActions.length]);

  const handleRetry = async () => {
    if (isOnline && pendingActions.length > 0) {
      setIsRetrying(true);
      try {
        await syncPendingActions();
      } catch (error) {
        console.error('Retry failed:', error);
      } finally {
        setIsRetrying(false);
      }
    }
  };

  if (!showIndicator) {
    return null;
  }

  return (
    <div className="fixed top-safe left-4 right-4 z-40">
      <div className={`
        mx-auto max-w-sm rounded-lg shadow-lg border transition-all duration-300 transform
        ${!isOnline 
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        }
      `}>
        <div className="p-3">
          <div className="flex items-center gap-3">
            {/* Status Icon */}
            <div className={`
              flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
              ${!isOnline 
                ? 'bg-red-100 dark:bg-red-900/40' 
                : 'bg-yellow-100 dark:bg-yellow-900/40'
              }
            `}>
              {!isOnline ? (
                <FiWifiOff className="text-red-600 dark:text-red-400" size={16} />
              ) : (
                <FiClock className="text-yellow-600 dark:text-yellow-400" size={16} />
              )}
            </div>

            {/* Status Text */}
            <div className="flex-1 min-w-0">
              <p className={`
                text-sm font-medium
                ${!isOnline 
                  ? 'text-red-800 dark:text-red-200' 
                  : 'text-yellow-800 dark:text-yellow-200'
                }
              `}>
                {!isOnline ? 'You\'re offline' : 'Syncing changes...'}
              </p>
              <p className={`
                text-xs
                ${!isOnline 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-yellow-600 dark:text-yellow-400'
                }
              `}>
                {!isOnline 
                  ? `${pendingActions.length} actions queued`
                  : `${pendingActions.length} pending actions`
                }
              </p>
            </div>

            {/* Action Button */}
            {isOnline && pendingActions.length > 0 && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className={`
                  flex-shrink-0 p-2 rounded-full transition-colors
                  ${isRetrying 
                    ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' 
                    : 'bg-yellow-100 dark:bg-yellow-900/40 hover:bg-yellow-200 dark:hover:bg-yellow-900/60'
                  }
                `}
                aria-label="Retry sync"
              >
                <FiRefreshCw 
                  className={`
                    text-yellow-600 dark:text-yellow-400
                    ${isRetrying ? 'animate-spin' : ''}
                  `} 
                  size={16} 
                />
              </button>
            )}
          </div>

          {/* Progress Bar for Pending Actions */}
          {pendingActions.length > 0 && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                <div 
                  className={`
                    h-1 rounded-full transition-all duration-300
                    ${!isOnline 
                      ? 'bg-red-400 dark:bg-red-500' 
                      : 'bg-yellow-400 dark:bg-yellow-500'
                    }
                  `}
                  style={{ 
                    width: isOnline ? '100%' : '0%',
                    animation: isOnline ? 'pulse 2s infinite' : 'none'
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Success indicator for when actions are synced
export function SyncSuccessIndicator({ show, onHide }: { show: boolean; onHide: () => void }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onHide, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onHide]);

  if (!show) return null;

  return (
    <div className="fixed top-safe left-4 right-4 z-40">
      <div className="mx-auto max-w-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg shadow-lg">
        <div className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
              <FiWifi className="text-green-600 dark:text-green-400" size={16} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                All changes synced
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                You're back online
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



