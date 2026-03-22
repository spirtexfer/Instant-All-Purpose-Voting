interface Props {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function Toggle({ checked, onChange, label, disabled = false }: Props) {
  return (
    <label className={`flex items-center gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <div
        className={`relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0
          ${checked ? 'bg-brand shadow-glow-sm' : 'bg-surface-border'}
          ${disabled ? '' : 'cursor-pointer'}`}
        onClick={() => !disabled && onChange(!checked)}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) onChange(!checked); }}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md
            transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </div>
      {label && (
        <span className="text-sm text-gray-300 font-medium">{label}</span>
      )}
    </label>
  );
}
