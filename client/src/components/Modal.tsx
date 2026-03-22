import { useEffect, useRef } from 'react';

interface Props {
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export default function Modal({ title, onClose, children, maxWidth = 'max-w-lg' }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (e.target === overlayRef.current && onClose) onClose();
      }}
    >
      <div
        className={`bg-surface-card border border-surface-border rounded-2xl shadow-2xl w-full ${maxWidth}
          animate-slide-up overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <h2 className="text-lg font-bold text-gray-100">{title}</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-100 transition-colors text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-hover"
            >
              ×
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
