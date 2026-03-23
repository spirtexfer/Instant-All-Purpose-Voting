import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket, connectSocket } from './socket';
import { ClientSessionState, AppScreen, ToastMessage } from './types';
import HomeScreen from './components/HomeScreen';
import LobbyScreen from './components/LobbyScreen';
import VotingScreen from './components/VotingScreen';
import ResultsScreen from './components/ResultsScreen';
import Toast from './components/Toast';

let toastIdCounter = 0;

export default function App() {
  const [appScreen, setAppScreen] = useState<AppScreen>('home');
  const [sessionState, setSessionState] = useState<ClientSessionState | null>(null);
  const [mySocketId, setMySocketId] = useState<string>('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttemptedRef = useRef(false);
  const connectionErrorShownRef = useRef(false);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = String(++toastIdCounter);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleReturnHome = useCallback(() => {
    setAppScreen('home');
    setSessionState(null);
    reconnectAttemptedRef.current = false;
  }, []);

  useEffect(() => {
    const socket = getSocket();
    connectSocket();

    socket.on('connect', () => {
      setIsConnected(true);
      setMySocketId(socket.id || '');
      connectionErrorShownRef.current = false;

      // Attempt host reconnect if we have stored credentials
      if (!reconnectAttemptedRef.current) {
        reconnectAttemptedRef.current = true;
        const token = localStorage.getItem('hostReconnectToken');
        const code = localStorage.getItem('hostSessionCode');
        if (token && code) {
          socket.emit('host:reconnect', { code, token }, (res: { success: boolean; error?: string }) => {
            if (res.success) {
              addToast('Reconnected to session!', 'success');
            } else {
              localStorage.removeItem('hostReconnectToken');
              localStorage.removeItem('hostSessionCode');
            }
          });
        }
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      reconnectAttemptedRef.current = false;
    });

    socket.on('session:state', (state: ClientSessionState) => {
      setSessionState(state);
      setAppScreen(state.phase === 'lobby' ? 'lobby' : state.phase === 'voting' ? 'voting' : 'results');
    });

    socket.on('kicked', () => {
      setSessionState(null);
      setAppScreen('home');
      addToast('You were kicked from the session.', 'error');
    });

    socket.on('session:ended', () => {
      setSessionState(null);
      setAppScreen('home');
      localStorage.removeItem('hostReconnectToken');
      localStorage.removeItem('hostSessionCode');
      addToast('The session has ended.', 'warning');
    });

    socket.on('connect_error', () => {
      if (!connectionErrorShownRef.current) {
        connectionErrorShownRef.current = true;
        addToast('Connection error. Retrying...', 'error');
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('session:state');
      socket.off('kicked');
      socket.off('session:ended');
      socket.off('connect_error');
    };
  }, [addToast]);

  const handleSessionCreated = useCallback((code: string, token: string) => {
    localStorage.setItem('hostReconnectToken', token);
    localStorage.setItem('hostSessionCode', code);
  }, []);

  const handleLeaveSession = useCallback(() => {
    localStorage.removeItem('hostReconnectToken');
    localStorage.removeItem('hostSessionCode');
    handleReturnHome();
  }, [handleReturnHome]);

  const socket = getSocket();

  return (
    <div className="min-h-screen bg-surface text-gray-100 font-sans">
      {!isConnected && appScreen !== 'home' && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-900/80 text-red-100 text-sm text-center py-1.5 px-4">
          Disconnected — attempting to reconnect...
        </div>
      )}

      {appScreen === 'home' && (
        <HomeScreen
          socket={socket}
          onSessionCreated={handleSessionCreated}
          addToast={addToast}
        />
      )}

      {appScreen === 'lobby' && sessionState && (
        <LobbyScreen
          socket={socket}
          sessionState={sessionState}
          mySocketId={mySocketId}
          onLeaveSession={handleLeaveSession}
          addToast={addToast}
        />
      )}

      {appScreen === 'voting' && sessionState && (
        <VotingScreen
          socket={socket}
          sessionState={sessionState}
          mySocketId={mySocketId}
          onLeaveSession={handleLeaveSession}
          addToast={addToast}
        />
      )}

      {appScreen === 'results' && sessionState && (
        <ResultsScreen
          socket={socket}
          sessionState={sessionState}
          mySocketId={mySocketId}
          onLeaveSession={handleLeaveSession}
          addToast={addToast}
        />
      )}

      {/* Toast overlay */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </div>
  );
}
