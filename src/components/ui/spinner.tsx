import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from '@/components/ui/icons';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';
type SpinnerVariant = 'icon' | 'ring' | 'dots';

type SpinnerProps = ComponentPropsWithoutRef<'span'> & {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  label?: string;
};

const sizeClass: Record<SpinnerSize, string> = {
  xs: 'size-3',
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
};

const dotSizeClass: Record<SpinnerSize, string> = {
  xs: 'size-1',
  sm: 'size-1.5',
  md: 'size-2',
  lg: 'size-2.5',
};

function Spinner({
  className,
  size = 'sm',
  variant = 'icon',
  label = 'Loading',
  ...props
}: SpinnerProps) {
  if (variant === 'dots') {
    return (
      <span
        role="status"
        aria-label={label}
        className={cn('inline-flex items-center gap-1 text-current', className)}
        {...props}
      >
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={cn('rounded-full bg-current animate-pulse', dotSizeClass[size])}
            style={{ animationDelay: `${index * 120}ms` }}
          />
        ))}
      </span>
    );
  }

  if (variant === 'ring') {
    return (
      <span
        role="status"
        aria-label={label}
        className={cn(
          'inline-block rounded-full border-2 border-current/20 border-t-current animate-spin',
          sizeClass[size],
          className,
        )}
        {...props}
      />
    );
  }

  return (
    <span
      role="status"
      aria-label={label}
      className={cn('inline-flex items-center justify-center', className)}
      {...props}
    >
      <Loader2 className={cn('animate-spin', sizeClass[size])} aria-hidden="true" />
    </span>
  );
}

type InlineLoadingProps = ComponentPropsWithoutRef<'span'> & {
  label: string;
  size?: SpinnerSize;
  variant?: SpinnerVariant;
};

function InlineLoading({
  label,
  size = 'sm',
  variant = 'icon',
  className,
  ...props
}: InlineLoadingProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} {...props}>
      <Spinner size={size} variant={variant} label={label} />
      <span>{label}</span>
    </span>
  );
}

type LoadingStateProps = ComponentPropsWithoutRef<'div'> & {
  label: string;
  description?: string;
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  compact?: boolean;
};

function LoadingState({
  label,
  description,
  size = 'lg',
  variant = 'ring',
  compact = false,
  className,
  ...props
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 space-y-3' : 'py-20 sm:py-28 space-y-4',
        className,
      )}
      {...props}
    >
      <Spinner size={size} variant={variant} label={label} className="text-accent" />
      <div className="space-y-1">
        <p className="text-body text-ink-muted">{label}</p>
        {description && <p className="text-body-sm text-ink-faint">{description}</p>}
      </div>
    </div>
  );
}

export { InlineLoading, LoadingState, Spinner };
