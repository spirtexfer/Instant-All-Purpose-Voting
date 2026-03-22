import { useEffect, useState } from 'react';
import { ToastMessage } from '../types';

interface Props {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const typeStyles: Record<ToastMessage['type'], string> = {
  info: 'bg-surface-panel border-brand text-gray-100',
  success: 'bg-emerald-900/90 border-emerald-500 text-emerald-100',
  error: 'bg-red-900/90 border-red-500 text-red-100',
  warning: 'bg-amber-900/90 border-amber-500 text-amber-100',
};

const typeDotStyles: Record<ToastMessage['type'], string> = {
  info: 'bg-brand-light',
  success: 'bg-emerald-400',
  error: 'bg-red-400',
  warning: 'bg-amber-400',
};

export default function Toast({ toast, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl
        transition-all duration-300 max-w-sm cursor-pointer
        ${typeStyles[toast.type]}
        ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
      onClick={() => onDismiss(toast.id)}
    >
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${typeDotStyles[toast.type]}`} />
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      <button
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity text-lg leading-none"
        onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}
      >
        ×
      </button>
    </div>
  );
}
