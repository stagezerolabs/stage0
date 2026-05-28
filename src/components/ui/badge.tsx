import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-semibold font-sans leading-none backdrop-blur-sm transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-canvas-alt text-ink-muted',
        live: 'bg-status-live-bg text-status-live shadow-[0_0_12px_rgba(34,197,94,0.15)]',
        closed: 'bg-status-closed-bg text-status-closed',
        upcoming: 'bg-status-upcoming-bg text-status-upcoming shadow-[0_0_12px_rgba(245,158,11,0.15)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  pulse?: boolean;
}

function Badge({ className, variant, pulse, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {pulse && variant === 'live' && (
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-live">
          <span className="sr-only">Live</span>
        </span>
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
