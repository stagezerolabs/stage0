import React from 'react';

interface SuggestionStripProps {
  suggestions: string[];
  disabled?: boolean;
  onPick: (suggestion: string) => void;
}

export const SuggestionStrip: React.FC<SuggestionStripProps> = ({ suggestions, disabled, onPick }) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="senna-suggests">
      {suggestions.slice(0, 3).map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          className="senna-suggest"
          disabled={disabled}
          onClick={() => onPick(suggestion)}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
};

export default SuggestionStrip;
