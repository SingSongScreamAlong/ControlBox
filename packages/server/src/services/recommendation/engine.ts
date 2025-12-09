// =====================================================================
// Recommendation Engine
// Generates race control recommendations based on incidents and profiles
// =====================================================================

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type {
    DisciplineProfile,
    DisciplineCategory,
    IncidentEvent,
    Recommendation,
    RecommendationType,
    RecommendationContext,
    RecommendationResult,
    SeverityLevel
} from '@controlbox/common';

export interface RecommendationEngineEvents {
    'recommendation:generated': (recommendation: Recommendation) => void;
    'recommendation:batch': (recommendations: Recommendation[]) => void;
}

export class RecommendationEngine extends EventEmitter {
    constructor() {
        super();
    }

    /**
     * Evaluate an incident and generate recommendations
     */
    async evaluateIncident(
        incident: IncidentEvent,
        profile: DisciplineProfile,
        context: RecommendationContext
    ): Promise<RecommendationResult> {
        const startTime = Date.now();
        const recommendations: Recommendation[] = [];

        // 1. Evaluate caution needs
        const cautionRec = this.evaluateCautionNeeded(incident, profile, context);
        if (cautionRec) {
            recommendations.push(cautionRec);
        }

        // 2. Evaluate penalty needs
        const penaltyRec = this.evaluatePenaltyNeeded(incident, profile);
        if (penaltyRec) {
            recommendations.push(penaltyRec);
        }

        // 3. Check if review is needed (low confidence or complex situation)
        const reviewRec = this.evaluateReviewNeeded(incident, profile, recommendations);
        if (reviewRec) {
            recommendations.push(reviewRec);
        }

        // Emit recommendations
        for (const rec of recommendations) {
            this.emit('recommendation:generated', rec);
        }

        if (recommendations.length > 0) {
            this.emit('recommendation:batch', recommendations);
        }

        const evaluationTimeMs = Date.now() - startTime;

        return {
            recommendations,
            reasoning: this.buildReasoning(incident, profile, recommendations),
            evaluationTimeMs
        };
    }

    /**
     * Evaluate if a caution/yellow flag is needed
     */
    private evaluateCautionNeeded(
        incident: IncidentEvent,
        profile: DisciplineProfile,
        context: RecommendationContext
    ): Recommendation | null {
        const { cautionRules } = profile;

        // Skip if already under caution
        if (context.flagState === 'yellow' || context.flagState === 'caution') {
            return null;
        }

        // Determine if severity meets threshold
        const severityMeetsThreshold = this.severityMeetsThreshold(
            incident.severity,
            cautionRules.triggerThreshold
        );

        if (!severityMeetsThreshold) {
            return null;
        }

        // Check for track blockage
        const isBlockage = this.isTrackBlockage(incident, context);

        // Determine caution type based on profile configuration
        let cautionType: RecommendationType;
        let details: string;
        let confidence: number;
        let priority: number;

        if (cautionRules.slowZonesEnabled && profile.category === 'endurance') {
            // Endurance: prefer slow zones
            cautionType = 'slowZone';
            details = `Slow zone recommended for ${incident.type} incident at ${incident.cornerName ?? 'track position ' + (incident.trackPosition * 100).toFixed(0) + '%'}`;
            confidence = 0.8;
            priority = 7;
        } else if (cautionRules.fullCourseEnabled && (isBlockage || incident.severity === 'heavy')) {
            // Oval/Stock: full course yellow for blockages or heavy incidents
            cautionType = 'globalYellow';
            details = `Full course caution recommended: ${isBlockage ? 'Track blockage' : 'Heavy incident'} at lap ${incident.lapNumber}`;
            confidence = isBlockage ? 0.95 : 0.85;
            priority = 9;
        } else if (cautionRules.localYellowEnabled) {
            // Road: local yellow
            cautionType = 'localYellow';
            details = `Local yellow recommended at ${incident.cornerName ?? 'track position ' + (incident.trackPosition * 100).toFixed(0) + '%'}`;
            confidence = 0.75;
            priority = 6;
        } else {
            // No caution type available
            return null;
        }

        return this.createRecommendation(
            incident.sessionId,
            cautionType,
            profile.category,
            details,
            confidence,
            priority,
            incident.id
        );
    }

