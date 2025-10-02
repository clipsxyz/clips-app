import React from 'react';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'text';
  className?: string;
  animated?: boolean;
}

const sizeClasses = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8', 
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16'
};

const textSizeClasses = {
  xs: 'text-lg',
  sm: 'text-xl',
  md: 'text-2xl', 
  lg: 'text-3xl',
  xl: 'text-4xl'
};

export default function Logo({ 
  size = 'md', 
  variant = 'full', 
  className = '', 
  animated = false 
}: LogoProps) {
  const LogoIcon = ({ className: iconClassName = '' }: { className?: string }) => (
    <div className={`relative ${sizeClasses[size]} ${iconClassName}`}>
      {/* Outer Ring */}
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 ${animated ? 'animate-spin' : ''}`} 
           style={{ animationDuration: animated ? '8s' : undefined }}>
      </div>
      
      {/* Inner Circle */}
      <div className="absolute inset-1 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center">
        {/* G Letter */}
        <div className={`font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-purple-600 ${
          size === 'xs' ? 'text-xs' :
          size === 'sm' ? 'text-sm' :
          size === 'md' ? 'text-base' :
          size === 'lg' ? 'text-lg' :
          'text-xl'
        }`}>
          G
        </div>
      </div>
      
      {/* Glow Effect */}
      {animated && (
        <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-md animate-pulse"></div>
      )}
    </div>
  );

  const LogoText = ({ className: textClassName = '' }: { className?: string }) => (
    <span className={`font-black tracking-tight ${textSizeClasses[size]} ${textClassName}`}>
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
        Goss
      </span>
      <span className="text-gray-900 dark:text-gray-100">
        app
      </span>
    </span>
  );

  if (variant === 'icon') {
    return <LogoIcon className={className} />;
  }

  if (variant === 'text') {
    return <LogoText className={className} />;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoIcon className={animated ? 'animate-float' : ''} />
      <LogoText />
    </div>
  );
}

// Animated Loading Logo
export function LoadingLogo({ size = 'lg' }: { size?: LogoProps['size'] }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <Logo size={size} variant="icon" animated />
      <div className="flex items-center gap-2">
        <Logo size="sm" variant="text" />
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}

// Splash Screen Logo
export function SplashLogo() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="animate-scale-in">
        <Logo size="xl" animated />
      </div>
      <div className="mt-8 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
        <p className="text-lg text-gray-600 dark:text-gray-400 font-medium">
          Connect • Share • Discover
        </p>
      </div>
      <div className="mt-4 animate-fade-in-up" style={{ animationDelay: '700ms' }}>
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}

// Favicon Component (for dynamic favicon)
export function FaviconLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      
      {/* Outer Ring */}
      <circle cx="16" cy="16" r="15" fill="url(#gradient)" />
      
      {/* Inner Circle */}
      <circle cx="16" cy="16" r="11" fill="white" />
      
      {/* G Letter */}
      <text x="16" y="22" textAnchor="middle" fontSize="14" fontWeight="900" fill="url(#gradient)">
        G
      </text>
    </svg>
  );
}
