import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('relative mx-auto w-[17.25rem] p-3', className)}
      classNames={{
        months: 'flex justify-center',
        month: 'w-full space-y-3',
        month_caption: 'flex h-8 items-center justify-center px-10',
        caption_label: 'font-display text-[13px] font-semibold text-ink',
        nav: 'pointer-events-none absolute inset-x-3 top-3 flex h-8 items-center justify-between',
        button_previous:
          'pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-canvas-alt text-ink-muted transition-colors hover:bg-accent/10 hover:text-accent',
        button_next:
          'pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-canvas-alt text-ink-muted transition-colors hover:bg-accent/10 hover:text-accent',
        month_grid: 'mx-auto w-full table-fixed border-collapse',
        weekdays: 'flex justify-center gap-1',
        weekday: 'flex h-7 w-8 items-center justify-center text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint',
        week: 'mt-1 flex justify-center gap-1',
        day: 'h-8 w-8 p-0 text-center text-sm',
        day_button:
          'inline-flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-medium text-ink transition-colors hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
        selected:
          'text-accent-foreground [&>button]:bg-accent [&>button]:text-accent-foreground [&>button]:hover:bg-accent [&>button]:hover:text-accent-foreground',
        today: '[&>button]:border [&>button]:border-accent/45 [&>button]:text-accent',
        outside:
          'text-ink-faint opacity-45 aria-selected:bg-accent/8 aria-selected:text-ink-faint aria-selected:opacity-60',
        disabled: 'text-ink-faint opacity-35',
        range_middle: 'aria-selected:bg-accent/10 aria-selected:text-ink',
        range_start: '[&>button]:bg-accent [&>button]:text-accent-foreground',
        range_end: '[&>button]:bg-accent [&>button]:text-accent-foreground',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ className: chevronClassName, orientation, ...chevronProps }) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn('h-4 w-4', chevronClassName)} {...chevronProps} />
          ) : (
            <ChevronRight className={cn('h-4 w-4', chevronClassName)} {...chevronProps} />
          ),
      }}
      {...props}
    />
  );
}

Calendar.displayName = 'Calendar';

export { Calendar };
