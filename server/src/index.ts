import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  createSession,
  getSession,
  deleteSession,
  findSessionBySocketId,
  addParticipant,
  removeParticipant,
  isNameTaken,
  getEligibleVoterCount,
  getVotedCount,
  castVote,
  computeResults,
} from './sessionManager';
import { ClientSessionState, Session } from './types';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

function buildClientState(session: Session, viewerSocketId: string): ClientSessionState {
  const participants = Array.from(session.participants.values()).map(p => ({
    socketId: p.socketId,
    name: p.name,
    isHost: p.isHost,
    superVotesRemaining: p.superVotesRemaining,
  }));

  let votes: ClientSessionState['votes'] = {};

  if (session.config.anonymous) {
    // Only include the viewer's own vote
    const myVote = session.votes.get(viewerSocketId);
    if (myVote) {
      votes[viewerSocketId] = {
        socketId: myVote.socketId,
        optionIndex: myVote.optionIndex,
        isSuper: myVote.isSuper,
      };
    }
  } else {
    for (const [sid, vote] of session.votes.entries()) {
      votes[sid] = {
        socketId: vote.socketId,
        optionIndex: vote.optionIndex,
        isSuper: vote.isSuper,
      };
    }
  }

  const votedSocketIds = Array.from(session.votes.keys());

  return {
    code: session.code,
    config: session.config,
    participants,
    phase: session.phase,
    firstQuestionStarted: session.firstQuestionStarted,
    currentQuestion: session.currentQuestion,
    votes,
    votedSocketIds,
    eligibleVoterCount: getEligibleVoterCount(session),
    votedCount: getVotedCount(session),
    results: session.results,
    hostDisconnected: session.hostDisconnected,
    hostDisconnectSecondsLeft: session.hostDisconnectSecondsLeft,
  };
}

