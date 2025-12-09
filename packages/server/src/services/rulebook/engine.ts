// =====================================================================
// Rulebook Engine
// Applies league rules to incidents and generates penalty proposals
// =====================================================================

import { EventEmitter } from 'events';
import type {
    IncidentEvent,
    Rulebook,
    Rule,
    Penalty
} from '@controlbox/common';
import { RulebookParser } from './parser.js';
import { ConditionEvaluator } from './condition-evaluator.js';
import { PenaltyGenerator } from './penalty-generator.js';
import { RulebookRepository } from '../../db/repositories/rulebook.repo.js';

export interface RulebookEngineEvents {
    'penalty:proposed': (penalty: Penalty) => void;
}

export class RulebookEngine extends EventEmitter {
    private parser: RulebookParser;
    private evaluator: ConditionEvaluator;
    private generator: PenaltyGenerator;
    private rulebookRepo: RulebookRepository;
    private activeRulebook: Rulebook | null = null;

    constructor() {
        super();
        this.parser = new RulebookParser();
        this.evaluator = new ConditionEvaluator();
        this.generator = new PenaltyGenerator();
        this.rulebookRepo = new RulebookRepository();
    }

    /**
     * Load and activate a rulebook
     */
    async loadRulebook(rulebookId: string): Promise<Rulebook | null> {
        const rulebook = await this.rulebookRepo.findById(rulebookId);
        if (rulebook) {
            const validation = this.parser.validate(rulebook);
            if (!validation.isValid) {
                console.error('Rulebook validation failed:', validation.errors);
                return null;
            }
            this.activeRulebook = rulebook;
            console.log(`📖 Rulebook loaded: ${rulebook.name} v${rulebook.version}`);
        }
        return rulebook;
    }

    /**
     * Load the default active rulebook
     */
    async loadActiveRulebook(): Promise<Rulebook | null> {
        const rulebook = await this.rulebookRepo.findActive();
        if (rulebook) {
            this.activeRulebook = rulebook;
            console.log(`📖 Active rulebook loaded: ${rulebook.name}`);
        }
        return rulebook;
    }

    /**
     * Process an incident against the active rulebook
     */
    async processIncident(incident: IncidentEvent): Promise<Penalty[]> {
        if (!this.activeRulebook) {
            console.warn('No active rulebook loaded');
            return [];
        }

        const penalties: Penalty[] = [];

        // Find matching rules
        const matchedRules = this.findMatchingRules(incident);

        if (matchedRules.length === 0) {
            console.log(`   No rules matched for incident ${incident.id}`);
            return [];
        }

        // Generate penalties for matched rules
        for (const rule of matchedRules) {
            const penalty = await this.generator.generatePenalty(
                incident,
                rule,
                this.activeRulebook
            );

            if (penalty) {
                penalties.push(penalty);
                this.emit('penalty:proposed', penalty);
                console.log(`🚩 Penalty proposed: ${penalty.type} for ${rule.reference}`);
            }
        }

        return penalties;
    }

    private findMatchingRules(incident: IncidentEvent): Rule[] {
        if (!this.activeRulebook) return [];

        return this.activeRulebook.rules
            .filter(rule => rule.isActive)
            .filter(rule => this.evaluator.evaluate(rule.conditions, incident))
            .sort((a, b) => b.priority - a.priority);
    }

    /**
     * Get the currently loaded rulebook
     */
    getActiveRulebook(): Rulebook | null {
        return this.activeRulebook;
    }
}

// Singleton instance
let engineInstance: RulebookEngine | null = null;

export function getRulebookEngine(): RulebookEngine {
    if (!engineInstance) {
        engineInstance = new RulebookEngine();
    }
    return engineInstance;
}
