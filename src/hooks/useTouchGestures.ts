import { useRef, useEffect, RefObject } from 'react';

interface TouchGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  onPinch?: (scale: number) => void;
  threshold?: number;
  doubleTapDelay?: number;
  longPressDelay?: number;
  preventDefaultTouchmove?: boolean;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

export const useTouchGestures = <T extends HTMLElement>(
  options: TouchGestureOptions = {}
): RefObject<T> => {
  const elementRef = useRef<T>(null);
  const touchStart = useRef<TouchPoint | null>(null);
  const touchEnd = useRef<TouchPoint | null>(null);
  const lastTap = useRef<number>(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const initialDistance = useRef<number>(0);
  const isPressed = useRef(false);

  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onDoubleTap,
    onLongPress,
    onPinch,
    threshold = 50,
    doubleTapDelay = 300,
    longPressDelay = 500,
    preventDefaultTouchmove = false
  } = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const getDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const touch1 = touches[0];
      const touch2 = touches[1];
      return Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const currentTime = Date.now();
      
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: currentTime
      };
      touchEnd.current = null;
      isPressed.current = true;

      // Handle pinch gesture
      if (e.touches.length === 2 && onPinch) {
        initialDistance.current = getDistance(e.touches);
      }

      // Handle long press
      if (onLongPress) {
        longPressTimer.current = setTimeout(() => {
          if (isPressed.current) {
            onLongPress();
            // Add haptic feedback if available
            if ('vibrate' in navigator) {
              navigator.vibrate(50);
            }
          }
        }, longPressDelay);
      }

      // Handle double tap
      if (onDoubleTap) {
        const tapLength = currentTime - lastTap.current;
        if (tapLength < doubleTapDelay && tapLength > 0) {
          e.preventDefault();
          onDoubleTap();
          lastTap.current = 0;
          // Add haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate([30, 10, 30]);
          }
        } else {
          lastTap.current = currentTime;
        }
      }
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

      // Cancel long press on move
      isPressed.current = false;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      // Handle pinch gesture
      if (e.touches.length === 2 && onPinch && initialDistance.current > 0) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches);
        const scale = currentDistance / initialDistance.current;
        onPinch(scale);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      isPressed.current = false;
      
      // Clear long press timer
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      // Reset pinch
      if (e.touches.length < 2) {
        initialDistance.current = 0;
      }

      if (!touchStart.current || !touchEnd.current) return;

      const deltaX = touchEnd.current.x - touchStart.current.x;
      const deltaY = touchEnd.current.y - touchStart.current.y;
      const deltaTime = touchEnd.current.time - touchStart.current.time;

      // Calculate velocity (pixels per millisecond)
      const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaTime;
      const minVelocity = 0.3;

      if (velocity < minVelocity) return;

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Determine swipe direction
      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        if (absDeltaX > threshold) {
          if (deltaX > 0) {
            onSwipeRight?.();
          } else {
            onSwipeLeft?.();
          }
          // Add haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate(20);
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
          // Add haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate(20);
          }
        }
      }

      // Reset
      touchStart.current = null;
      touchEnd.current = null;
    };

    // Add event listeners with passive option for better performance
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventDefaultTouchmove });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Cleanup
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, [
    onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown,
    onDoubleTap, onLongPress, onPinch,
    threshold, doubleTapDelay, longPressDelay, preventDefaultTouchmove
  ]);

  return elementRef;
};
