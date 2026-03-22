export interface SessionConfig {
  hostJoinsVote: boolean;
  superVotesPerPerson: number;
  superVoteAmount: number;
  anonymous: boolean;
  allowLateJoins: boolean;
  enableAbstains: boolean;
  allowVoteChanges: boolean;
}

export interface Participant {
  socketId: string;
  name: string;
  isHost: boolean;
  superVotesRemaining: number;
}

export interface Question {
  text: string;
  options: string[];
}

export interface VoteEntry {
  socketId: string;
  optionIndex: number | 'abstain';
  isSuper: boolean;
}

export interface ResultOptionData {
  optionIndex: number;
  optionText: string;
  weightedTotal: number;
  voters: { socketId: string; name: string; isSuper: boolean }[];
}

export interface ResultData {
  options: ResultOptionData[];
  winnerIndices: number[];
  isTie: boolean;
  everyoneAbstained: boolean;
  abstainCount: number;
  abstainVoters: { socketId: string; name: string }[];
  question: Question;
}

export interface Session {
  code: string;
  config: SessionConfig;
  hostSocketId: string;
  hostReconnectToken: string;
  participants: Map<string, Participant>;
  phase: 'lobby' | 'voting' | 'results';
  firstQuestionStarted: boolean;
  currentQuestion: Question | null;
  votes: Map<string, VoteEntry>;
  results: ResultData | null;
  hostDisconnected: boolean;
  hostDisconnectSecondsLeft: number;
  hostDisconnectTimer: ReturnType<typeof setInterval> | null;
  hostDisconnectedAt: number | null;
}

export interface ClientSessionState {
  code: string;
  config: SessionConfig;
  participants: { socketId: string; name: string; isHost: boolean; superVotesRemaining: number }[];
  phase: 'lobby' | 'voting' | 'results';
  firstQuestionStarted: boolean;
  currentQuestion: { text: string; options: string[] } | null;
  votes: Record<string, { socketId: string; optionIndex: number | 'abstain'; isSuper: boolean }>;
  votedSocketIds: string[];
  eligibleVoterCount: number;
  votedCount: number;
  results: ResultData | null;
  hostDisconnected: boolean;
  hostDisconnectSecondsLeft: number;
}
