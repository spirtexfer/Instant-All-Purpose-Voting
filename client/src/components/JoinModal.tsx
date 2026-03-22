import { useState } from 'react';
import { Socket } from 'socket.io-client';
import Modal from './Modal';

interface Props {
  socket: Socket;
  onClose: () => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

type JoinStep = 'code' | 'name';

export default function JoinModal({ socket, onClose, addToast }: Props) {
  const [step, setStep] = useState<JoinStep>('code');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeError, setCodeError] = useState('');

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const upperCode = code.trim().toUpperCase();
    if (!upperCode || upperCode.length !== 6) {
      setCodeError('Please enter a valid 6-character code.');
      return;
    }
    setLoading(true);
    setCodeError('');
    socket.emit('session:check', upperCode, (res: { exists: boolean; joinable: boolean; reason?: string }) => {
      setLoading(false);
      if (!res.exists) {
        setCodeError('Session not found. Check the code and try again.');
      } else if (!res.joinable) {
        setCodeError(res.reason || 'Cannot join this session.');
      } else {
        setStep('name');
      }
    });
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Please enter your name.', 'error');
      return;
    }
    setLoading(true);
    socket.emit('session:join', { code: code.trim().toUpperCase(), name: name.trim() }, (res: { success: boolean; error?: string }) => {
      setLoading(false);
      if (res.success) {
        addToast('Joined session!', 'success');
        onClose();
      } else {
        addToast(res.error || 'Failed to join.', 'error');
      }
    });
  };

  return (
    <Modal title="Join a Session" onClose={onClose}>
      {step === 'code' ? (
        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Session Code</label>
            <input
              type="text"
              className={`input-field text-center tracking-[0.3em] text-xl font-bold uppercase ${codeError ? 'border-red-500 focus:ring-red-500' : ''}`}
              placeholder="XXXXXX"
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setCodeError(''); }}
              maxLength={6}
              autoFocus
              spellCheck={false}
            />
            {codeError && (
              <p className="text-red-400 text-sm mt-1.5">{codeError}</p>
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Checking...' : 'Next'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleNameSubmit} className="space-y-4">
          <div className="bg-surface-panel rounded-lg px-4 py-2 border border-surface-border text-center">
            <p className="text-xs text-gray-400 mb-0.5">Joining session</p>
            <p className="text-xl font-bold tracking-widest text-brand-light">{code.toUpperCase()}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Your Name</label>
            <input
              type="text"
              className="input-field"
              placeholder="Enter your name..."
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={30}
              autoFocus
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setStep('code')} className="btn-secondary flex-1">Back</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Joining...' : 'Join'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
