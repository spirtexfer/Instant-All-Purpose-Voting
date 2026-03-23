import { useState } from 'react';
import { Socket } from 'socket.io-client';
import HostModal from './HostModal';
import JoinModal from './JoinModal';

interface Props {
  socket: Socket;
  isConnected: boolean;
  onSessionCreated: (code: string, token: string) => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

type ActiveModal = 'host' | 'join' | null;

export default function HomeScreen({ socket, isConnected, onSessionCreated, addToast }: Props) {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute rounded-full animate-float-slow"
          style={{
            width: 520, height: 520,
            top: '0%', left: '5%',
            background: 'radial-gradient(circle, rgba(79,70,229,0.13) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute rounded-full animate-float-medium"
          style={{
            width: 380, height: 380,
            top: '45%', right: '5%',
            background: 'radial-gradient(circle, rgba(129,140,248,0.09) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute rounded-full animate-float-fast"
          style={{
            width: 260, height: 260,
            bottom: '10%', left: '30%',
            background: 'radial-gradient(circle, rgba(79,70,229,0.1) 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute rounded-full animate-float-slow"
          style={{
            width: 190, height: 190,
            top: '25%', right: '28%',
            animationDelay: '-4s',
            background: 'radial-gradient(circle, rgba(129,140,248,0.07) 0%, transparent 60%)',
          }}
        />
        <div
          className="absolute rounded-full animate-float-medium"
          style={{
            width: 140, height: 140,
            top: '65%', left: '12%',
            animationDelay: '-2s',
            background: 'radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 60%)',
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-lg w-full">
        {/* Title */}
        <h1
          className="text-5xl font-extrabold mb-3 leading-tight"
          style={{
            background: 'linear-gradient(135deg, #818cf8 0%, #4f46e5 50%, #a5b4fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 20px rgba(79,70,229,0.5))',
          }}
        >
          Group Split Decider
        </h1>

        {/* Subtitle */}
        <p className="text-gray-400 text-lg mb-12 font-light">
          Group decisions, made simple.
        </p>

        {/* Action buttons */}
        {isConnected ? (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setActiveModal('host')}
              className="flex items-center justify-center bg-brand hover:bg-brand-dark text-white
                font-semibold py-4 px-10 rounded-xl text-lg transition-all duration-200
                active:scale-95 hover:shadow-glow border border-brand-light/20"
            >
              Host
            </button>

            <button
              onClick={() => setActiveModal('join')}
              className="flex items-center justify-center bg-surface-panel hover:bg-surface-hover
                text-gray-100 font-semibold py-4 px-10 rounded-xl text-lg transition-all duration-200
                active:scale-95 border border-surface-border hover:border-brand/50"
            >
              Join
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
              <span className="text-base">Connecting to server...</span>
            </div>
            <p className="text-xs text-gray-600">This may take up to 60 seconds on first load</p>
          </div>
        )}

        {/* Footer */}
        <p className="text-gray-600 text-sm mt-16">
          No account needed · Real-time · Free
        </p>
      </div>

      {/* Modals */}
      {activeModal === 'host' && (
        <HostModal
          socket={socket}
          onClose={() => setActiveModal(null)}
          onSuccess={onSessionCreated}
          addToast={addToast}
        />
      )}
      {activeModal === 'join' && (
        <JoinModal
          socket={socket}
          onClose={() => setActiveModal(null)}
          addToast={addToast}
        />
      )}
    </div>
  );
}
