import React, { useEffect, useMemo, useRef, useState } from 'react';

interface PhaseCountdownProps {
  label: string;
  nowSec: number;
  targetTime?: bigint;
  fallbackLabel?: string;
  completedLabel?: string;
  stoppedMessage?: string;
  compact?: boolean;
  className?: string;
}

interface CountdownView {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  isRunning: boolean;
  statusText: string;
}

function computeCountdownView(
  nowSec: number,
  targetTime: bigint | undefined,
  fallbackLabel: string | undefined,
  completedLabel: string | undefined,
): CountdownView {
  if (!targetTime || targetTime <= 0n) {
    return {
      days: '--',
      hours: '--',
      minutes: '--',
      seconds: '--',
      isRunning: false,
      statusText: fallbackLabel ?? 'No timer',
    };
  }

  const remaining = Number(targetTime) - nowSec;
  if (remaining <= 0) {
    return {
      days: '00',
      hours: '00',
      minutes: '00',
      seconds: '00',
      isRunning: false,
      statusText: completedLabel ?? 'Ended',
    };
  }

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  return {
    days: days.toString().padStart(2, '0'),
    hours: hours.toString().padStart(2, '0'),
    minutes: minutes.toString().padStart(2, '0'),
    seconds: seconds.toString().padStart(2, '0'),
    isRunning: true,
    statusText: 'Live countdown',
  };
}

/** Single digit with mechanical flip animation.
 *  Change detection happens synchronously during render (React 18 pattern) so the
 *  animated flap is present on the very first paint — no flash of the new digit. */
const FlipDigit: React.FC<{ digit: string }> = ({ digit }) => {
  const prevDigitRef = useRef(digit);
  const [previous, setPrevious] = useState(digit);
  const [flipKey, setFlipKey] = useState(0);
  const timeoutRef = useRef<number>(0);

  // Detect prop change synchronously during render — React will discard this
  // render and immediately retry with the updated state before painting.
  if (digit !== prevDigitRef.current) {
    setPrevious(prevDigitRef.current);
    prevDigitRef.current = digit;
    setFlipKey((k) => k + 1);
  }

  // Schedule removal of animated flaps after animation completes
  useEffect(() => {
    if (flipKey === 0) return;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setFlipKey(0), 420);
    return () => window.clearTimeout(timeoutRef.current);
  }, [flipKey]);

  return (
    <div className="flip-digit">
      {/* Static top — always shows latest digit */}
      <div className="flip-digit-top">
        <span className="flip-digit-value">{digit}</span>
      </div>
      {/* Static bottom — always shows latest digit */}
      <div className="flip-digit-bottom">
        <span className="flip-digit-value">{digit}</span>
      </div>

      {flipKey > 0 && (
        <>
          {/* Top flap: shows OLD digit, folds down to reveal new digit underneath */}
          <div key={`top-${flipKey}`} className="flip-digit-top flip-flap-top">
            <span className="flip-digit-value">{previous}</span>
          </div>
          {/* Bottom flap: shows NEW digit, unfolds into view */}
          <div key={`btm-${flipKey}`} className="flip-digit-bottom flip-flap-bottom">
            <span className="flip-digit-value">{digit}</span>
          </div>
        </>
      )}
    </div>
  );
};

/** Grouped 2-digit unit card (e.g. "05" for hours) with label underneath. */
const FlipUnit: React.FC<{ value: string; label: string; compact: boolean }> = ({ value, label, compact }) => {
  const digits = value.split('');
  return (
    <div className="flip-unit">
      <div className={`flip-unit-card${compact ? ' flip-unit-card--compact' : ''}`}>
        {digits.map((d, i) => (
          <FlipDigit key={i} digit={d} />
        ))}
        <div className="flip-unit-divider" />
      </div>
      <span className="flip-unit-label">{label}</span>
    </div>
  );
};

const PhaseCountdown: React.FC<PhaseCountdownProps> = ({
  label,
  nowSec,
  targetTime,
  fallbackLabel,
  completedLabel,
  stoppedMessage,
  compact = false,
  className = '',
}) => {
  const countdown = useMemo(
    () => computeCountdownView(nowSec, targetTime, fallbackLabel, completedLabel),
    [completedLabel, fallbackLabel, nowSec, targetTime],
  );

  const units = [
    { key: 'days', label: 'DAYS', value: countdown.days },
    { key: 'hours', label: 'HRS', value: countdown.hours },
    { key: 'minutes', label: 'MIN', value: countdown.minutes },
    { key: 'seconds', label: 'SEC', value: countdown.seconds },
  ];

  return (
    <div className={`flip-countdown${compact ? ' flip-countdown--compact' : ''} ${className}`}>
      <p className="flip-countdown-label">{label}</p>

      {countdown.isRunning || !stoppedMessage ? (
        <div className="flip-countdown-track">
          {units.map((unit, i) => (
            <React.Fragment key={unit.key}>
              {i > 0 && <span className="flip-colon">:</span>}
              <FlipUnit value={unit.value} label={unit.label} compact={compact} />
            </React.Fragment>
          ))}
        </div>
      ) : (
        <p className={`text-ink font-semibold tracking-[0.12em] uppercase ${compact ? 'text-sm' : 'text-base'}`}>
          {stoppedMessage}
        </p>
      )}

      {!countdown.isRunning && !stoppedMessage && (
        <p className="flip-countdown-status">{countdown.statusText}</p>
      )}
    </div>
  );
};

export default PhaseCountdown;
