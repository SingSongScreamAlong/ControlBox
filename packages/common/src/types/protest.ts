// =====================================================================
// Protests & Appeals Types
// Types for the protest/appeal workflow system
// =====================================================================

// ========================
// Protest Types
// ========================

export type ProtestStatus = 'submitted' | 'under_review' | 'upheld' | 'rejected' | 'withdrawn';

export interface Protest {
    id: string;
    leagueId: string;
    incidentId?: string;
    penaltyId?: string;

    // Submitter
    submittedByDriverId: string;
    submittedByName: string;
    submittedByEmail?: string;

    // Details
    status: ProtestStatus;
    grounds: string;
    evidenceUrls: string[];

    // Resolution
    stewardNotes?: string;
    resolution?: string;
    resolvedBy?: string;
    resolvedAt?: string;

    createdAt: string;
    updatedAt: string;
}

export interface CreateProtestRequest {
    leagueId: string;
    incidentId?: string;
    penaltyId?: string;
    driverId: string;
    driverName: string;
    driverEmail?: string;
    grounds: string;
    evidenceUrls?: string[];
}

export interface ResolveProtestRequest {
    status: 'upheld' | 'rejected';
    stewardNotes?: string;
    resolution: string;
}

// ========================
// Appeal Types
// ========================

export type AppealStatus = 'submitted' | 'under_review' | 'granted' | 'denied' | 'withdrawn';

export interface Appeal {
    id: string;
    leagueId: string;
    protestId?: string;
    originalPenaltyId?: string;

    // Submitter
    submittedBy: string;
    submittedByName?: string;

    // Details
    status: AppealStatus;
    grounds: string;
    newEvidence: string[];

    // Resolution
    panelNotes?: string;
    finalRuling?: string;
    newPenaltyId?: string;
    resolvedBy?: string;
    resolvedAt?: string;

    createdAt: string;
    updatedAt: string;
}

export interface CreateAppealRequest {
    leagueId: string;
    protestId?: string;
    originalPenaltyId?: string;
    submittedBy: string;
    submittedByName?: string;
    grounds: string;
    newEvidence?: string[];
}

export interface ResolveAppealRequest {
    status: 'granted' | 'denied';
    panelNotes?: string;
    finalRuling: string;
    newPenaltyId?: string;
}