    /**
     * Evaluate if a penalty is recommended
     */
    private evaluatePenaltyNeeded(
        incident: IncidentEvent,
        profile: DisciplineProfile
    ): Recommendation | null {
        const { penaltyModel } = profile;

        // Racing incidents with low confidence fault = no penalty by default
        if (incident.type === 'contact' && incident.contactType === 'racing_incident') {
            if (penaltyModel.racingIncidentDefault === 'no_action') {
                return null;
            }
        }

        // Check fault attribution
        const maxFault = this.getMaxFaultProbability(incident);

        // Apply strictness and tolerance from profile
        const adjustedFault = maxFault * penaltyModel.strictness * (1 - penaltyModel.contactTolerance);

        // Determine penalty confidence
        if (adjustedFault < 0.3) {
            return null; // Insufficient fault
        }

        const faultDriver = this.getMostLikelyAtFaultDriver(incident);
        if (!faultDriver) {
            return null;
        }

        // Determine suggested penalty based on severity
        const penaltyType = this.suggestPenaltyType(incident.severity, penaltyModel);
        const penaltyValue = this.suggestPenaltyValue(incident.severity, penaltyModel);

        const details = `Penalty suggested for ${faultDriver.driverName} (${faultDriver.carNumber}): ${penaltyValue} - ${incident.type}`;
        const confidence = Math.min(adjustedFault, 0.9);
        const priority = incident.severity === 'heavy' ? 8 : incident.severity === 'medium' ? 5 : 3;

        const recommendation = this.createRecommendation(
            incident.sessionId,
            'penalty',
            profile.category,
            details,
            confidence,
            priority,
            incident.id
        );

        // Add penalty payload
        (recommendation as any).payload = {
            driverId: faultDriver.driverId,
            driverName: faultDriver.driverName,
            penaltyType,
            penaltyValue,
            points: incident.severity === 'heavy' ? 3 : incident.severity === 'medium' ? 2 : 1
        };

        return recommendation;
    }

    /**
     * Evaluate if steward review is recommended
     */
    private evaluateReviewNeeded(
        incident: IncidentEvent,
        profile: DisciplineProfile,
        existingRecommendations: Recommendation[]
    ): Recommendation | null {
        // Low confidence on existing recommendations = needs review
        const hasLowConfidence = existingRecommendations.some(r => r.confidence < 0.5);

        // Complex multi-car incidents
        const isMultiCar = incident.involvedDrivers.length > 2;

        // Fault is unclear
        const faultUnclear = this.getFaultClarity(incident) < 0.5;

        if (!hasLowConfidence && !isMultiCar && !faultUnclear) {
            return null;
        }

        const reasons: string[] = [];
        if (hasLowConfidence) reasons.push('low confidence');
        if (isMultiCar) reasons.push('multi-car incident');
        if (faultUnclear) reasons.push('unclear fault');

        return this.createRecommendation(
            incident.sessionId,
            'reviewIncident',
            profile.category,
            `Steward review recommended: ${reasons.join(', ')}`,
            0.6,
            4,
            incident.id
        );
    }

    /**
     * Create a recommendation object
     */
    private createRecommendation(
        sessionId: string,
        type: RecommendationType,
        disciplineContext: DisciplineCategory,
        details: string,
        confidence: number,
        priority: number,
        incidentId?: string
    ): Recommendation {
        return {
            id: uuidv4(),
            sessionId,
            incidentId,
            type,
            disciplineContext,
            details,
            confidence,
            status: 'pending',
            priority,
            timestamp: Date.now(),
            createdAt: new Date()
        };
    }

