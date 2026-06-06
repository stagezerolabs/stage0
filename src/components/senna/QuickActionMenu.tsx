import React, { useEffect, useMemo, useState } from 'react';
import { SENNA_QUICK_ACTIONS, type QuickAction } from './quickActions';

export type { QuickAction } from './quickActions';
export { SENNA_QUICK_ACTIONS } from './quickActions';

interface QuickActionMenuProps {
  open: boolean;
  filter: string;
  onPick: (action: QuickAction) => void;
  onClose: () => void;
}

export const QuickActionMenu: React.FC<QuickActionMenuProps> = ({ open, filter, onPick, onClose }) => {
  const filtered = useMemo(() => {
    const q = filter.replace(/^\//, '').trim().toLowerCase();
    if (!q) return SENNA_QUICK_ACTIONS;
    return SENNA_QUICK_ACTIONS.filter(
      (action) =>
        action.label.toLowerCase().includes(q) ||
        action.sub.toLowerCase().includes(q) ||
        action.actionType.includes(q),
    );
  }, [filter]);

  // Reset selection when the filter or open state changes (React-recommended
  // pattern: store the previous value as state, compare during render).
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevKey, setPrevKey] = useState(`${filter}::${open}`);
  const currentKey = `${filter}::${open}`;
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setActiveIndex(0);
  }

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((idx) => Math.min(idx + 1, filtered.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((idx) => Math.max(idx - 1, 0));
      } else if (event.key === 'Enter' && filtered[activeIndex]) {
        event.preventDefault();
        onPick(filtered[activeIndex]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, activeIndex, onClose, onPick]);

  if (!open || filtered.length === 0) return null;

  return (
    <div className="senna-quick-menu" role="listbox" aria-label="Senna quick actions">
      {filtered.map((action, index) => (
        <button
          key={action.actionType}
          type="button"
          className="senna-quick-item"
          data-active={index === activeIndex}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => onPick(action)}
          role="option"
          aria-selected={index === activeIndex}
        >
          <span className="senna-quick-icon">
            <action.icon className="h-4 w-4" />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span className="senna-quick-label">{action.label}</span>
            <span className="senna-quick-sub">{action.sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
};

export default QuickActionMenu;
