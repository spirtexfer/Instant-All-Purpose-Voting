import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { ClientSessionState } from '../types';
import Modal from './Modal';

interface Props {
  socket: Socket;
  sessionState: ClientSessionState;
  mySocketId: string;
  onLeaveSession: () => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export default function VotingScreen({ socket, sessionState, mySocketId, onLeaveSession, addToast }: Props) {
  const [selectedOption, setSelectedOption] = useState<number | 'abstain' | null>(null);
  const [useSuper, setUseSuper] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showChangeVote, setShowChangeVote] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const myParticipant = sessionState.participants.find(p => p.socketId === mySocketId);
  const isHost = myParticipant?.isHost ?? false;
  const myVote = sessionState.votes[mySocketId];
  const hasVoted = !!myVote;
  const canVote = sessionState.config.hostJoinsVote || !isHost;

  // Reset selection when entering voting phase or when question changes
  useEffect(() => {
    setSelectedOption(null);
    setUseSuper(false);
    setShowChangeVote(false);
  }, [sessionState.currentQuestion?.text]);

  const handleVote = () => {
    if (selectedOption === null) {
      addToast('Please select an option.', 'error');
      return;
    }
    if (useSuper && selectedOption !== 'abstain' && (myParticipant?.superVotesRemaining ?? 0) <= 0) {
      addToast('No super votes remaining.', 'error');
      return;
    }

    setSubmitting(true);
    socket.emit(
      'vote:cast',
      { code: sessionState.code, optionIndex: selectedOption, isSuper: useSuper && selectedOption !== 'abstain' },
      (res: { success: boolean; error?: string }) => {
        setSubmitting(false);
        if (res.success) {
          setShowChangeVote(false);
          addToast('Vote cast!', 'success');
        } else {
          addToast(res.error || 'Failed to cast vote.', 'error');
        }
      }
    );
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

  const handleEndVoting = () => {
    socket.emit('vote:end', { code: sessionState.code }, (res: { success: boolean; error?: string }) => {
      if (!res.success) addToast(res.error || 'Failed to end voting.', 'error');
      setShowEndConfirm(false);
    });
  };

  const startChangeVote = () => {
    if (myVote) {
      setSelectedOption(myVote.optionIndex);
      setUseSuper(myVote.isSuper);
    }
    setShowChangeVote(true);
  };

  const question = sessionState.currentQuestion;
  if (!question) return null;

  const superVotesLeft = myParticipant?.superVotesRemaining ?? 0;
  const effectiveSuperLeft = showChangeVote && myVote?.isSuper ? superVotesLeft + 1 : superVotesLeft;
  const canUseSuper = effectiveSuperLeft > 0;

  const votedPercent = sessionState.eligibleVoterCount > 0
    ? Math.round((sessionState.votedCount / sessionState.eligibleVoterCount) * 100)
    : 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Host disconnect warning */}
      {sessionState.hostDisconnected && (
        <div className="bg-red-900/80 border-b border-red-700 text-red-100 px-4 py-3 text-center">
          <p className="font-semibold">Host disconnected!</p>
          <p className="text-sm">Session ends in {sessionState.hostDisconnectSecondsLeft}s...</p>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-surface-border bg-surface-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm text-gray-400 font-medium">Voting in progress</span>
          <span className="text-xs bg-surface-panel border border-surface-border rounded px-2 py-0.5 text-gray-500">
            {sessionState.code}
          </span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400">
            <span>{sessionState.votedCount}/{sessionState.eligibleVoterCount} voted</span>
            <div className="w-24 h-1.5 bg-surface-border rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all duration-500"
                style={{ width: `${votedPercent}%` }}
              />
            </div>
          </div>
          {isHost ? (
            <button onClick={() => setShowEndConfirm(true)} className="btn-danger text-sm py-2 px-4">
              End Voting
            </button>
          ) : (
            <button onClick={() => setShowLeaveConfirm(true)} className="btn-secondary text-sm py-2 px-4">
              Leave
            </button>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {/* Question */}
        <div className="mb-8">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Question</p>
          <h2 className="text-2xl font-bold text-gray-100 leading-snug">{question.text}</h2>
        </div>

        {/* Mobile progress */}
        <div className="sm:hidden mb-6 flex items-center gap-2 text-sm text-gray-400">
          <span>{sessionState.votedCount}/{sessionState.eligibleVoterCount} voted</span>
          <div className="flex-1 h-1.5 bg-surface-border rounded-full overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-all duration-500"
              style={{ width: `${votedPercent}%` }}
            />
          </div>
        </div>

        {/* Voting area */}
        {canVote ? (
          <>
            {/* Already voted and no change allowed */}
            {hasVoted && !showChangeVote && (
              <div className="mb-6">
                <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-4 flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-emerald-300 font-semibold">Vote confirmed!</p>
                    <p className="text-sm text-emerald-400/70">
                      You voted for:{' '}
                      <span className="font-medium text-emerald-300">
                        {myVote.optionIndex === 'abstain' ? 'Abstain' : question.options[myVote.optionIndex as number]}
                      </span>
                      {myVote.isSuper && <span className="ml-2 text-amber-400 font-medium">Super Vote</span>}
                    </p>
                  </div>
                </div>
                {sessionState.config.allowVoteChanges && (
                  <button onClick={startChangeVote} className="btn-secondary w-full">
                    Change Vote
                  </button>
                )}
              </div>
            )}

            {/* Option cards */}
            {(!hasVoted || showChangeVote) && (
              <div className="space-y-3 mb-6">
                {question.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => { setSelectedOption(idx); if (idx !== selectedOption) setUseSuper(false); }}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 group
                        ${isSelected
                          ? 'border-brand bg-brand/10 shadow-glow-sm'
                          : 'border-surface-border bg-surface-card hover:border-brand/40 hover:bg-surface-hover'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
                          ${isSelected ? 'border-brand bg-brand' : 'border-gray-600 group-hover:border-brand/60'}`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className={`font-medium ${isSelected ? 'text-brand-light' : 'text-gray-200'}`}>
                          {opt}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {/* Abstain option */}
                {sessionState.config.enableAbstains && (
                  <button
                    onClick={() => { setSelectedOption('abstain'); setUseSuper(false); }}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200
                      ${selectedOption === 'abstain'
                        ? 'border-gray-500 bg-gray-500/10'
                        : 'border-surface-border bg-surface-card hover:border-gray-500/50 hover:bg-surface-hover'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
                        ${selectedOption === 'abstain' ? 'border-gray-400 bg-gray-400' : 'border-gray-600'}`}>
                        {selectedOption === 'abstain' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <span className="text-gray-400 italic font-medium">Abstain</span>
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* Super vote toggle */}
            {(!hasVoted || showChangeVote) && canUseSuper && selectedOption !== null && selectedOption !== 'abstain' && (
              <div className="mb-4">
                <button
                  onClick={() => setUseSuper(v => !v)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 transition-all duration-200
                    ${useSuper
                      ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                      : 'border-surface-border bg-surface-panel hover:border-amber-500/40'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" />
                    <div className="text-left">
                      <p className={`font-semibold text-sm ${useSuper ? 'text-amber-300' : 'text-gray-300'}`}>
                        Use Super Vote
                      </p>
                      <p className="text-xs text-gray-500">
                        {effectiveSuperLeft} remaining · Worth {sessionState.config.superVoteAmount}× points
                      </p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                    ${useSuper ? 'border-amber-400 bg-amber-400' : 'border-gray-600'}`}>
                    {useSuper && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>
              </div>
            )}

            {/* Submit button */}
            {(!hasVoted || showChangeVote) && (
              <button
                onClick={handleVote}
                disabled={selectedOption === null || submitting}
                className="btn-primary w-full py-3.5 text-base"
              >
                {submitting ? 'Submitting...' : showChangeVote ? 'Update Vote' : 'Submit Vote'}
              </button>
            )}
          </>
        ) : (
          /* Host read-only view */
          <div className="space-y-3">
            <p className="text-sm text-gray-500 italic mb-4">You are not participating in this vote.</p>
            {question.options.map((opt, idx) => {
              const voteCount = Object.values(sessionState.votes).filter(v => v.optionIndex === idx).length;
              return (
                <div key={idx} className="p-4 rounded-xl border border-surface-border bg-surface-card flex items-center justify-between">
                  <span className="text-gray-200 font-medium">{opt}</span>
                  {!sessionState.config.anonymous && (
                    <span className="text-sm text-gray-500">{voteCount} vote{voteCount !== 1 ? 's' : ''}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Super vote remaining indicator */}
        {canVote && superVotesLeft > 0 && !showChangeVote && (
          <div className="mt-4 text-center text-xs text-amber-400/70">
            {superVotesLeft} super vote{superVotesLeft !== 1 ? 's' : ''} remaining
          </div>
        )}
      </div>

      {/* Leave confirm */}
      {showLeaveConfirm && (
        <Modal title="Leave Session?" onClose={() => setShowLeaveConfirm(false)} maxWidth="max-w-sm">
          <div className="space-y-4">
            <p className="text-gray-300">Are you sure you want to leave? Your vote will be removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLeaveConfirm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleLeave} className="btn-danger flex-1">Leave</button>
            </div>
          </div>
        </Modal>
      )}

      {/* End voting confirm modal */}
      {showEndConfirm && (
        <Modal title="End Voting?" onClose={() => setShowEndConfirm(false)} maxWidth="max-w-sm">
          <div className="space-y-4">
            <p className="text-gray-300">
              {sessionState.votedCount} of {sessionState.eligibleVoterCount} have voted.
              End voting now and show results?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowEndConfirm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleEndVoting} className="btn-primary flex-1">End Voting</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
