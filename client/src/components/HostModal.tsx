import { useState } from 'react';
import { Socket } from 'socket.io-client';
import Modal from './Modal';
import Toggle from './Toggle';
import { SessionConfig } from '../types';

interface Props {
  socket: Socket;
  onClose: () => void;
  onSuccess: (code: string, token: string) => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export default function HostModal({ socket, onClose, onSuccess, addToast }: Props) {
  const [hostName, setHostName] = useState('');
  const [config, setConfig] = useState<SessionConfig>({
    hostJoinsVote: true,
    superVotesPerPerson: 1,
    superVoteAmount: 3,
    anonymous: false,
    allowLateJoins: true,
    enableAbstains: false,
    allowVoteChanges: false,
  });
  const [loading, setLoading] = useState(false);

  const updateConfig = <K extends keyof SessionConfig>(key: K, value: SessionConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim()) {
      addToast('Please enter your name.', 'error');
      return;
    }
    setLoading(true);
    socket.emit('session:create', { config, hostName: hostName.trim() }, (res: { success: boolean; code?: string; hostReconnectToken?: string; error?: string }) => {
      setLoading(false);
      if (res.success && res.code && res.hostReconnectToken) {
        onSuccess(res.code, res.hostReconnectToken);
        addToast(`Session created! Code: ${res.code}`, 'success');
        onClose();
      } else {
        addToast(res.error || 'Failed to create session.', 'error');
      }
    });
  };

  return (
    <Modal title="Host a Session" onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Host name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Your Name</label>
          <input
            type="text"
            className="input-field"
            placeholder="Enter your name..."
            value={hostName}
            onChange={e => setHostName(e.target.value)}
            maxLength={30}
            autoFocus
          />
        </div>

        {/* Config options */}
        <div className="space-y-3 bg-surface-panel rounded-xl p-4 border border-surface-border">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Session Settings</h3>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Host joins vote</span>
            <Toggle checked={config.hostJoinsVote} onChange={v => updateConfig('hostJoinsVote', v)} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Anonymous voting</span>
            <Toggle checked={config.anonymous} onChange={v => updateConfig('anonymous', v)} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Allow late joins</span>
            <Toggle checked={config.allowLateJoins} onChange={v => updateConfig('allowLateJoins', v)} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Enable abstains</span>
            <Toggle checked={config.enableAbstains} onChange={v => updateConfig('enableAbstains', v)} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Allow vote changes</span>
            <Toggle checked={config.allowVoteChanges} onChange={v => updateConfig('allowVoteChanges', v)} />
          </div>

          <div className="pt-2 border-t border-surface-border space-y-3">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm text-gray-300 flex-1">Super votes per person</label>
              <input
                type="number"
                className="input-field w-20 text-center"
                min={0}
                max={10}
                value={config.superVotesPerPerson}
                onChange={e => updateConfig('superVotesPerPerson', Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <label className="text-sm text-gray-300 flex-1">Super vote weight</label>
              <input
                type="number"
                className="input-field w-20 text-center"
                min={2}
                max={20}
                value={config.superVoteAmount}
                onChange={e => updateConfig('superVoteAmount', Math.max(2, parseInt(e.target.value) || 2))}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Creating...' : 'Create Session'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
