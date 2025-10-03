import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const cardVariants = cva(
  'rounded-2xl transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md',
        elevated: 'bg-white dark:bg-gray-900 shadow-lg hover:shadow-xl border border-gray-100 dark:border-gray-800',
        glass: 'bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg',
        gradient: 'bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg',
        outline: 'border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
        ghost: 'hover:bg-gray-50 dark:hover:bg-gray-900/50',
      },
      size: {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
        xl: 'p-10',
      },
      interactive: {
        true: 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
      },
      glow: {
        true: 'hover:shadow-2xl hover:shadow-indigo-500/10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  children?: React.ReactNode;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, size, interactive, glow, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, size, interactive, glow }), className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 pb-4', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('font-bold text-xl leading-none tracking-tight text-gray-900 dark:text-gray-100', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-gray-600 dark:text-gray-400 leading-relaxed', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center pt-4', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};

// Specialized Card Components
export function PostCard({ 
  children, 
  className,
  ...props 
}: CardProps) {
  return (
    <Card 
      variant="elevated"
      interactive
      glow
      className={cn('hover-lift overflow-hidden', className)}
      {...props}
    >
      {children}
    </Card>
  );
}

export function ProfileCard({ 
  children, 
  className,
  ...props 
}: CardProps) {
  return (
    <Card 
      variant="gradient"
      size="lg"
      className={cn('text-center', className)}
      {...props}
    >
      {children}
    </Card>
  );
}

export function StatsCard({ 
  children, 
  className,
  ...props 
}: CardProps) {
  return (
    <Card 
      variant="glass"
      interactive
      className={cn('text-center hover-scale', className)}
      {...props}
    >
      {children}
    </Card>
  );
}

export function FeatureCard({ 
  children, 
  className,
  ...props 
}: CardProps) {
  return (
    <Card 
      variant="elevated"
      size="lg"
      interactive
      glow
      className={cn('hover-lift group', className)}
      {...props}
    >
      {children}
    </Card>
  );
}

export function GlassCard({ 
  children, 
  className,
  ...props 
}: CardProps) {
  return (
    <Card 
      variant="glass"
      className={cn('backdrop-blur-2xl', className)}
      {...props}
    >
      {children}
    </Card>
  );
}



