import { useRef, useEffect, RefObject } from 'react';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  preventDefaultTouchmove?: boolean;
  passive?: boolean;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

export const useSwipeGestures = <T extends HTMLElement>(
  options: SwipeGestureOptions = {}
): RefObject<T> => {
  const elementRef = useRef<T>(null);
  const touchStart = useRef<TouchPoint | null>(null);
  const touchEnd = useRef<TouchPoint | null>(null);

  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    preventDefaultTouchmove = false,
    passive = true
  } = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
      touchEnd.current = null;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (preventDefaultTouchmove) {
        e.preventDefault();
      }
      
      const touch = e.touches[0];
      touchEnd.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current || !touchEnd.current) return;

      const deltaX = touchEnd.current.x - touchStart.current.x;
      const deltaY = touchEnd.current.y - touchStart.current.y;
      const deltaTime = touchEnd.current.time - touchStart.current.time;

      // Calculate velocity (pixels per millisecond)
      const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaTime;

      // Minimum velocity for a swipe (adjust as needed)
      const minVelocity = 0.3;

      if (velocity < minVelocity) return;

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Determine if it's a horizontal or vertical swipe
      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        if (absDeltaX > threshold) {
          if (deltaX > 0) {
            onSwipeRight?.();
          } else {
            onSwipeLeft?.();
          }
        }
      } else {
        // Vertical swipe
        if (absDeltaY > threshold) {
          if (deltaY > 0) {
            onSwipeDown?.();
          } else {
            onSwipeUp?.();
          }
        }
      }

      // Reset
      touchStart.current = null;
      touchEnd.current = null;
    };

    // Add event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventDefaultTouchmove });
    element.addEventListener('touchend', handleTouchEnd, { passive });

    // Cleanup
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, preventDefaultTouchmove, passive]);

  return elementRef;
};

// Hook for double tap gesture
export const useDoubleTap = <T extends HTMLElement>(
  onDoubleTap: () => void,
  delay: number = 300
): RefObject<T> => {
  const elementRef = useRef<T>(null);
  const lastTap = useRef<number>(0);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchEnd = (e: TouchEvent) => {
      const currentTime = Date.now();
      const tapLength = currentTime - lastTap.current;

      if (tapLength < delay && tapLength > 0) {
        e.preventDefault();
        onDoubleTap();
        lastTap.current = 0;
      } else {
        lastTap.current = currentTime;
      }
    };

    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onDoubleTap, delay]);

  return elementRef;
};

// Hook for long press gesture
export const useLongPress = <T extends HTMLElement>(
  onLongPress: () => void,
  duration: number = 500
): RefObject<T> => {
  const elementRef = useRef<T>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPressed = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      isPressed.current = true;
      timeoutRef.current = setTimeout(() => {
        if (isPressed.current) {
          onLongPress();
        }
      }, duration);
    };

    const handleTouchEnd = () => {
      isPressed.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const handleTouchMove = () => {
      isPressed.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchmove', handleTouchMove);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onLongPress, duration]);

  return elementRef;
};

// Hook for pinch/zoom gesture
export const usePinchZoom = <T extends HTMLElement>(
  onPinch: (scale: number) => void,
  onPinchEnd?: (scale: number) => void
): RefObject<T> => {
  const elementRef = useRef<T>(null);
  const initialDistance = useRef<number>(0);
  const lastScale = useRef<number>(1);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const getDistance = (touches: TouchList) => {
      const touch1 = touches[0];
      const touch2 = touches[1];
      return Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance.current = getDistance(e.touches);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches);
        const scale = currentDistance / initialDistance.current;
        lastScale.current = scale;
        onPinch(scale);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        onPinchEnd?.(lastScale.current);
        initialDistance.current = 0;
        lastScale.current = 1;
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onPinch, onPinchEnd]);

  return elementRef;
};





