import React, { useState, useRef, useCallback } from 'react';
import { FiRefreshCw } from 'react-icons/fi';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  maxPullDistance?: number;
  disabled?: boolean;
}

export default function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  maxPullDistance = 120,
  disabled = false
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canRefresh, setCanRefresh] = useState(false);
  
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const isPulling = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container) return;

    // Only allow pull-to-refresh when at the top of the scroll container
    if (container.scrollTop > 0) return;

    startY.current = e.touches[0].clientY;
    isPulling.current = true;
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || disabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      isPulling.current = false;
      setPullDistance(0);
      setCanRefresh(false);
      return;
    }

    currentY.current = e.touches[0].clientY;
    const deltaY = currentY.current - startY.current;

    if (deltaY > 0) {
      // Prevent default scrolling when pulling down
      e.preventDefault();
      
      // Apply resistance curve for more natural feel
      const resistance = Math.min(deltaY / 2.5, maxPullDistance);
      const distance = Math.max(0, resistance);
      
      setPullDistance(distance);
      setCanRefresh(distance >= threshold);

      // Add haptic feedback when threshold is reached
      if (distance >= threshold && !canRefresh) {
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }
    }
  }, [disabled, isRefreshing, threshold, maxPullDistance, canRefresh]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;

    isPulling.current = false;

    if (canRefresh && !isRefreshing && !disabled) {
      setIsRefreshing(true);
      
      try {
        await onRefresh();
        
        // Add success haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate([30, 10, 30]);
        }
      } catch (error) {
        console.error('Refresh failed:', error);
        
        // Add error haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
      } finally {
        setIsRefreshing(false);
      }
    }

    // Animate back to original position
    setPullDistance(0);
    setCanRefresh(false);
  }, [canRefresh, isRefreshing, disabled, onRefresh]);

  const refreshProgress = Math.min(pullDistance / threshold, 1);
  const iconRotation = refreshProgress * 180;

  return (
    <div className="relative overflow-hidden">
      {/* Pull indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-transform duration-200 ease-out z-10"
        style={{ 
          transform: `translateY(${Math.max(pullDistance - 60, -60)}px)`,
          opacity: Math.max(refreshProgress, 0)
        }}
      >
        <div className={`
          flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200
          ${canRefresh 
            ? 'bg-blue-500 text-white scale-110' 
            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }
        `}>
          <FiRefreshCw 
            size={20} 
            className={`
              transition-transform duration-200
              ${isRefreshing ? 'animate-spin' : ''}
            `}
            style={{ 
              transform: `rotate(${iconRotation}deg)` 
            }}
          />
        </div>
      </div>

      {/* Loading text */}
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          className="absolute top-0 left-0 right-0 flex items-center justify-center pt-16 transition-all duration-200"
          style={{ 
            transform: `translateY(${Math.max(pullDistance - 40, -40)}px)`,
            opacity: Math.max(refreshProgress, 0)
          }}
        >
          <p className={`
            text-sm font-medium transition-colors duration-200
            ${canRefresh 
              ? 'text-blue-600 dark:text-blue-400' 
              : 'text-gray-600 dark:text-gray-400'
            }
          `}>
            {isRefreshing 
              ? 'Refreshing...' 
              : canRefresh 
                ? 'Release to refresh' 
                : 'Pull to refresh'
            }
          </p>
        </div>
      )}

      {/* Main content */}
      <div
        ref={containerRef}
        className="relative transition-transform duration-200 ease-out"
        style={{ 
          transform: `translateY(${pullDistance}px)`,
          touchAction: isPulling.current ? 'none' : 'auto'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>

      {/* Refresh overlay */}
      {isRefreshing && (
        <div className="absolute inset-0 bg-white dark:bg-gray-950 bg-opacity-50 dark:bg-opacity-50 flex items-center justify-center z-20">
          <div className="bg-white dark:bg-gray-900 rounded-full p-4 shadow-lg">
            <FiRefreshCw className="animate-spin text-blue-500" size={24} />
          </div>
        </div>
      )}
    </div>
  );
}



