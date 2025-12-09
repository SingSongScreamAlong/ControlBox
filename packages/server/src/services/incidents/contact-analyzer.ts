// =====================================================================
// Contact Analyzer
// Analyzes contact incidents to determine type and characteristics
// =====================================================================

import type {
    IncidentTrigger,
    ContactType,
    ContactDetection,
    ContactEvidence
} from '@controlbox/common';

export class ContactAnalyzer {
    /**
     * Analyze a trigger to determine contact type
     */
    analyzeContact(trigger: IncidentTrigger): ContactType {
        const detection = this.detectContact(trigger);
        return detection.contactType;
    }

    /**
     * Full contact detection with evidence
     */
    detectContact(trigger: IncidentTrigger): ContactDetection {
        const data = trigger.triggerData;

        // Extract available data
        const speedDiff = (data.speedDifferential as number) || 0;
        const yawDelta = (data.yawDelta as number) || 0;
        const speedLoss = (data.speedLoss as number) || 0;

        // Determine contact type based on available signals
        const contactType = this.classifyContactType(trigger, speedDiff, yawDelta, speedLoss);

        // Check for netcode indicators
        const isNetcodeLikely = this.checkNetcode(trigger, speedDiff);

        // Calculate confidence
        const confidence = this.calculateConfidence(trigger);

        const evidence: ContactEvidence = {
            speedDifferential: speedDiff,
            overlapPercentage: 0.5, // Would need telemetry analysis
            timeToContact: 0,
            avoidabilityScore: 0.5,
            relativePosition: 'alongside',
            racingLineDeviation: 0,
        };

        return {
            hasContact: true,
            contactType: isNetcodeLikely ? 'netcode_likely' : contactType,
            confidence,
            closingSpeed: Math.abs(speedDiff),
            contactAngle: yawDelta * (180 / Math.PI),
            isNetcodeLikely,
            evidence,
        };
    }

    private classifyContactType(
        trigger: IncidentTrigger,
        speedDiff: number,
        yawDelta: number,
        speedLoss: number
    ): ContactType {
        // Rear-end: Following car hits car ahead
        if (speedLoss > 0.3 && trigger.nearbyDriverIds.length === 1) {
            return 'rear_end';
        }

        // Side-to-side: Minor contact during passing
        if (speedLoss < 0.2 && yawDelta < 0.5) {
            return 'side_to_side';
        }

        // Divebomb: Late braking into corner with contact
        if (speedDiff > 15 && speedLoss > 0.4) {
            return 'divebomb';
        }

        // T-bone: Significant yaw change suggesting side impact
        if (yawDelta > 1.0) {
            return 't_bone';
        }

        // Squeeze: Gradual pressure pushing car off
        if (speedLoss < 0.15 && trigger.nearbyDriverIds.length === 1) {
            return 'squeeze';
        }

        // Punt: High speed rear contact causing spin
        if (speedLoss > 0.5 && yawDelta > 0.8) {
            return 'punt';
        }

        // Default to racing incident if unclear
        return 'racing_incident';
    }

    private checkNetcode(trigger: IncidentTrigger, speedDiff: number): boolean {
        // Netcode indicators:
        // - Very small speed differential but incident registered
        // - No significant position changes
        // - Multiple cars at same location (teleport artifact)

        const incidentDelta = (trigger.triggerData.delta as number) || 0;

        // Single incident point with minimal speed delta suggests netcode
        if (incidentDelta === 1 && Math.abs(speedDiff) < 5) {
            return true;
        }

        return false;
    }

    private calculateConfidence(trigger: IncidentTrigger): number {
        // Higher confidence with more data points
        let confidence = 0.5;

        if (trigger.nearbyDriverIds.length > 0) confidence += 0.2;
        if (trigger.triggerData.speedDifferential !== undefined) confidence += 0.1;
        if (trigger.triggerData.yawDelta !== undefined) confidence += 0.1;
        if (trigger.triggerData.previousSpeed !== undefined) confidence += 0.1;

        return Math.min(confidence, 1.0);
    }
}
