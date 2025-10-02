import React from 'react';
import { cn } from '../../utils/cn';

interface LoadingStateProps {
  variant?: 'skeleton' | 'spinner' | 'dots' | 'pulse';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  className 
}: { 
  size?: 'sm' | 'md' | 'lg'; 
  className?: string; 
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={cn('animate-spin', sizeClasses[size], className)}>
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    </div>
  );
}

export function LoadingDots({ 
  size = 'md', 
  className 
}: { 
  size?: 'sm' | 'md' | 'lg'; 
  className?: string; 
}) {
  const dotSizes = {
    sm: 'w-1 h-1',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  };

  const gaps = {
    sm: 'gap-1',
    md: 'gap-2',
    lg: 'gap-3'
  };

  return (
    <div className={cn('flex items-center', gaps[size], className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            'rounded-full bg-current animate-pulse',
            dotSizes[size]
          )}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1s'
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonLoader({ 
  className,
  variant = 'text'
}: { 
  className?: string;
  variant?: 'text' | 'avatar' | 'image' | 'button' | 'card';
}) {
  const variants = {
    text: 'h-4 bg-gray-200 dark:bg-gray-700 rounded',
    avatar: 'w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full',
    image: 'w-full aspect-square bg-gray-200 dark:bg-gray-700 rounded-xl',
    button: 'h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg',
    card: 'h-32 w-full bg-gray-200 dark:bg-gray-700 rounded-xl'
  };

  return (
    <div 
      className={cn(
        'animate-shimmer',
        variants[variant],
        className
      )}
    />
  );
}

export function PostSkeleton() {
  return (
    <div className="mx-4 mb-6 p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <SkeletonLoader variant="avatar" />
          <div className="space-y-2">
            <SkeletonLoader className="h-4 w-24" />
            <SkeletonLoader className="h-3 w-16" />
          </div>
        </div>
        <SkeletonLoader variant="button" className="w-20 h-8" />
      </div>

      {/* Tags */}
      <div className="flex gap-2 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonLoader key={i} className="h-3 w-12" />
        ))}
      </div>

      {/* Media */}
      <SkeletonLoader variant="image" className="mb-4" />

      {/* Engagement */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonLoader key={i} className="h-8 w-16" />
          ))}
        </div>
        <SkeletonLoader className="h-8 w-12" />
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}

export function LoadingState({ 
  variant = 'spinner', 
  size = 'md', 
  className, 
  text 
}: LoadingStateProps) {
  const renderLoader = () => {
    switch (variant) {
      case 'spinner':
        return <LoadingSpinner size={size} />;
      case 'dots':
        return <LoadingDots size={size} />;
      case 'pulse':
        return (
          <div className={cn(
            'rounded-full bg-indigo-500 animate-pulse',
            size === 'sm' ? 'w-4 h-4' :
            size === 'md' ? 'w-6 h-6' :
            'w-8 h-8'
          )} />
        );
      case 'skeleton':
        return <FeedSkeleton count={1} />;
      default:
        return <LoadingSpinner size={size} />;
    }
  };

  if (variant === 'skeleton') {
    return <div className={className}>{renderLoader()}</div>;
  }

  return (
    <div className={cn(
      'flex flex-col items-center justify-center gap-3 py-8',
      className
    )}>
      <div className="text-indigo-500">
        {renderLoader()}
      </div>
      {text && (
        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
          {text}
        </p>
      )}
    </div>
  );
}

export function PageLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <div className="relative">
        <LoadingSpinner size="lg" className="text-indigo-500" />
        <div className="absolute inset-0 animate-ping">
          <LoadingSpinner size="lg" className="text-indigo-300 opacity-20" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {text}
        </p>
        <LoadingDots className="text-gray-500 dark:text-gray-400" />
      </div>
    </div>
  );
}

export function InlineLoader({ 
  text, 
  size = 'sm' 
}: { 
  text?: string; 
  size?: 'sm' | 'md' | 'lg'; 
}) {
  return (
    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
      <LoadingSpinner size={size} />
      {text && <span className="text-sm font-medium">{text}</span>}
    </div>
  );
}
