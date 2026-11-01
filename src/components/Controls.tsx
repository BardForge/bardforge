import { useEffect, useState, type ReactNode } from 'react';

export function IconButton({
  label,
  children,
  active,
  disabled,
  onClick,
  className = '',
}: {
  label: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? 'active' : ''} ${className}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Volume({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="volume">
      <span className="sr-only">{label}</span>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <span className="volume-value">{Math.round(value * 100)}%</span>
    </label>
  );
}

export function EditableName({
  label,
  value,
  onCommit,
  disabled,
  className = '',
}: {
  label: string;
  value: string;
  onCommit: (name: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      className={`editable-name ${className}`}
      aria-label={label}
      value={draft}
      maxLength={120}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft.trim() || value;
        setDraft(next);
        if (next !== value) onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(value);
        }
      }}
    />
  );
}
