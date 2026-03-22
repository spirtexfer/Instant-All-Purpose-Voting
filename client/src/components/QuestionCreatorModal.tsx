import { useState } from 'react';
import { Socket } from 'socket.io-client';
import Modal from './Modal';

interface Props {
  socket: Socket;
  sessionCode: string;
  onClose?: () => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export default function QuestionCreatorModal({ socket, sessionCode, onClose, addToast }: Props) {
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [loading, setLoading] = useState(false);

  const addOption = () => {
    if (options.length < 8) setOptions(prev => [...prev, '']);
  };

  const removeOption = (idx: number) => {
    if (options.length > 2) setOptions(prev => prev.filter((_, i) => i !== idx));
  };

  const updateOption = (idx: number, val: string) => {
    setOptions(prev => prev.map((o, i) => i === idx ? val : o));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!questionText.trim()) {
      addToast('Please enter a question.', 'error');
      return;
    }

    const cleanOptions = options.map(o => o.trim()).filter(o => o.length > 0);
    if (cleanOptions.length < 2) {
      addToast('Please enter at least 2 options.', 'error');
      return;
    }

    setLoading(true);
    socket.emit(
      'question:start',
      { code: sessionCode, question: { text: questionText.trim(), options: cleanOptions } },
      (res: { success: boolean; error?: string }) => {
        setLoading(false);
        if (res.success) {
          if (onClose) onClose();
        } else {
          addToast(res.error || 'Failed to start question.', 'error');
        }
      }
    );
  };

  return (
    <Modal title="Create Question" onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Question text */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Question</label>
          <textarea
            className="input-field resize-none h-24"
            placeholder="What should we decide?"
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            autoFocus
            maxLength={500}
          />
        </div>

        {/* Options */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">Options</label>
            <span className="text-xs text-gray-500">{options.length}/8</span>
          </div>
          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex-shrink-0 w-6 h-6 bg-surface-panel rounded-full border border-surface-border
                  flex items-center justify-center text-xs text-gray-400 font-medium">
                  {idx + 1}
                </div>
                <input
                  type="text"
                  className="input-field flex-1"
                  placeholder={`Option ${idx + 1}...`}
                  value={opt}
                  onChange={e => updateOption(idx, e.target.value)}
                  maxLength={200}
                />
                <button
                  type="button"
                  onClick={() => removeOption(idx)}
                  disabled={options.length <= 2}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400
                    hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {options.length < 8 && (
            <button
              type="button"
              onClick={addOption}
              className="mt-3 w-full py-2 border border-dashed border-surface-border rounded-lg text-sm text-gray-400
                hover:border-brand/50 hover:text-brand-light transition-colors flex items-center justify-center gap-2"
            >
              <span>+</span> Add Option
            </button>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          {onClose && (
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
          )}
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Starting...' : '🚀 Start Voting'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
