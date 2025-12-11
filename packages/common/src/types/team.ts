// =====================================================================
// Team Types
// Types for team management system
// =====================================================================

export interface Team {
    id: string;
    leagueId: string;

    name: string;
    shortName?: string;
    color?: string;
    logoUrl?: string;

    isActive: boolean;
    createdAt: string;
    updatedAt: string;

    // Populated
    driverCount?: number;
    totalPoints?: number;
}

export interface CreateTeamRequest {
    leagueId: string;
    name: string;
    shortName?: string;
    color?: string;
    logoUrl?: string;
}

export interface UpdateTeamRequest {
    name?: string;
    shortName?: string;
    color?: string;
    logoUrl?: string;
    isActive?: boolean;
}

export interface TeamChampionshipStanding {
    teamId: string;
    teamName: string;
    teamColor?: string;

    position: number;
    points: number;
    wins: number;
    podiums: number;

    // Drivers
    drivers: {
        driverId: string;
        driverName: string;
        points: number;
    }[];
}
