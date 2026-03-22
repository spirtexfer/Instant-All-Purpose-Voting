import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { ClientSessionState, ResultOptionData } from '../types';
import QuestionCreatorModal from './QuestionCreatorModal';
import Modal from './Modal';

interface Props {
  socket: Socket;
  sessionState: ClientSessionState;
  mySocketId: string;
  onLeaveSession: () => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export default function ResultsScreen({ socket, sessionState, mySocketId, onLeaveSession, addToast }: Props) {
  const [showNextModal, setShowNextModal] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [animatedWidths, setAnimatedWidths] = useState<Record<number, number>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const myParticipant = sessionState.participants.find(p => p.socketId === mySocketId);
  const isHost = myParticipant?.isHost ?? false;
  const results = sessionState.results;

  // Use actual max if any votes exist, otherwise 1 to avoid division by zero
  const rawMax = results && results.options.length > 0
    ? Math.max(...results.options.map(o => o.weightedTotal))
    : 0;
  const maxTotal = rawMax > 0 ? rawMax : 1;

  // Animate bars from 0 to actual values
  useEffect(() => {
    if (!results) return;
    const initial: Record<number, number> = {};
    results.options.forEach(o => { initial[o.optionIndex] = 0; });
    setAnimatedWidths(initial);

    const t = setTimeout(() => {
      const target: Record<number, number> = {};
      results.options.forEach(o => {
        target[o.optionIndex] = maxTotal > 0 ? (o.weightedTotal / maxTotal) * 100 : 0;
      });
      setAnimatedWidths(target);
    }, 250);

    return () => clearTimeout(t);
  }, [results?.question?.text]);

  // Confetti on winner
  useEffect(() => {
    if (!results || results.isTie || results.winnerIndices.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#f97316', '#fb923c', '#818cf8', '#4f46e5', '#fbbf24', '#34d399', '#f472b6', '#a5b4fc'];
    const particles = Array.from({ length: 75 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height * 0.4 - 10,
      vx: (Math.random() - 0.5) * 2.5,
      vy: Math.random() * 2.5 + 1.2,
      color: colors[Math.floor(Math.random() * colors.length)],
      w: Math.random() * 9 + 4,
      h: Math.random() * 5 + 3,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.12,
      opacity: 1,
    }));

    const startTime = Date.now();
    const duration = 4500;
    let frame: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const elapsed = Date.now() - startTime;
      const fadeStart = duration * 0.65;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        if (elapsed > fadeStart) {
          p.opacity = Math.max(0, 1 - (elapsed - fadeStart) / (duration - fadeStart));
        }

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (elapsed < duration) {
        frame = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [results?.question?.text]);

  const handleLeave = () => {
    socket.emit('participant:leave', { code: sessionState.code }, (res: { success: boolean; error?: string }) => {
      if (res.success) {
        onLeaveSession();
      } else {
        addToast(res.error || 'Failed to leave.', 'error');
      }
    });
  };

  const handleEndSession = () => {
    socket.emit('session:end', { code: sessionState.code }, () => {
      onLeaveSession();
    });
  };

  if (!results) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading results...</p>
      </div>
    );
  }

  const getSuperVotersForOption = (option: ResultOptionData) => {
    return option.voters.filter(v => v.isSuper);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Confetti canvas overlay */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-50"
      />

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
          <span className="font-semibold text-gray-100">Results</span>
          <span className="text-xs bg-surface-panel border border-surface-border rounded px-2 py-0.5 text-gray-500">
            {sessionState.code}
          </span>
        </div>
        <div className="flex gap-2">
          {isHost ? (
            <>
              <button onClick={() => setShowNextModal(true)} className="btn-primary text-sm py-2 px-4">
                Next Question
              </button>
              <button onClick={() => setShowEndConfirm(true)} className="btn-danger text-sm py-2 px-4">
                End Session
              </button>
            </>
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
        <div className="mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 font-medium">Question</p>
          <h2 className="text-xl font-bold text-gray-100">{results.question.text}</h2>
        </div>

        {/* Tie / Everyone Abstained banner */}
        {results.isTie && (
          <div className="mb-6 bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 text-center">
            {results.everyoneAbstained ? (
              <p className="text-amber-300 font-semibold text-lg">Everyone abstained</p>
            ) : results.winnerIndices.length === 0 ? (
              <p className="text-amber-300 font-semibold text-lg">It's a tie — no votes cast</p>
            ) : (
              <>
                <p className="text-amber-300 font-semibold text-lg mb-1">It's a tie!</p>
                <p className="text-amber-400/80 text-sm">
                  Tied: {results.winnerIndices.map(i => results.options.find(o => o.optionIndex === i)?.optionText).filter(Boolean).join(', ')}
                </p>
              </>
            )}
          </div>
        )}

        {/* Result options */}
        <div className="space-y-4 mb-8">
          {results.options.map((option) => {
            const isWinner = results.winnerIndices.includes(option.optionIndex) && !results.isTie;
            const isTied = results.winnerIndices.includes(option.optionIndex) && results.isTie;
            const superVoters = getSuperVotersForOption(option);

            return (
              <div
                key={option.optionIndex}
                className={`rounded-xl border transition-all duration-300
                  ${isWinner
                    ? 'border-orange-500/60 bg-orange-500/5 shadow-glow-gold p-6'
                    : isTied
                    ? 'border-amber-700/50 bg-amber-900/10 p-4'
                    : 'border-surface-border bg-surface-card p-4'
                  }`}
              >
                {/* Option header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isWinner && (
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-400 flex-shrink-0" />
                    )}
                    <span className={`truncate ${
                      isWinner
                        ? 'text-orange-300 text-2xl font-extrabold'
                        : 'text-gray-100 font-semibold'
                    }`}>
                      {option.optionText}
                    </span>
                    {isWinner && (
                      <span className="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded font-medium flex-shrink-0">
                        Winner
                      </span>
                    )}
                  </div>
                  <div className={`text-right flex-shrink-0 ml-4 ${isWinner ? 'text-orange-300' : 'text-gray-300'}`}>
                    <span className={`font-bold ${isWinner ? 'text-4xl' : 'text-xl'}`}>{option.weightedTotal}</span>
                    <span className="text-sm text-gray-500 ml-1">pts</span>
                  </div>
                </div>

                {/* Bar */}
                <div className={`bg-surface-border rounded-full overflow-hidden mb-3 ${isWinner ? 'h-5' : 'h-3'}`}>
                  <div
                    className={`h-full rounded-full
                      ${isWinner ? 'bg-orange-400' : isTied ? 'bg-amber-500' : 'bg-brand'}`}
                    style={{
                      width: `${animatedWidths[option.optionIndex] ?? 0}%`,
                      transition: 'width 2.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>

                {/* Voter names (non-anonymous) */}
                {!sessionState.config.anonymous && option.voters.length > 0 && (
                  <div className="text-sm text-gray-400">
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {option.voters.map((voter, i) => (
                        <span
                          key={i}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                            ${voter.isSuper
                              ? 'bg-amber-900/40 border border-amber-700/50 text-amber-300'
                              : 'bg-surface-panel border border-surface-border text-gray-300'
                            }`}
                        >
                          {voter.isSuper && <span className="text-amber-400 font-bold">S</span>}
                          {voter.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Anonymous super vote announcements */}
                {sessionState.config.anonymous && superVoters.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {superVoters.map((_, i) => (
                      <p key={i} className="text-xs text-amber-400/80 italic">
                        Someone used a super vote on "{option.optionText}"
                      </p>
                    ))}
                  </div>
                )}

                {/* Vote count label */}
                {sessionState.config.anonymous && (
                  <p className="text-xs text-gray-500 mt-1">
                    {option.voters.length} vote{option.voters.length !== 1 ? 's' : ''}
                    {option.weightedTotal !== option.voters.length ? ` (${option.weightedTotal} points)` : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Abstain section */}
        {results.abstainCount > 0 && (
          <div className="card mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-300 font-medium">Abstained ({results.abstainCount})</span>
            </div>
            {!sessionState.config.anonymous && results.abstainVoters.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {results.abstainVoters.map((v, i) => (
                  <span key={i} className="text-xs bg-surface-panel border border-surface-border text-gray-400 px-2 py-0.5 rounded-full">
                    {v.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Non-host next question prompt */}
        {!isHost && (
          <div className="text-center py-6 text-gray-500 italic text-sm">
            Waiting for host to start next question...
          </div>
        )}
      </div>

      {/* Next question modal */}
      {showNextModal && (
        <QuestionCreatorModal
          socket={socket}
          sessionCode={sessionState.code}
          onClose={() => setShowNextModal(false)}
          addToast={addToast}
        />
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

      {/* End session confirm */}
      {showEndConfirm && (
        <Modal title="End Session?" onClose={() => setShowEndConfirm(false)} maxWidth="max-w-sm">
          <div className="space-y-4">
            <p className="text-gray-300">End the session for all participants?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowEndConfirm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleEndSession} className="btn-danger flex-1">End Session</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
