// =====================================================================
// Responsibility Predictor
// Predicts fault attribution for incidents involving multiple drivers
// =====================================================================

import type {
    IncidentTrigger,
    InvolvedDriver,
    DriverRole
} from '@controlbox/common';

export interface ResponsibilityPrediction {
    driverId: string;
    probability: number;
    role: DriverRole;
    reasoning: string[];
}

export class ResponsibilityPredictor {
    /**
     * Predict responsibility distribution among involved drivers
     */
    predict(
        trigger: IncidentTrigger,
        drivers: InvolvedDriver[]
    ): ResponsibilityPrediction[] {
        if (drivers.length === 0) return [];
        if (drivers.length === 1) {
            return [{
                driverId: drivers[0].driverId,
                probability: 1.0,
                role: 'involved',
                reasoning: ['Single driver incident'],
            }];
        }

        const predictions: ResponsibilityPrediction[] = [];
        const factors = this.analyzeFactors(trigger);

        for (const driver of drivers) {
            const isPrimary = driver.driverId === trigger.primaryDriverId;
            const prediction = this.predictForDriver(driver, isPrimary, factors, trigger);
            predictions.push(prediction);
        }

        // Normalize probabilities
        this.normalizeProbabilities(predictions);

        // Assign roles based on probabilities
        this.assignRoles(predictions);

        return predictions;
    }

    private analyzeFactors(trigger: IncidentTrigger): AnalysisFactors {
        return {
            speedDifferential: (trigger.triggerData.speedDifferential as number) || 0,
            speedLoss: (trigger.triggerData.speedLoss as number) || 0,
            yawDelta: (trigger.triggerData.yawDelta as number) || 0,
            triggerType: trigger.type,
        };
    }

    private predictForDriver(
        driver: InvolvedDriver,
        isPrimary: boolean,
        factors: AnalysisFactors,
        trigger: IncidentTrigger
    ): ResponsibilityPrediction {
        const reasoning: string[] = [];
        let probability = 0.5; // Start neutral

        // Primary driver in certain triggers more likely at fault
        if (isPrimary) {
            switch (trigger.type) {
                case 'sudden_deceleration':
                    // The following car (primary if they hit) is likely at fault
                    probability += 0.2;
                    reasoning.push('Sudden deceleration suggests rear-end contact');
                    break;
                case 'off_track_detected':
                    probability += 0.1;
                    reasoning.push('Driver went off track');
                    break;
                case 'spin_detected':
                    // Could be victim of contact
                    probability -= 0.1;
                    reasoning.push('Spin may indicate being hit');
                    break;
            }
        } else {
            // Non-primary driver was nearby when incident happened
            reasoning.push('Was in proximity to incident');
        }

        // Speed differential analysis
        if (factors.speedDifferential > 10) {
            if (isPrimary) {
                probability += 0.15;
                reasoning.push('Higher closing speed on approach');
            }
        }

        // Large speed loss for non-primary suggests they were victim
        if (!isPrimary && factors.speedLoss > 0.3) {
            probability -= 0.2;
            reasoning.push('Significant speed loss suggests being hit');
        }

        // Clamp probability
        probability = Math.max(0, Math.min(1, probability));

        return {
            driverId: driver.driverId,
            probability,
            role: 'unknown',
            reasoning,
        };
    }

    private normalizeProbabilities(predictions: ResponsibilityPrediction[]): void {
        const total = predictions.reduce((sum, p) => sum + p.probability, 0);
        if (total > 0) {
            for (const pred of predictions) {
                pred.probability = pred.probability / total;
            }
        }
    }

    private assignRoles(predictions: ResponsibilityPrediction[]): void {
        // Sort by probability descending
        const sorted = [...predictions].sort((a, b) => b.probability - a.probability);

        if (sorted.length >= 2) {
            const diff = sorted[0].probability - sorted[1].probability;

            if (diff > 0.25) {
                // Clear distinction
                sorted[0].role = 'aggressor';
                sorted[1].role = 'victim';
                sorted[0].reasoning.push('Assigned as primary responsible party');
                sorted[1].reasoning.push('Assigned as affected party');
            } else if (diff < 0.1) {
                // Racing incident - no clear fault
                for (const pred of sorted) {
                    pred.role = 'involved';
                    pred.reasoning.push('No clear fault - racing incident');
                }
            } else {
                // Mild distinction
                sorted[0].role = 'aggressor';
                sorted[1].role = 'involved';
            }

            // Mark remaining as involved
            for (let i = 2; i < sorted.length; i++) {
                sorted[i].role = 'involved';
            }
        }
    }
}

interface AnalysisFactors {
    speedDifferential: number;
    speedLoss: number;
    yawDelta: number;
    triggerType: string;
}