    /**
     * Check if severity meets threshold
     */
    private severityMeetsThreshold(
        severity: SeverityLevel,
        threshold: SeverityLevel
    ): boolean {
        const levels = { light: 1, medium: 2, heavy: 3 };
        return levels[severity] >= levels[threshold];
    }

    /**
     * Determine if incident causes track blockage
     */
    private isTrackBlockage(
        incident: IncidentEvent,
        context: RecommendationContext
    ): boolean {
        // Heavy incidents with multiple cars often cause blockage
        if (incident.severity === 'heavy' && incident.involvedDrivers.length >= 2) {
            return true;
        }
        // Spin with no clearance
        if (incident.type === 'spin' || incident.type === 'loss_of_control') {
            return context.trackBlockage;
        }
        return false;
    }

    /**
     * Get maximum fault probability from involved drivers
     */
    private getMaxFaultProbability(incident: IncidentEvent): number {
        let maxFault = 0;
        for (const driver of incident.involvedDrivers) {
            if (driver.faultProbability && driver.faultProbability > maxFault) {
                maxFault = driver.faultProbability;
            }
        }
        return maxFault;
    }

    /**
     * Get the most likely at-fault driver
     */
    private getMostLikelyAtFaultDriver(incident: IncidentEvent) {
        let mostLikely = null;
        let maxFault = 0;

        for (const driver of incident.involvedDrivers) {
            if (driver.role === 'aggressor' || (driver.faultProbability && driver.faultProbability > maxFault)) {
                mostLikely = driver;
                maxFault = driver.faultProbability ?? 0.5;
            }
        }

        return mostLikely;
    }

    /**
     * Determine fault clarity (how clear is who's at fault)
     */
    private getFaultClarity(incident: IncidentEvent): number {
        const faults = incident.involvedDrivers
            .map(d => d.faultProbability ?? 0.5)
            .sort((a, b) => b - a);

        if (faults.length < 2) return 1;

        // Clear fault = big difference between top two
        return Math.abs(faults[0] - faults[1]);
    }

    /**
     * Suggest penalty type based on severity
     */
    private suggestPenaltyType(severity: SeverityLevel, _penaltyModel: DisciplineProfile['penaltyModel']): string {
        if (severity === 'heavy') {
            return 'drive_through';
        } else if (severity === 'medium') {
            return 'time_penalty';
        } else {
            return 'warning';
        }
    }

    /**
     * Suggest penalty value based on severity
     */
    private suggestPenaltyValue(severity: SeverityLevel, penaltyModel: DisciplineProfile['penaltyModel']): string {
        const timeOptions = penaltyModel.timePenaltyOptions;

        if (severity === 'heavy') {
            return 'Drive Through';
        } else if (severity === 'medium' && timeOptions.length > 0) {
            return `${timeOptions[Math.floor(timeOptions.length / 2)]} seconds`;
        } else {
            return 'Warning';
        }
    }

    /**
     * Build reasoning explanation
     */
    private buildReasoning(
        incident: IncidentEvent,
        profile: DisciplineProfile,
        recommendations: Recommendation[]
    ): string {
        const parts: string[] = [];

        parts.push(`Evaluated ${incident.type} incident using ${profile.name} profile.`);

        if (recommendations.length === 0) {
            parts.push('No action recommended based on profile thresholds.');
        } else {
            parts.push(`Generated ${recommendations.length} recommendation(s):`);
            for (const rec of recommendations) {
                parts.push(`- ${rec.type}: ${rec.details} (confidence: ${(rec.confidence * 100).toFixed(0)}%)`);
            }
        }

        return parts.join(' ');
    }
}

// Singleton instance
let engineInstance: RecommendationEngine | null = null;

export function getRecommendationEngine(): RecommendationEngine {
    if (!engineInstance) {
        engineInstance = new RecommendationEngine();
    }
    return engineInstance;
}
