import { Session, SessionConfig, Participant, Question, VoteEntry, ResultData, ResultOptionData } from './types';
import { v4 as uuidv4 } from 'uuid';

const sessions = new Map<string, Session>();

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createSession(config: SessionConfig, hostSocketId: string, hostName: string): Session {
  let code = generateCode();
  while (sessions.has(code)) {
    code = generateCode();
  }

  const hostReconnectToken = uuidv4();
  const hostParticipant: Participant = {
    socketId: hostSocketId,
    name: hostName,
    isHost: true,
    superVotesRemaining: config.superVotesPerPerson,
  };

  const session: Session = {
    code,
    config,
    hostSocketId,
    hostReconnectToken,
    participants: new Map([[hostSocketId, hostParticipant]]),
    phase: 'lobby',
    firstQuestionStarted: false,
    currentQuestion: null,
    votes: new Map(),
    results: null,
    hostDisconnected: false,
    hostDisconnectSecondsLeft: 15,
    hostDisconnectTimer: null,
    hostDisconnectedAt: null,
  };

  sessions.set(code, session);
  return session;
}

export function getSession(code: string): Session | undefined {
  return sessions.get(code.toUpperCase());
}

export function deleteSession(code: string): void {
  sessions.delete(code.toUpperCase());
}

export function findSessionBySocketId(socketId: string): Session | undefined {
  for (const session of sessions.values()) {
    if (session.participants.has(socketId)) {
      return session;
    }
  }
  return undefined;
}

export function addParticipant(session: Session, socketId: string, name: string): void {
  const participant: Participant = {
    socketId,
    name,
    isHost: false,
    superVotesRemaining: session.config.superVotesPerPerson,
  };
  session.participants.set(socketId, participant);
}

export function removeParticipant(session: Session, socketId: string): void {
  session.participants.delete(socketId);
}

export function isNameTaken(session: Session, name: string): boolean {
  for (const p of session.participants.values()) {
    if (p.name.toLowerCase() === name.toLowerCase()) {
      return true;
    }
  }
  return false;
}

export function getEligibleVoterCount(session: Session): number {
  if (session.config.hostJoinsVote) {
    return session.participants.size;
  }
  let count = 0;
  for (const p of session.participants.values()) {
    if (!p.isHost) count++;
  }
  return count;
}

export function getVotedCount(session: Session): number {
  return session.votes.size;
}

export function castVote(session: Session, socketId: string, optionIndex: number | 'abstain', isSuper: boolean): { success: boolean; error?: string } {
  const participant = session.participants.get(socketId);
  if (!participant) return { success: false, error: 'Participant not found' };

  if (!session.config.hostJoinsVote && participant.isHost) {
    return { success: false, error: 'Host is not participating in the vote' };
  }

  if (session.phase !== 'voting') return { success: false, error: 'Not in voting phase' };

  const existingVote = session.votes.get(socketId);

  if (existingVote && !session.config.allowVoteChanges) {
    return { success: false, error: 'Vote changes not allowed' };
  }

  // Handle refund of previous super vote
  if (existingVote && existingVote.isSuper) {
    participant.superVotesRemaining += 1;
  }

  // Handle new super vote
  if (isSuper) {
    if (optionIndex === 'abstain') {
      return { success: false, error: 'Cannot use super vote on abstain' };
    }
    if (participant.superVotesRemaining <= 0) {
      return { success: false, error: 'No super votes remaining' };
    }
    participant.superVotesRemaining -= 1;
  }

  session.votes.set(socketId, { socketId, optionIndex, isSuper });
  return { success: true };
}

export function computeResults(session: Session): ResultData {
  const question = session.currentQuestion!;
  const optionTotals = new Map<number, { weightedTotal: number; voters: { socketId: string; name: string; isSuper: boolean }[] }>();

  for (let i = 0; i < question.options.length; i++) {
    optionTotals.set(i, { weightedTotal: 0, voters: [] });
  }

  let abstainCount = 0;
  const abstainVoters: { socketId: string; name: string }[] = [];

  for (const vote of session.votes.values()) {
    const participant = session.participants.get(vote.socketId);
    const name = participant ? participant.name : 'Unknown';

    if (vote.optionIndex === 'abstain') {
      abstainCount++;
      abstainVoters.push({ socketId: vote.socketId, name });
    } else {
      const idx = vote.optionIndex as number;
      const optionData = optionTotals.get(idx);
      if (optionData) {
        const points = vote.isSuper ? session.config.superVoteAmount : 1;
        optionData.weightedTotal += points;
        optionData.voters.push({ socketId: vote.socketId, name, isSuper: vote.isSuper });
      }
    }
  }

  const resultOptions: ResultOptionData[] = [];
  for (const [idx, data] of optionTotals.entries()) {
    resultOptions.push({
      optionIndex: idx,
      optionText: question.options[idx],
      weightedTotal: data.weightedTotal,
      voters: data.voters,
    });
  }

  // Sort by weighted total descending
  resultOptions.sort((a, b) => b.weightedTotal - a.weightedTotal);

  const maxTotal = resultOptions.length > 0 ? resultOptions[0].weightedTotal : 0;
  const everyoneAbstained = maxTotal === 0 && abstainCount > 0;
  const allZero = maxTotal === 0;

  let winnerIndices: number[] = [];
  let isTie = false;

  if (allZero) {
    isTie = true;
    winnerIndices = [];
  } else {
    const winners = resultOptions.filter(o => o.weightedTotal === maxTotal);
    winnerIndices = winners.map(w => w.optionIndex);
    isTie = winners.length > 1;
  }

  return {
    options: resultOptions,
    winnerIndices,
    isTie,
    everyoneAbstained,
    abstainCount,
    abstainVoters,
    question,
  };
}