function broadcastSessionState(session: Session): void {
  for (const participant of session.participants.values()) {
    const state = buildClientState(session, participant.socketId);
    io.to(participant.socketId).emit('session:state', state);
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('session:create', (data: { config: any; hostName: string }, callback) => {
    const { config, hostName } = data;
    if (!hostName || !hostName.trim()) {
      return callback({ success: false, error: 'Host name required' });
    }

    const sessionConfig = {
      hostJoinsVote: config.hostJoinsVote ?? true,
      superVotesPerPerson: Math.max(0, parseInt(config.superVotesPerPerson) || 1),
      superVoteAmount: Math.max(2, parseInt(config.superVoteAmount) || 3),
      anonymous: config.anonymous ?? false,
      allowLateJoins: config.allowLateJoins ?? true,
      enableAbstains: config.enableAbstains ?? false,
      allowVoteChanges: config.allowVoteChanges ?? false,
    };

    const session = createSession(sessionConfig, socket.id, hostName.trim());
    socket.join(session.code);

    console.log(`Session created: ${session.code} by ${hostName}`);
    callback({ success: true, code: session.code, hostReconnectToken: session.hostReconnectToken });
    broadcastSessionState(session);
  });

  socket.on('session:check', (code: string, callback) => {
    const upperCode = code.toUpperCase();
    const session = getSession(upperCode);
    if (!session) {
      return callback({ exists: false, joinable: false, reason: 'Session not found' });
    }
    if (session.phase !== 'lobby' && !session.config.allowLateJoins) {
      return callback({ exists: true, joinable: false, reason: 'Late joins not allowed' });
    }
    callback({ exists: true, joinable: true });
  });

  socket.on('session:join', (data: { code: string; name: string }, callback) => {
    const { code, name } = data;
    const session = getSession(code.toUpperCase());

    if (!session) {
      return callback({ success: false, error: 'Session not found' });
    }

    if (session.phase !== 'lobby' && !session.config.allowLateJoins) {
      return callback({ success: false, error: 'Late joins not allowed' });
    }

    if (!name || !name.trim()) {
      return callback({ success: false, error: 'Name required' });
    }

    if (isNameTaken(session, name.trim())) {
      return callback({ success: false, error: 'Name already taken' });
    }

    addParticipant(session, socket.id, name.trim());
    socket.join(session.code);

    console.log(`${name} joined session ${session.code}`);
    callback({ success: true });
    broadcastSessionState(session);
  });

  socket.on('host:reconnect', (data: { code: string; token: string }, callback) => {
    const session = getSession(data.code);
    if (!session) {
      return callback({ success: false, error: 'Session not found' });
    }
    if (session.hostReconnectToken !== data.token) {
      return callback({ success: false, error: 'Invalid token' });
    }

    // Clear disconnect timer
    if (session.hostDisconnectTimer) {
      clearInterval(session.hostDisconnectTimer);
      session.hostDisconnectTimer = null;
    }

    // Update host socketId
    const oldHostId = session.hostSocketId;
    const hostParticipant = session.participants.get(oldHostId);
    if (hostParticipant) {
      session.participants.delete(oldHostId);
      hostParticipant.socketId = socket.id;
      session.participants.set(socket.id, hostParticipant);
    }

    // Update vote entry if exists
    const hostVote = session.votes.get(oldHostId);
    if (hostVote) {
      session.votes.delete(oldHostId);
      hostVote.socketId = socket.id;
      session.votes.set(socket.id, hostVote);
    }

    session.hostSocketId = socket.id;
    session.hostDisconnected = false;
    session.hostDisconnectSecondsLeft = 15;
    session.hostDisconnectedAt = null;

    socket.join(session.code);
    console.log(`Host reconnected to session ${session.code}`);
    callback({ success: true });
    broadcastSessionState(session);
  });

  socket.on('participant:kick', (data: { code: string; targetSocketId: string }, callback) => {
    const session = getSession(data.code);
    if (!session) return callback({ success: false, error: 'Session not found' });

    const requester = session.participants.get(socket.id);
    if (!requester || !requester.isHost) {
      return callback({ success: false, error: 'Only host can kick' });
    }

    const target = session.participants.get(data.targetSocketId);
    if (!target) return callback({ success: false, error: 'Participant not found' });

    if (target.isHost) return callback({ success: false, error: 'Cannot kick host' });

    // Remove their vote if any
    session.votes.delete(data.targetSocketId);

    removeParticipant(session, data.targetSocketId);
    io.to(data.targetSocketId).emit('kicked');
    const targetSocket = io.sockets.sockets.get(data.targetSocketId);
    if (targetSocket) {
      targetSocket.leave(session.code);
    }

    console.log(`${target.name} kicked from session ${session.code}`);
    callback({ success: true });
    broadcastSessionState(session);

    // Auto-end if all remaining eligible voters have voted
    if (session.phase === 'voting') {
      const eligible = getEligibleVoterCount(session);
      const voted = getVotedCount(session);
      if (eligible > 0 && voted >= eligible) {
        session.phase = 'results';
        session.results = computeResults(session);
        broadcastSessionState(session);
      }
    }
  });

  socket.on('participant:setSuperVotes', (data: { code: string; targetSocketId: string; amount: number }, callback) => {
    const session = getSession(data.code);
    if (!session) return callback({ success: false, error: 'Session not found' });

    const requester = session.participants.get(socket.id);
    if (!requester || !requester.isHost) {
      return callback({ success: false, error: 'Only host can set super votes' });
    }

    if (session.firstQuestionStarted) {
      return callback({ success: false, error: 'Cannot change super votes after first question started' });
    }

    const target = session.participants.get(data.targetSocketId);
    if (!target) return callback({ success: false, error: 'Participant not found' });

    target.superVotesRemaining = Math.max(0, Math.floor(data.amount));
    callback({ success: true });
    broadcastSessionState(session);
  });

  socket.on('question:start', (data: { code: string; question: { text: string; options: string[] } }, callback) => {
    const session = getSession(data.code);
    if (!session) return callback({ success: false, error: 'Session not found' });

    const requester = session.participants.get(socket.id);
    if (!requester || !requester.isHost) {
      return callback({ success: false, error: 'Only host can start questions' });
    }

    if (!data.question.text || !data.question.text.trim()) {
      return callback({ success: false, error: 'Question text required' });
    }

    if (!data.question.options || data.question.options.length < 2) {
      return callback({ success: false, error: 'At least 2 options required' });
    }

    const cleanOptions = data.question.options.map(o => o.trim()).filter(o => o.length > 0);
    if (cleanOptions.length < 2) {
      return callback({ success: false, error: 'At least 2 non-empty options required' });
    }

    session.phase = 'voting';
    session.firstQuestionStarted = true;
    session.currentQuestion = { text: data.question.text.trim(), options: cleanOptions };
    session.votes = new Map();
    session.results = null;

    console.log(`Question started in session ${session.code}: ${data.question.text}`);
    callback({ success: true });
    broadcastSessionState(session);
  });

  socket.on('vote:cast', (data: { code: string; optionIndex: number | 'abstain'; isSuper: boolean }, callback) => {
    const session = getSession(data.code);
    if (!session) return callback({ success: false, error: 'Session not found' });

    const result = castVote(session, socket.id, data.optionIndex, data.isSuper);
    if (!result.success) {
      return callback({ success: false, error: result.error });
    }

    callback({ success: true });
    broadcastSessionState(session);

    // Auto-end voting when all eligible voters have voted
    const eligible = getEligibleVoterCount(session);
    const voted = getVotedCount(session);
    if (eligible > 0 && voted >= eligible && session.phase === 'voting') {
      session.phase = 'results';
      session.results = computeResults(session);
      console.log(`Voting auto-ended in session ${session.code} (all ${eligible} voted)`);
      broadcastSessionState(session);
    }
  });

  socket.on('participant:leave', (data: { code: string }, callback) => {
    const session = getSession(data.code);
    if (!session) return callback({ success: false, error: 'Session not found' });

    const participant = session.participants.get(socket.id);
    if (!participant) return callback({ success: false, error: 'Not in session' });
    if (participant.isHost) return callback({ success: false, error: 'Host cannot leave' });

    session.votes.delete(socket.id);
    removeParticipant(session, socket.id);
    socket.leave(session.code);

    console.log(`${participant.name} left session ${session.code}`);
    callback({ success: true });
    broadcastSessionState(session);

    // Auto-end if all remaining eligible voters have voted
    if (session.phase === 'voting') {
      const eligible = getEligibleVoterCount(session);
      const voted = getVotedCount(session);
      if (eligible > 0 && voted >= eligible) {
        session.phase = 'results';
        session.results = computeResults(session);
        broadcastSessionState(session);
      }
    }
  });

  socket.on('vote:end', (data: { code: string }, callback) => {
    const session = getSession(data.code);
    if (!session) return callback({ success: false, error: 'Session not found' });

    const requester = session.participants.get(socket.id);
    if (!requester || !requester.isHost) {
      return callback({ success: false, error: 'Only host can end voting' });
    }

    if (session.phase !== 'voting') {
      return callback({ success: false, error: 'Not in voting phase' });
    }

    session.phase = 'results';
    session.results = computeResults(session);

    console.log(`Voting ended in session ${session.code}`);
    callback({ success: true });
    broadcastSessionState(session);
  });

  socket.on('session:end', (data: { code: string }, callback) => {
    const session = getSession(data.code);
    if (!session) return callback({ success: false, error: 'Session not found' });

    const requester = session.participants.get(socket.id);
    if (!requester || !requester.isHost) {
      return callback({ success: false, error: 'Only host can end session' });
    }

    if (session.hostDisconnectTimer) {
      clearInterval(session.hostDisconnectTimer);
    }

    io.to(session.code).emit('session:ended');
    deleteSession(session.code);

    console.log(`Session ${session.code} ended by host`);
    callback({ success: true });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const session = findSessionBySocketId(socket.id);
    if (!session) return;

    const participant = session.participants.get(socket.id);
    if (!participant) return;

    if (participant.isHost) {
      // Start host disconnect countdown
      session.hostDisconnected = true;
      session.hostDisconnectSecondsLeft = 15;
      session.hostDisconnectedAt = Date.now();

      broadcastSessionState(session);

      session.hostDisconnectTimer = setInterval(() => {
        session.hostDisconnectSecondsLeft -= 1;
        broadcastSessionState(session);

        if (session.hostDisconnectSecondsLeft <= 0) {
          if (session.hostDisconnectTimer) {
            clearInterval(session.hostDisconnectTimer);
            session.hostDisconnectTimer = null;
          }
          io.to(session.code).emit('session:ended');
          deleteSession(session.code);
          console.log(`Session ${session.code} ended due to host disconnect timeout`);
        }
      }, 1000);
    } else {
      // Remove non-host participant
      session.votes.delete(socket.id);
      removeParticipant(session, socket.id);
      broadcastSessionState(session);

      // Auto-end if all remaining eligible voters have voted
      if (session.phase === 'voting') {
        const eligible = getEligibleVoterCount(session);
        const voted = getVotedCount(session);
        if (eligible > 0 && voted >= eligible) {
          session.phase = 'results';
          session.results = computeResults(session);
          broadcastSessionState(session);
        }
      }
    }
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
