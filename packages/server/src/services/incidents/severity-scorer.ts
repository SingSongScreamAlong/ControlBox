// =====================================================================
// Severity Scorer
// Calculates severity level and score for incidents
// =====================================================================

import type {
    IncidentTrigger,
    SeverityLevel,
    ContactType
} from '@controlbox/common';

export interface SeverityResult {
    severity: SeverityLevel;
    score: number;
    factors: SeverityFactor[];
}

export interface SeverityFactor {
    name: string;
    value: number;
    weight: number;
    contribution: number;
}

// Severity thresholds
const LIGHT_MAX = 33;
const MEDIUM_MAX = 66;

// Base severity for contact types
const CONTACT_TYPE_BASE: Record<ContactType, number> = {
    'rear_end': 45,
    'side_to_side': 20,
    'divebomb': 55,
    't_bone': 65,
    'squeeze': 30,
    'punt': 70,
    'brake_check': 75,
    'netcode_likely': 10,
    'racing_incident': 25,
    'no_contact': 5,
};

export class SeverityScorer {
    /**
     * Calculate severity level and score
     */
    calculateSeverity(
        trigger: IncidentTrigger,
        contactType?: ContactType
    ): SeverityResult {
        const factors: SeverityFactor[] = [];

        // Base score from contact type or trigger type
        let baseScore = contactType ? CONTACT_TYPE_BASE[contactType] : 30;
        factors.push({
            name: 'base_score',
            value: baseScore,
            weight: 1.0,
            contribution: baseScore,
        });

        // Speed factor
        const speed = (trigger.triggerData.speed as number) || 0;
        const speedFactor = this.calculateSpeedFactor(speed);
        factors.push(speedFactor);

        // Speed loss factor
        const speedLoss = (trigger.triggerData.speedLoss as number) || 0;
        const speedLossFactor = this.calculateSpeedLossFactor(speedLoss);
        factors.push(speedLossFactor);

        // Multiple drivers factor
        const driverCount = trigger.nearbyDriverIds.length + 1;
        const multiDriverFactor = this.calculateMultiDriverFactor(driverCount);
        factors.push(multiDriverFactor);

        // Calculate total score
        const totalContribution = factors.reduce((sum, f) => sum + f.contribution, 0);
        const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
        const score = Math.min(100, Math.max(0, totalContribution / totalWeight * 2));

        // Determine severity level
        const severity = this.scoreToLevel(score);

        return { severity, score: Math.round(score), factors };
    }

    private calculateSpeedFactor(speed: number): SeverityFactor {
        // Higher speeds = more severe
        // 0-50 m/s -> 0-15 contribution
        const normalized = Math.min(speed / 50, 1.0);
        const contribution = normalized * 15;

        return {
            name: 'speed',
            value: speed,
            weight: 0.3,
            contribution,
        };
    }

    private calculateSpeedLossFactor(speedLoss: number): SeverityFactor {
        // More speed loss = more severe impact
        // 0-100% -> 0-25 contribution
        const contribution = speedLoss * 25;

        return {
            name: 'speed_loss',
            value: speedLoss,
            weight: 0.4,
            contribution,
        };
    }

    private calculateMultiDriverFactor(driverCount: number): SeverityFactor {
        // More drivers = more complex situation
        // 2 drivers = +5, 3+ drivers = +10
        const contribution = driverCount === 2 ? 5 : driverCount > 2 ? 10 : 0;

        return {
            name: 'driver_count',
            value: driverCount,
            weight: 0.2,
            contribution,
        };
    }

    private scoreToLevel(score: number): SeverityLevel {
        if (score <= LIGHT_MAX) return 'light';
        if (score <= MEDIUM_MAX) return 'medium';
        return 'heavy';
    }
}
