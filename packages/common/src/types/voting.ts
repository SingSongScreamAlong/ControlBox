// =====================================================================
// Steward Voting Types
// Types for multi-steward panel voting system
// =====================================================================

export type PanelStatus = 'voting' | 'closed' | 'expired';
export type DecisionMethod = 'majority' | 'unanimous' | 'chair_decides';
export type VoteDecision = 'penalty' | 'warning' | 'reprimand' | 'no_action' | 'dismiss' | 'uphold' | 'reject';

// ========================
// Steward Panel
// ========================

export interface StewardPanel {
    id: string;
    leagueId: string;
    incidentId?: string;
    protestId?: string;
    appealId?: string;

    // Configuration
    requiredVotes: number;
    decisionMethod: DecisionMethod;
    status: PanelStatus;

    // Outcome
    finalDecision?: string;
    decisionRationale?: string;

    // Timing
    votingDeadline?: string;
    createdAt: string;
    closedAt?: string;

    // Populated
    votes?: StewardVote[];
    votedCount?: number;
}

export interface CreatePanelRequest {
    leagueId: string;
    incidentId?: string;
    protestId?: string;
    appealId?: string;
    requiredVotes?: number;
    decisionMethod?: DecisionMethod;
    votingDeadline?: string;
}

// ========================
// Steward Vote
// ========================

export interface StewardVote {
    id: string;
    panelId: string;
    stewardId: string;

    vote: VoteDecision;
    reasoning?: string;
    isDissent: boolean;

    votedAt: string;

    // Populated
    stewardName?: string;
    stewardEmail?: string;
}

export interface CastVoteRequest {
    vote: VoteDecision;
    reasoning?: string;
}

export interface ClosePanelRequest {
    finalDecision: string;
    decisionRationale?: string;
}

// ========================
// Voting Summary
// ========================

export interface VotingSummary {
    panelId: string;
    totalVotes: number;
    requiredVotes: number;
    voteCounts: Record<VoteDecision, number>;
    hasQuorum: boolean;
    leadingDecision?: VoteDecision;
    isUnanimous: boolean;
    dissents: StewardVote[];
}
