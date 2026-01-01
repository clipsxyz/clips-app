import React, { useRef, useState, useCallback, useEffect } from 'react';

interface ZoomableMediaProps {
  children: React.ReactNode;
  minZoom?: number;
  maxZoom?: number;
  doubleTapZoom?: number;
  className?: string;
}

/**
 * Instagram-style zoom component for images and videos (Web version)
 * Features:
 * - Pinch to zoom
 * - Drag/pan when zoomed
 * - Double-tap to zoom in/out
 * - Smooth animation
 */
export default function ZoomableMedia({
  children,
  minZoom = 1,
  maxZoom = 4,
  doubleTapZoom = 2,
  className = ''
}: ZoomableMediaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  
  // Use refs to access current values in event handlers
  const scaleRef = useRef(1);
  const translateXRef = useRef(0);
  const translateYRef = useRef(0);
  const isPinchingRef = useRef(false);
  
  // Keep refs in sync with state
  useEffect(() => {
    scaleRef.current = scale;
    translateXRef.current = translateX;
    translateYRef.current = translateY;
  }, [scale, translateX, translateY]);

  // Gesture state
  const gestureState = useRef<{
    initialDistance: number;
    initialScale: number;
    initialTranslateX: number;
    initialTranslateY: number;
    lastTouchX: number;
    lastTouchY: number;
    lastTapTime: number;
    lastTapX: number;
    lastTapY: number;
  } | null>(null);

  // Smooth animation helper
  const animateTo = useCallback((targetScale: number, targetX: number, targetY: number) => {
    setIsAnimating(true);
    setScale(targetScale);
    setTranslateX(targetX);
    setTranslateY(targetY);
    setTimeout(() => setIsAnimating(false), 300);
  }, []);

  // Reset zoom
  const resetZoom = useCallback(() => {
    animateTo(1, 0, 0);
  }, [animateTo]);

  // Calculate distance between two touches
  const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get center point between two touches
  const getTouchCenter = (touch1: Touch, touch2: Touch) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  // Use native event listeners for reliable touch handling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      // Check if touch is on an interactive element
      const target = e.target as HTMLElement;
      if (target.closest('button, a, [role="button"]')) {
        return;
      }

      if (e.touches.length === 2) {
        // Pinch gesture - prevent default and handle
        e.preventDefault();
        e.stopPropagation();
        isPinchingRef.current = true;
        setIsPinching(true);
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = getTouchDistance(touch1, touch2);
        const center = getTouchCenter(touch1, touch2);
        const rect = container.getBoundingClientRect();

        gestureState.current = {
          initialDistance: distance,
          initialScale: scaleRef.current,
          initialTranslateX: translateXRef.current,
          initialTranslateY: translateYRef.current,
          lastTouchX: center.x - rect.left,
          lastTouchY: center.y - rect.top,
          lastTapTime: 0,
          lastTapX: 0,
          lastTapY: 0
        };
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const now = Date.now();
        const timeSinceLastTap = now - lastTapTime;
        const distanceFromLastTap = Math.sqrt(
          Math.pow(touch.clientX - lastTapX, 2) + Math.pow(touch.clientY - lastTapY, 2)
        );

        // Check for double tap
        if (timeSinceLastTap < 300 && distanceFromLastTap < 50 && scaleRef.current === 1) {
          e.preventDefault();
          e.stopPropagation();
          const rect = container.getBoundingClientRect();
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const offsetX = (touch.clientX - rect.left - centerX) * (doubleTapZoom - 1);
          const offsetY = (touch.clientY - rect.top - centerY) * (doubleTapZoom - 1);
          animateTo(doubleTapZoom, -offsetX, -offsetY);
          lastTapTime = 0;
          return;
        } else if (timeSinceLastTap < 300 && distanceFromLastTap < 50 && scaleRef.current > 1) {
          // Double tap to zoom out
          e.preventDefault();
          e.stopPropagation();
          resetZoom();
          lastTapTime = 0;
          return;
        }

        // Record tap for potential double tap
        lastTapTime = now;
        lastTapX = touch.clientX;
        lastTapY = touch.clientY;

        // If zoomed, prepare for pan
        if (scaleRef.current > 1) {
          e.preventDefault();
          e.stopPropagation();
          isPinchingRef.current = false;
          setIsPinching(false);
          const rect = container.getBoundingClientRect();
          gestureState.current = {
            initialDistance: 0,
            initialScale: scaleRef.current,
            initialTranslateX: translateXRef.current,
            initialTranslateY: translateYRef.current,
            lastTouchX: touch.clientX,
            lastTouchY: touch.clientY,
            lastTapTime: 0,
            lastTapX: 0,
            lastTapY: 0
          };
        } else {
          // Not zoomed - allow scrolling
          isPinchingRef.current = false;
          setIsPinching(false);
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Check if touch is on an interactive element
      const target = e.target as HTMLElement;
      if (target.closest('button, a, [role="button"]')) {
        return;
      }

      if (e.touches.length === 2) {
        // Pinch gesture
        e.preventDefault();
        e.stopPropagation();
        isPinchingRef.current = true;
        setIsPinching(true);

        if (!gestureState.current) {
          // Initialize if we missed touchstart
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const distance = getTouchDistance(touch1, touch2);
          const center = getTouchCenter(touch1, touch2);
          const rect = container.getBoundingClientRect();

          gestureState.current = {
            initialDistance: distance,
            initialScale: scaleRef.current,
            initialTranslateX: translateXRef.current,
            initialTranslateY: translateYRef.current,
            lastTouchX: center.x - rect.left,
            lastTouchY: center.y - rect.top,
            lastTapTime: 0,
            lastTapX: 0,
            lastTapY: 0
          };
        }

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = getTouchDistance(touch1, touch2);
        const center = getTouchCenter(touch1, touch2);
        const rect = container.getBoundingClientRect();
        const centerX = center.x - rect.left;
        const centerY = center.y - rect.top;

        const scaleChange = distance / gestureState.current.initialDistance;
        const newScale = Math.max(minZoom, Math.min(maxZoom, gestureState.current.initialScale * scaleChange));

        // Calculate offset to zoom towards pinch center
        const offsetX = (centerX - rect.width / 2) * (newScale - gestureState.current.initialScale);
        const offsetY = (centerY - rect.height / 2) * (newScale - gestureState.current.initialScale);

        setScale(newScale);
        setTranslateX(gestureState.current.initialTranslateX - offsetX);
        setTranslateY(gestureState.current.initialTranslateY - offsetY);
      } else if (e.touches.length === 1 && scaleRef.current > 1 && gestureState.current) {
        // Pan gesture when zoomed
        e.preventDefault();
        e.stopPropagation();
        const touch = e.touches[0];
        const deltaX = touch.clientX - gestureState.current.lastTouchX;
        const deltaY = touch.clientY - gestureState.current.lastTouchY;

        const rect = container.getBoundingClientRect();
        const scaledWidth = rect.width * scaleRef.current;
        const scaledHeight = rect.height * scaleRef.current;
        const maxTranslateX = (scaledWidth - rect.width) / 2;
        const maxTranslateY = (scaledHeight - rect.height) / 2;

        const newX = Math.max(
          -maxTranslateX,
          Math.min(maxTranslateX, gestureState.current.initialTranslateX + deltaX)
        );
        const newY = Math.max(
          -maxTranslateY,
          Math.min(maxTranslateY, gestureState.current.initialTranslateY + deltaY)
        );

        setTranslateX(newX);
        setTranslateY(newY);
      }
      // Single touch when not zoomed - allow scrolling (don't prevent default)
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // If we were zoomed and scale is close to 1, reset
      if (scaleRef.current < 1.1 && scaleRef.current > 1 && !isPinchingRef.current) {
        resetZoom();
      }

      // Reset gesture state if no more touches
      if (e.touches.length === 0) {
        gestureState.current = null;
        isPinchingRef.current = false;
        setIsPinching(false);
      } else if (e.touches.length === 1) {
        // Update gesture state for remaining touch
        const touch = e.touches[0];
        if (gestureState.current) {
          gestureState.current.lastTouchX = touch.clientX;
          gestureState.current.lastTouchY = touch.clientY;
        }
      }
    };

    // Use capture phase and passive: false for full control
    container.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: false, capture: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart, { capture: true } as any);
      container.removeEventListener('touchmove', handleTouchMove, { capture: true } as any);
      container.removeEventListener('touchend', handleTouchEnd, { capture: true } as any);
      container.removeEventListener('touchcancel', handleTouchEnd, { capture: true } as any);
    };
  }, [minZoom, maxZoom, doubleTapZoom, animateTo, resetZoom]);

  // Handle double click (desktop)
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, [role="button"]')) {
      return;
    }

    if (scale > 1) {
      e.stopPropagation();
      resetZoom();
    } else {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const offsetX = (e.clientX - rect.left - centerX) * (doubleTapZoom - 1);
      const offsetY = (e.clientY - rect.top - centerY) * (doubleTapZoom - 1);
      animateTo(doubleTapZoom, -offsetX, -offsetY);
    }
  }, [scale, doubleTapZoom, resetZoom, animateTo]);

  // Reset zoom when scale goes back to 1
  useEffect(() => {
    if (scale === 1) {
      setTranslateX(0);
      setTranslateY(0);
    }
  }, [scale]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      onDoubleClick={handleDoubleClick}
      style={{
        touchAction: isPinching || scale > 1 ? 'none' : 'pan-y', // Allow vertical scrolling when not zooming
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        cursor: scale > 1 ? 'grab' : 'zoom-in',
        position: 'relative',
        zIndex: 0,
        pointerEvents: 'auto',
        width: '100%',
        height: '100%'
      }}
    >
      <div
        style={{
          transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
          transition: isAnimating ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          transformOrigin: 'center center',
          width: '100%',
          height: '100%'
        }}
      >
        {children}
      </div>
    </div>
  );
}
