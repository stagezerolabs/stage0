import { useEffect } from 'react';
import { useChainId } from 'wagmi';
import { useRnsAddressInput } from '@/lib/hooks/rns';
import { InlineLoading } from '@/components/ui/spinner';
import type { Address } from 'viem';

type RnsAddressInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onResolvedAddressChange?: (address: Address | null) => void;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  inputClassName?: string;
};

export default function RnsAddressInput({
  label,
  value,
  onChange,
  onResolvedAddressChange,
  placeholder = '0x... or name.rise',
  hint,
  disabled,
  required,
  className = '',
  inputClassName = '',
}: RnsAddressInputProps) {
  const chainId = useChainId();
  const resolution = useRnsAddressInput(value, chainId, { enabled: !disabled });

  useEffect(() => {
    onResolvedAddressChange?.(resolution.address);
  }, [onResolvedAddressChange, resolution.address]);

  const showStatus = Boolean(value.trim() && resolution.message);
  const statusClass =
    resolution.status === 'resolved' || resolution.status === 'address'
      ? 'text-status-live'
      : resolution.status === 'resolving'
      ? 'text-ink-faint'
      : 'text-status-error';

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-body-sm text-ink-muted font-medium">
        {label}
        {required && <span className="text-status-error"> *</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`input-field w-full font-mono text-sm ${inputClassName}`}
      />
      {showStatus ? (
        <p className={`text-xs ${statusClass}`}>
          {resolution.isLoading || resolution.status === 'resolving' ? (
            <InlineLoading label={resolution.message} size="xs" variant="dots" />
          ) : (
            resolution.message
          )}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}
