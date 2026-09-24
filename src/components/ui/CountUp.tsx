import React, { useEffect, useRef } from 'react';

interface CountUpProps {
  to: number;
  durationMs?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

const CountUp: React.FC<CountUpProps> = ({
  to,
  durationMs = 2000,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}) => {
  const valueRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const element = valueRef.current;
    if (!element) return undefined;

    const formatter = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    let start: number | null = null;
    let displayed = '';
    const renderValue = (value: number) => {
      const formatted = `${prefix}${formatter.format(value)}${suffix}`;
      if (formatted !== displayed) {
        element.textContent = formatted;
        displayed = formatted;
      }
    };

    renderValue(durationMs <= 0 ? to : 0);
    if (durationMs <= 0) return undefined;

    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / durationMs, 1);
      // Ease-in-out cubic for "time assembling" feel
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const nextValue = to * eased;
      renderValue(nextValue);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [to, durationMs, decimals, prefix, suffix]);

  return (
    <span ref={valueRef} className={className}>
      {prefix}0{suffix}
    </span>
  );
};

export default CountUp;
