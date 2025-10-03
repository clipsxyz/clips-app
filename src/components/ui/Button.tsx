import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] relative overflow-hidden',
  {
    variants: {
      variant: {
        primary: 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:from-indigo-700 hover:to-purple-700 focus-visible:ring-indigo-500',
        secondary: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md focus-visible:ring-gray-500',
        success: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-teal-600 focus-visible:ring-emerald-500',
        danger: 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg hover:shadow-xl hover:from-red-600 hover:to-pink-600 focus-visible:ring-red-500',
        warning: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg hover:shadow-xl hover:from-amber-600 hover:to-orange-600 focus-visible:ring-amber-500',
        ghost: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 focus-visible:ring-gray-500',
        outline: 'border-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 focus-visible:ring-indigo-500',
        glass: 'bg-white/10 dark:bg-black/10 backdrop-blur-md border border-white/20 dark:border-white/10 text-gray-900 dark:text-gray-100 hover:bg-white/20 dark:hover:bg-black/20 shadow-lg focus-visible:ring-white/50',
      },
      size: {
        xs: 'h-8 px-3 text-xs',
        sm: 'h-9 px-4 text-sm',
        md: 'h-10 px-6 text-sm',
        lg: 'h-12 px-8 text-base',
        xl: 'h-14 px-10 text-lg',
        icon: 'h-10 w-10',
      },
      fullWidth: {
        true: 'w-full',
      },
      loading: {
        true: 'cursor-not-allowed',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    fullWidth, 
    loading, 
    leftIcon, 
    rightIcon, 
    children, 
    disabled,
    ...props 
  }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth, loading, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {/* Ripple Effect */}
        <span className="absolute inset-0 overflow-hidden rounded-xl">
          <span className="absolute inset-0 rounded-xl bg-white opacity-0 transition-opacity duration-200 hover:opacity-10 active:opacity-20"></span>
        </span>

        {/* Content */}
        <span className="relative flex items-center justify-center gap-2">
          {loading ? (
            <svg
              className="animate-spin h-4 w-4"
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
          ) : (
            leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
          )}
          
          {children && <span>{children}</span>}
          
          {!loading && rightIcon && (
            <span className="flex-shrink-0">{rightIcon}</span>
          )}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };

// Specialized Button Components
export function IconButton({ 
  children, 
  variant = 'ghost', 
  size = 'icon',
  className,
  ...props 
}: ButtonProps) {
  return (
    <Button 
      variant={variant} 
      size={size} 
      className={cn('rounded-full', className)}
      {...props}
    >
      {children}
    </Button>
  );
}

export function FloatingActionButton({ 
  children, 
  className,
  ...props 
}: ButtonProps) {
  return (
    <Button 
      variant="primary" 
      size="icon"
      className={cn(
        'fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl animate-float',
        'bg-gradient-to-r from-indigo-500 to-purple-500',
        'hover:from-indigo-600 hover:to-purple-600',
        'focus-visible:ring-4 focus-visible:ring-indigo-500/50',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

export function GlassButton({ 
  children, 
  className,
  ...props 
}: ButtonProps) {
  return (
    <Button 
      variant="glass"
      className={cn('backdrop-blur-xl', className)}
      {...props}
    >
      {children}
    </Button>
  );
}



