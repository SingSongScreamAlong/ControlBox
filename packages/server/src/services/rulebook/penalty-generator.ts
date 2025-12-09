// =====================================================================
// Penalty Generator
// Generates penalty proposals from matched rules
// =====================================================================

import type {
    IncidentEvent,
    Rule,
    Rulebook,
    Penalty
} from '@controlbox/common';
import { PenaltyRepository } from '../../db/repositories/penalty.repo.js';

export class PenaltyGenerator {
    private penaltyRepo: PenaltyRepository;

    constructor() {
        this.penaltyRepo = new PenaltyRepository();
    }

    /**
     * Generate a penalty proposal from a matched rule
     */
    async generatePenalty(
        incident: IncidentEvent,
        rule: Rule,
        _rulebook: Rulebook
    ): Promise<Penalty | null> {
        // Determine the responsible driver
        const responsibleDriver = this.findResponsibleDriver(incident);
        if (!responsibleDriver) {
            console.warn('No responsible driver found for penalty');
            return null;
        }

        // Generate rationale
        const rationale = this.generateRationale(incident, rule);

        // Create penalty
        const penalty = await this.penaltyRepo.create({
            sessionId: incident.sessionId,
            incidentId: incident.id,
            driverId: responsibleDriver.driverId,
            driverName: responsibleDriver.driverName,
            carNumber: responsibleDriver.carNumber,
            type: rule.penalty.type,
            value: rule.penalty.value || this.getDefaultPenaltyValue(rule.penalty.type),
            ruleReference: rule.reference,
            rationale,
            points: rule.penalty.points,
        });

        return penalty;
    }

    private findResponsibleDriver(incident: IncidentEvent) {
        // Find the driver with highest fault probability
        const sorted = [...incident.involvedDrivers]
            .sort((a, b) => (b.faultProbability || 0) - (a.faultProbability || 0));

        // Return driver if they have > 50% fault or are marked as aggressor
        const primary = sorted[0];
        if (primary && (primary.faultProbability && primary.faultProbability > 0.5 || primary.role === 'aggressor')) {
            return primary;
        }

        // Otherwise return the first involved driver
        return sorted[0] || null;
    }

    private generateRationale(incident: IncidentEvent, rule: Rule): string {
        const parts: string[] = [];

        parts.push(`Rule ${rule.reference}: ${rule.title}`);
        parts.push(`Incident Type: ${incident.type}${incident.contactType ? ` (${incident.contactType})` : ''}`);
        parts.push(`Severity: ${incident.severity} (${incident.severityScore}/100)`);

        if (incident.aiAnalysis) {
            parts.push(`AI Recommendation: ${incident.aiAnalysis.recommendation} (${(incident.aiAnalysis.confidence * 100).toFixed(0)}% confidence)`);
        }

        return parts.join('. ') + '.';
    }

    private getDefaultPenaltyValue(type: string): string {
        const defaults: Record<string, string> = {
            warning: 'Official Warning',
            reprimand: 'Official Reprimand',
            time_penalty: '5 seconds',
            position_penalty: '3 positions',
            drive_through: 'Drive Through Penalty',
            stop_go: '10 second Stop & Go',
            disqualification: 'Disqualified from event',
            grid_penalty: '5 grid positions',
            points_deduction: '2 championship points',
            race_ban: '1 race suspension',
            custom: 'Custom penalty',
        };
        return defaults[type] || type;
    }
}
