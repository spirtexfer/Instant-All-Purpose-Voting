import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { ClientSessionState, ParticipantInfo } from '../types';
import Modal from './Modal';
import QuestionCreatorModal from './QuestionCreatorModal';

interface Props {
  socket: Socket;
  sessionState: ClientSessionState;
  mySocketId: string;
  onLeaveSession: () => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export default function LobbyScreen({ socket, sessionState, mySocketId, onLeaveSession, addToast }: Props) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantInfo | null>(null);
  const [superVoteEdit, setSuperVoteEdit] = useState('');
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const myParticipant = sessionState.participants.find(p => p.socketId === mySocketId);
  const isHost = myParticipant?.isHost ?? false;
  const canStart = sessionState.eligibleVoterCount >= 2;

  // Close participant modal if that participant leaves
  useEffect(() => {
    if (selectedParticipant && !sessionState.participants.find(p => p.socketId === selectedParticipant.socketId)) {
      setSelectedParticipant(null);
    }
  }, [sessionState.participants]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(sessionState.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSelectParticipant = (p: ParticipantInfo) => {
    if (!isHost) return;
    setSelectedParticipant(p);
    setSuperVoteEdit(String(p.superVotesRemaining));
  };

  const handleKick = () => {
    if (!selectedParticipant) return;
    socket.emit('participant:kick', { code: sessionState.code, targetSocketId: selectedParticipant.socketId }, (res: { success: boolean; error?: string }) => {
      if (res.success) {
        addToast(`${selectedParticipant.name} was kicked.`, 'info');
        setSelectedParticipant(null);
      } else {
        addToast(res.error || 'Failed to kick.', 'error');
      }
    });
  };

  const handleSetSuperVotes = () => {
    if (!selectedParticipant) return;
    const amount = parseInt(superVoteEdit);
    if (isNaN(amount) || amount < 0) {
      addToast('Invalid super vote amount.', 'error');
      return;
    }
    socket.emit('participant:setSuperVotes', {
      code: sessionState.code,
      targetSocketId: selectedParticipant.socketId,
      amount,
    }, (res: { success: boolean; error?: string }) => {
      if (res.success) {
        addToast('Super votes updated.', 'success');
        setSelectedParticipant(null);
      } else {
        addToast(res.error || 'Failed to update.', 'error');
      }
    });
  };

  const handleEndSession = () => {
    socket.emit('session:end', { code: sessionState.code }, () => {
      onLeaveSession();
    });
  };

  const handleLeave = () => {
    socket.emit('participant:leave', { code: sessionState.code }, (res: { success: boolean; error?: string }) => {
      if (res.success) {
        onLeaveSession();
      } else {
        addToast(res.error || 'Failed to leave.', 'error');
      }
    });
  };

  const isSelf = selectedParticipant?.socketId === mySocketId;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Host disconnect warning */}
      {sessionState.hostDisconnected && (
        <div className="bg-red-900/80 border-b border-red-700 text-red-100 px-4 py-3 text-center">
          <p className="font-semibold">Host disconnected!</p>
          <p className="text-sm">Session will end in {sessionState.hostDisconnectSecondsLeft} seconds if host doesn't reconnect...</p>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-surface-border bg-surface-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Session Code</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tracking-widest text-brand-light">{sessionState.code}</span>
              <button
                onClick={copyCode}
                className="text-xs px-2 py-1 rounded bg-surface-panel border border-surface-border hover:border-brand/50 text-gray-400 hover:text-gray-200 transition-all"
              >
                {copiedCode ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-surface-panel rounded-lg px-3 py-1.5 border border-surface-border">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-gray-400">Lobby</span>
          </div>
        </div>

        <div className="flex gap-2">
          {isHost ? (
            <button onClick={() => setShowEndConfirm(true)} className="btn-danger text-sm py-2 px-4">
              End Session
            </button>
          ) : (
            <button onClick={() => setShowLeaveConfirm(true)} className="btn-secondary text-sm py-2 px-4">
              Leave
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-100">
            Participants <span className="text-gray-500 font-normal text-base">({sessionState.participants.length})</span>
          </h2>
          {!isHost && (
            <p className="text-sm text-gray-500 italic">Waiting for host to start...</p>
          )}
        </div>

        {/* Participant grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {sessionState.participants.map(p => (
            <div
              key={p.socketId}
              onClick={() => handleSelectParticipant(p)}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-200
                ${p.socketId === mySocketId
                  ? 'bg-surface-panel border-brand/40 shadow-glow-sm'
                  : 'bg-surface-card border-surface-border'
                }
                ${isHost ? 'cursor-pointer hover:border-brand/50 hover:bg-surface-hover' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                ${p.isHost ? 'bg-brand text-white' : 'bg-surface-border text-gray-300'}`}>
                {p.name.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-100 truncate">{p.name}</span>
                  {p.isHost && (
                    <span className="text-xs bg-brand/20 text-brand-light border border-brand/30 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                      Host
                    </span>
                  )}
                  {p.socketId === mySocketId && (
                    <span className="text-xs text-gray-500 flex-shrink-0">(you)</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {p.superVotesRemaining > 0 ? (
                    <span className="text-amber-400">{p.superVotesRemaining} super vote{p.superVotesRemaining !== 1 ? 's' : ''}</span>
                  ) : (
                    <span>No super votes</span>
                  )}
                </div>
              </div>

              {isHost && (
                <span className="text-gray-600 flex-shrink-0">›</span>
              )}
            </div>
          ))}
        </div>

        {/* Host controls */}
        {isHost && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <button
              onClick={() => setShowQuestionModal(true)}
              disabled={!canStart}
              className="btn-primary text-lg py-3.5 px-10 shadow-glow"
            >
              Start
            </button>
            {!canStart && (
              <p className="text-sm text-gray-500">
                Need at least 2 eligible voters to start
              </p>
            )}
          </div>
        )}
      </div>

      {/* Participant action modal (host only) */}
      {selectedParticipant && isHost && (
        <Modal
          title={isSelf ? `${selectedParticipant.name} (you)` : selectedParticipant.name}
          onClose={() => setSelectedParticipant(null)}
          maxWidth="max-w-sm"
        >
          <div className="space-y-4">
            {!sessionState.firstQuestionStarted && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Super Votes Remaining</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="input-field"
                    value={superVoteEdit}
                    onChange={e => setSuperVoteEdit(e.target.value)}
                    min={0}
                    max={100}
                  />
                  <button onClick={handleSetSuperVotes} className="btn-primary px-4 whitespace-nowrap">
                    Set
                  </button>
                </div>
              </div>
            )}
            {sessionState.firstQuestionStarted && (
              <p className="text-sm text-gray-500 italic">Super votes cannot be changed after first question starts.</p>
            )}
            {!isSelf && (
              <button onClick={handleKick} className="btn-danger w-full">
                Kick {selectedParticipant.name}
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Question creator modal */}
      {showQuestionModal && (
        <QuestionCreatorModal
          socket={socket}
          sessionCode={sessionState.code}
          onClose={() => setShowQuestionModal(false)}
          addToast={addToast}
        />
      )}

      {/* End session confirm */}
      {showEndConfirm && (
        <Modal title="End Session?" onClose={() => setShowEndConfirm(false)} maxWidth="max-w-sm">
          <div className="space-y-4">
            <p className="text-gray-300">Are you sure you want to end the session? All participants will be disconnected.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowEndConfirm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleEndSession} className="btn-danger flex-1">End Session</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Leave confirm */}
      {showLeaveConfirm && (
        <Modal title="Leave Session?" onClose={() => setShowLeaveConfirm(false)} maxWidth="max-w-sm">
          <div className="space-y-4">
            <p className="text-gray-300">Are you sure you want to leave?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLeaveConfirm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleLeave} className="btn-danger flex-1">Leave</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
