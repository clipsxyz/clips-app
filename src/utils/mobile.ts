// Mobile-specific utilities for Gossapp

/**
 * Device detection utilities
 */
export const device = {
  // Check if running on mobile device
  isMobile: () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  // Check if running on iOS
  isIOS: () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  },

  // Check if running on Android
  isAndroid: () => {
    return /Android/.test(navigator.userAgent);
  },

  // Check if device supports touch
  hasTouch: () => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  },

  // Get device pixel ratio
  getPixelRatio: () => {
    return window.devicePixelRatio || 1;
  },

  // Check if device is in landscape mode
  isLandscape: () => {
    return window.innerWidth > window.innerHeight;
  },

  // Get safe area insets
  getSafeAreaInsets: () => {
    const style = getComputedStyle(document.documentElement);
    return {
      top: parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0'),
      right: parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0'),
      bottom: parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
      left: parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0'),
    };
  }
};

/**
 * Haptic feedback utilities
 */
export const haptics = {
  // Light haptic feedback
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },

  // Medium haptic feedback
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  },

  // Heavy haptic feedback
  heavy: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  },

  // Success pattern
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 10, 30]);
    }
  },

  // Error pattern
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  },

  // Selection pattern
  selection: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(5);
    }
  }
};

/**
 * Touch gesture utilities
 */
export const gestures = {
  // Calculate distance between two touch points
  getDistance: (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  },

  // Calculate angle between two touch points
  getAngle: (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.atan2(dy, dx) * 180 / Math.PI;
  },

  // Get center point between two touches
  getCenter: (touch1: Touch, touch2: Touch): { x: number; y: number } => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  },

  // Detect swipe direction
  getSwipeDirection: (startX: number, startY: number, endX: number, endY: number, threshold = 50): string | null => {
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (Math.max(absDeltaX, absDeltaY) < threshold) {
      return null;
    }

    if (absDeltaX > absDeltaY) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'down' : 'up';
    }
  }
};

/**
 * Performance utilities for mobile
 */
export const performance = {
  // Throttle function for scroll events
  throttle: <T extends (...args: any[]) => any>(func: T, limit: number): T => {
    let inThrottle: boolean;
    return ((...args: any[]) => {
      if (!inThrottle) {
        func.apply(null, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }) as T;
  },

  // Debounce function for input events
  debounce: <T extends (...args: any[]) => any>(func: T, delay: number): T => {
    let timeoutId: NodeJS.Timeout;
    return ((...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    }) as T;
  },

  // Request animation frame with fallback
  requestAnimationFrame: (callback: FrameRequestCallback): number => {
    return window.requestAnimationFrame || 
           window.webkitRequestAnimationFrame || 
           ((callback: FrameRequestCallback) => window.setTimeout(callback, 1000 / 60));
  },

  // Cancel animation frame with fallback
  cancelAnimationFrame: (id: number): void => {
    (window.cancelAnimationFrame || 
     window.webkitCancelAnimationFrame || 
     window.clearTimeout)(id);
  },

  // Measure performance
  measurePerformance: (name: string, fn: () => void): void => {
    const start = performance.now();
    fn();
    const end = performance.now();
    console.log(`${name} took ${end - start} milliseconds`);
  }
};

/**
 * Network utilities
 */
export const network = {
  // Get connection info
  getConnectionInfo: () => {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      };
    }
    
    return null;
  },

  // Check if on slow connection
  isSlowConnection: (): boolean => {
    const connection = network.getConnectionInfo();
    return connection ? 
           connection.effectiveType === '2g' || 
           connection.effectiveType === 'slow-2g' ||
           connection.saveData : false;
  },

  // Check if online
  isOnline: (): boolean => {
    return navigator.onLine;
  }
};

/**
 * Storage utilities optimized for mobile
 */
export const storage = {
  // Check storage quota
  getStorageQuota: async (): Promise<{ usage: number; quota: number } | null> => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage || 0,
          quota: estimate.quota || 0
        };
      } catch (error) {
        console.error('Failed to get storage estimate:', error);
      }
    }
    return null;
  },

  // Check if storage is persistent
  isPersistent: async (): Promise<boolean> => {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        return await navigator.storage.persisted();
      } catch (error) {
        console.error('Failed to check storage persistence:', error);
      }
    }
    return false;
  },

  // Request persistent storage
  requestPersistent: async (): Promise<boolean> => {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        return await navigator.storage.persist();
      } catch (error) {
        console.error('Failed to request persistent storage:', error);
      }
    }
    return false;
  }
};

/**
 * UI utilities for mobile
 */
export const ui = {
  // Prevent zoom on double tap
  preventZoom: (element: HTMLElement): void => {
    let lastTouchEnd = 0;
    element.addEventListener('touchend', (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
  },

  // Add ripple effect
  addRipple: (element: HTMLElement, event: MouseEvent | TouchEvent): void => {
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = ('touches' in event ? event.touches[0].clientX : event.clientX) - rect.left - size / 2;
    const y = ('touches' in event ? event.touches[0].clientY : event.clientY) - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';

    element.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  },

  // Show toast notification
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 3000): void => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Trigger show animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Hide and remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Lock scroll
  lockScroll: (): void => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
  },

  // Unlock scroll
  unlockScroll: (): void => {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
  }
};

/**
 * PWA utilities
 */
export const pwa = {
  // Check if app is installed
  isInstalled: (): boolean => {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  },

  // Check if install prompt is available
  canInstall: (): boolean => {
    return 'beforeinstallprompt' in window;
  },

  // Show install prompt
  showInstallPrompt: async (deferredPrompt: any): Promise<boolean> => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      return outcome === 'accepted';
    }
    return false;
  }
};

/**
 * Accessibility utilities
 */
export const a11y = {
  // Announce to screen readers
  announce: (message: string): void => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  },

  // Check if user prefers reduced motion
  prefersReducedMotion: (): boolean => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  // Check if user prefers high contrast
  prefersHighContrast: (): boolean => {
    return window.matchMedia('(prefers-contrast: high)').matches;
  },

  // Focus management
  trapFocus: (element: HTMLElement): () => void => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    element.addEventListener('keydown', handleTabKey);

    // Return cleanup function
    return () => {
      element.removeEventListener('keydown', handleTabKey);
    };
  }
};

export default {
  device,
  haptics,
  gestures,
  performance,
  network,
  storage,
  ui,
  pwa,
  a11y
};
