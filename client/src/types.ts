export interface SessionConfig {
  hostJoinsVote: boolean;
  superVotesPerPerson: number;
  superVoteAmount: number;
  anonymous: boolean;
  allowLateJoins: boolean;
  enableAbstains: boolean;
  allowVoteChanges: boolean;
}

export interface ParticipantInfo {
  socketId: string;
  name: string;
  isHost: boolean;
  superVotesRemaining: number;
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
  question: { text: string; options: string[] };
}

export interface ClientSessionState {
  code: string;
  config: SessionConfig;
  participants: ParticipantInfo[];
  phase: 'lobby' | 'voting' | 'results';
  firstQuestionStarted: boolean;
  currentQuestion: { text: string; options: string[] } | null;
  votes: Record<string, VoteEntry>;
  votedSocketIds: string[];
  eligibleVoterCount: number;
  votedCount: number;
  results: ResultData | null;
  hostDisconnected: boolean;
  hostDisconnectSecondsLeft: number;
}

export type AppScreen = 'home' | 'lobby' | 'voting' | 'results';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}
