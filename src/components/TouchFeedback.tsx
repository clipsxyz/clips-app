import React, { useState, useRef, useCallback } from 'react';

interface TouchFeedbackProps {
  children: React.ReactNode;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  className?: string;
  disabled?: boolean;
  hapticFeedback?: boolean;
  rippleEffect?: boolean;
  scaleEffect?: boolean;
  doubleTapDelay?: number;
  longPressDelay?: number;
}

interface RippleEffect {
  id: string;
  x: number;
  y: number;
  timestamp: number;
}

export default function TouchFeedback({
  children,
  onTap,
  onDoubleTap,
  onLongPress,
  className = '',
  disabled = false,
  hapticFeedback = true,
  rippleEffect = true,
  scaleEffect = true,
  doubleTapDelay = 300,
  longPressDelay = 500
}: TouchFeedbackProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [ripples, setRipples] = useState<RippleEffect[]>([]);
  
  const elementRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef<number>(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const pressStartTime = useRef<number>(0);

  const triggerHaptic = useCallback((pattern: number | number[]) => {
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, [hapticFeedback]);

  const addRipple = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!rippleEffect || disabled) return;

    const rect = elementRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

    const newRipple: RippleEffect = {
      id: `ripple-${Date.now()}-${Math.random()}`,
      x,
      y,
      timestamp: Date.now()
    };

    setRipples(prev => [...prev, newRipple]);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
    }, 600);
  }, [rippleEffect, disabled]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;

    setIsPressed(true);
    pressStartTime.current = Date.now();
    addRipple(e);

    // Start long press timer
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        if (isPressed) {
          onLongPress();
          triggerHaptic(50);
          setIsPressed(false);
        }
      }, longPressDelay);
    }
  }, [disabled, addRipple, onLongPress, longPressDelay, triggerHaptic, isPressed]);

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;

    setIsPressed(false);
    const pressDuration = Date.now() - pressStartTime.current;

    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Only trigger tap if it wasn't a long press
    if (pressDuration < longPressDelay) {
      const currentTime = Date.now();
      const tapLength = currentTime - lastTap.current;

      if (onDoubleTap && tapLength < doubleTapDelay && tapLength > 0) {
        // Double tap
        onDoubleTap();
        triggerHaptic([30, 10, 30]);
        lastTap.current = 0;
      } else {
        // Single tap
        if (onTap) {
          onTap();
          triggerHaptic(20);
        }
        lastTap.current = currentTime;
      }
    }
  }, [disabled, longPressDelay, onDoubleTap, doubleTapDelay, onTap, triggerHaptic]);

  const handleTouchMove = useCallback(() => {
    // Cancel long press on move
    setIsPressed(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Mouse events for desktop compatibility
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    setIsPressed(true);
    addRipple(e);
  }, [disabled, addRipple]);

  const handleMouseUp = useCallback(() => {
    if (disabled) return;
    setIsPressed(false);
    if (onTap) {
      onTap();
    }
  }, [disabled, onTap]);

  const handleMouseLeave = useCallback(() => {
    setIsPressed(false);
  }, []);

  return (
    <div
      ref={elementRef}
      className={`
        relative overflow-hidden select-none cursor-pointer transition-transform duration-150 ease-out
        ${scaleEffect && isPressed ? 'scale-95' : 'scale-100'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      }}
    >
      {children}

      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          className="absolute pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="w-0 h-0 bg-white bg-opacity-30 rounded-full animate-ping-once" 
               style={{
                 animation: 'ripple 0.6s ease-out forwards'
               }} 
          />
        </div>
      ))}

      {/* Press overlay */}
      {isPressed && (
        <div className="absolute inset-0 bg-black bg-opacity-5 dark:bg-white dark:bg-opacity-5 pointer-events-none" />
      )}
    </div>
  );
}

// Add custom CSS for ripple animation
const style = document.createElement('style');
style.textContent = `
  @keyframes ripple {
    0% {
      width: 0;
      height: 0;
      opacity: 1;
    }
    100% {
      width: 200px;
      height: 200px;
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
