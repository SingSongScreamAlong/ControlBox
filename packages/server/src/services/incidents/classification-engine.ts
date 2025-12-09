// =====================================================================
// Classification Engine
// Orchestrates incident classification from triggers to full incidents
// =====================================================================

import { EventEmitter } from 'events';
import type {
    IncidentEvent,
    IncidentTrigger,
    InvolvedDriver,
    ContactType,
    IncidentType
} from '@controlbox/common';
import { ContactAnalyzer } from './contact-analyzer.js';
import { SeverityScorer } from './severity-scorer.js';
import { ResponsibilityPredictor } from './responsibility-predictor.js';
import { IncidentRepository } from '../../db/repositories/incident.repo.js';
import { v4 as uuid } from 'uuid';

export interface ClassificationEngineEvents {
    'incident:classified': (incident: IncidentEvent) => void;
}

export class ClassificationEngine extends EventEmitter {
    private contactAnalyzer: ContactAnalyzer;
    private severityScorer: SeverityScorer;
    private responsibilityPredictor: ResponsibilityPredictor;
    private incidentRepo: IncidentRepository;

    constructor() {
        super();
        this.contactAnalyzer = new ContactAnalyzer();
        this.severityScorer = new SeverityScorer();
        this.responsibilityPredictor = new ResponsibilityPredictor();
        this.incidentRepo = new IncidentRepository();
    }

    /**
     * Process an incident trigger and classify it
     */
    async processTrigger(trigger: IncidentTrigger, sessionId: string): Promise<IncidentEvent | null> {
        try {
            // Determine incident type from trigger
            const incidentType = this.mapTriggerToIncidentType(trigger);

            // Analyze contact if applicable
            let contactType: ContactType | undefined;
            if (incidentType === 'contact' && trigger.nearbyDriverIds.length > 0) {
                contactType = this.contactAnalyzer.analyzeContact(trigger);
            }

            // Calculate severity
            const { severity, score } = this.severityScorer.calculateSeverity(trigger, contactType);

            // Build involved drivers list
            const involvedDrivers: InvolvedDriver[] = [
                {
                    driverId: trigger.primaryDriverId,
                    driverName: `Driver ${trigger.primaryDriverId}`,
                    carNumber: '0',
                    role: 'involved',
                },
                ...trigger.nearbyDriverIds.map(id => ({
                    driverId: id,
                    driverName: `Driver ${id}`,
                    carNumber: '0',
                    role: 'involved' as const,
                })),
            ];

            // Predict responsibility if multiple drivers involved
            if (involvedDrivers.length > 1) {
                const predictions = this.responsibilityPredictor.predict(trigger, involvedDrivers);
                for (const driver of involvedDrivers) {
                    const pred = predictions.find(p => p.driverId === driver.driverId);
                    if (pred) {
                        driver.faultProbability = pred.probability;
                        driver.role = pred.role;
                    }
                }
            }

            // Create incident
            const incident: IncidentEvent = {
                id: uuid(),
                sessionId,
                type: incidentType,
                contactType,
                severity,
                severityScore: score,
                lapNumber: (trigger.triggerData.lapNumber as number) || 0,
                sessionTimeMs: trigger.sessionTimeMs,
                trackPosition: (trigger.triggerData.trackPosition as number) || 0,
                involvedDrivers,
                status: 'pending',
                replayTimestampMs: trigger.sessionTimeMs,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Persist to database
            const saved = await this.incidentRepo.create(incident);

            console.log(`⚠️  Incident classified: ${incidentType} (${severity}) - ${involvedDrivers.length} drivers`);
            this.emit('incident:classified', saved);

            return saved;
        } catch (error) {
            console.error('Failed to classify incident:', error);
            return null;
        }
    }

    private mapTriggerToIncidentType(trigger: IncidentTrigger): IncidentType {
        switch (trigger.type) {
            case 'incident_count_increase':
                return trigger.nearbyDriverIds.length > 0 ? 'contact' : 'off_track';
            case 'off_track_detected':
                return 'off_track';
            case 'spin_detected':
                return 'spin';
            case 'sudden_deceleration':
                return trigger.nearbyDriverIds.length > 0 ? 'contact' : 'loss_of_control';
            case 'contact_proximity':
                return 'contact';
            case 'erratic_trajectory':
                return 'loss_of_control';
            default:
                return 'contact';
        }
    }
}

// Singleton instance
let engineInstance: ClassificationEngine | null = null;

export function getClassificationEngine(): ClassificationEngine {
    if (!engineInstance) {
        engineInstance = new ClassificationEngine();
    }
    return engineInstance;
}
