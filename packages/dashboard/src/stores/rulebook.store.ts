// =====================================================================
// Rulebook Store
// State management for league rules and configurations
// =====================================================================

import { create } from 'zustand';
import type {
    Rulebook,
    Rule,
    PenaltyMatrix,
    RulebookSettings,
    InterpretationSession,
    InterpretedRule,
    SimulationPreviewResult
} from '@controlbox/common';

// Default penalty matrix for new rulebooks
const DEFAULT_PENALTY_MATRIX: PenaltyMatrix = {
    severity: {
        light: { type: 'warning' as const },
        medium: { type: 'time_penalty' as const, value: '5 seconds' },
        heavy: { type: 'time_penalty' as const, value: '10 seconds' },
    },
    repeat: {
        warningThreshold: 3,
        timeWindowHours: 24,
        escalation: { type: 'drive_through' as const },
    },
};

const DEFAULT_SETTINGS: RulebookSettings = {
    autoPropose: true,
    autoProposeThreshold: 0.8,
    requireApproval: true,
    reviewTimeLimit: 24,
    allowProtests: true,
    protestWindow: 48,
};

// Sample rulebooks for demonstration
const SAMPLE_RULEBOOKS: Rulebook[] = [
    {
        id: 'default-iracing',
        name: 'iRacing Standard Rules',
        leagueName: 'Default',
        version: '1.0',
        rules: [
            {
                id: 'rule-1',
                reference: '3.1.1',
                title: 'Rear-end Contact',
                description: 'Following car is responsible for avoiding contact with the car ahead',
                conditions: [
                    { field: 'incident.contactType', operator: 'eq', value: 'rear_end' },
                ],
                penalty: { type: 'time_penalty', value: '5 seconds' },
                priority: 100,
                isActive: true,
            },
            {
                id: 'rule-2',
                reference: '3.1.2',
                title: 'Divebomb Contact',
                description: 'Late braking overtake attempts resulting in contact',
                conditions: [
                    { field: 'incident.contactType', operator: 'eq', value: 'divebomb' },
                    { field: 'incident.severity', operator: 'in', value: ['medium', 'heavy'] },
                ],
                penalty: { type: 'time_penalty', value: '10 seconds' },
                priority: 90,
                isActive: true,
            },
            {
                id: 'rule-3',
                reference: '3.2.1',
                title: 'Unsafe Rejoin',
                description: 'Rejoining the track in an unsafe manner causing incident',
                conditions: [
                    { field: 'incident.type', operator: 'eq', value: 'unsafe_rejoin' },
                ],
                penalty: { type: 'drive_through' },
                priority: 80,
                isActive: true,
            },
            {
                id: 'rule-4',
                reference: '3.3.1',
                title: 'Blocking',
                description: 'Defensive moves that impede overtaking car',
                conditions: [
                    { field: 'incident.type', operator: 'eq', value: 'blocking' },
                ],
                penalty: { type: 'warning' },
                priority: 70,
                isActive: true,
            },
        ],
        penaltyMatrix: DEFAULT_PENALTY_MATRIX,
        settings: DEFAULT_SETTINGS,
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
    },
    {
        id: 'endurance-rules',
        name: 'Endurance Racing Rules',
        leagueName: 'Endurance League',
        version: '2.1',
        rules: [
            {
                id: 'end-1',
                reference: '4.1.1',
                title: 'Pit Lane Speed',
                description: 'Exceeding pit lane speed limit',
                conditions: [
                    { field: 'incident.type', operator: 'eq', value: 'pit_lane_violation' },
                ],
                penalty: { type: 'stop_go', value: '10 seconds' },
                priority: 100,
                isActive: true,
            },
            {
                id: 'end-2',
                reference: '4.2.1',
                title: 'Heavy Contact - Disqualification',
                description: 'Severe contact causing race-ending damage',
                conditions: [
                    { field: 'incident.type', operator: 'eq', value: 'contact' },
                    { field: 'incident.severity', operator: 'eq', value: 'heavy' },
                    { field: 'incident.severityScore', operator: 'gte', value: 80 },
                ],
                penalty: { type: 'disqualification' },
                priority: 95,
                isActive: true,
            },
        ],
        penaltyMatrix: {
            severity: {
                light: { type: 'warning' as const },
                medium: { type: 'time_penalty' as const, value: '30 seconds' },
                heavy: { type: 'stop_go' as const, value: '30 seconds' },
            },
            repeat: {
                warningThreshold: 2,
                timeWindowHours: 48,
                escalation: { type: 'drive_through' as const },
            },
        },
        settings: { ...DEFAULT_SETTINGS, autoProposeThreshold: 0.9 },
        isActive: true,
        createdAt: new Date('2024-02-15'),
        updatedAt: new Date('2024-03-01'),
    },
];

interface RulebookState {
    rulebooks: Rulebook[];
    selectedRulebook: Rulebook | null;
    isEditing: boolean;

    // Interpretation session state
    currentSession: InterpretationSession | null;
    isInterpreting: boolean;
    simulationResult: SimulationPreviewResult | null;
    isSimulating: boolean;

    // Rulebook actions
    setRulebooks: (rulebooks: Rulebook[]) => void;
    addRulebook: (rulebook: Rulebook) => void;
    updateRulebook: (id: string, updates: Partial<Rulebook>) => void;
    deleteRulebook: (id: string) => void;
    selectRulebook: (rulebook: Rulebook | null) => void;
    setEditing: (editing: boolean) => void;

    // Rule actions
    addRule: (rulebookId: string, rule: Rule) => void;
    updateRule: (rulebookId: string, ruleId: string, updates: Partial<Rule>) => void;
    deleteRule: (rulebookId: string, ruleId: string) => void;
    toggleRule: (rulebookId: string, ruleId: string) => void;
    addRules: (rulebookId: string, rules: Rule[]) => void;

    // Interpretation session actions
    setCurrentSession: (session: InterpretationSession | null) => void;
    setIsInterpreting: (interpreting: boolean) => void;
    updateInterpretedRule: (ruleId: string, updates: Partial<InterpretedRule>) => void;
    setSimulationResult: (result: SimulationPreviewResult | null) => void;
    setIsSimulating: (simulating: boolean) => void;
    clearSession: () => void;
}

export const useRulebookStore = create<RulebookState>((set, get) => ({
    rulebooks: SAMPLE_RULEBOOKS,
    selectedRulebook: null,
    isEditing: false,

    // Interpretation session state
    currentSession: null,
    isInterpreting: false,
    simulationResult: null,
    isSimulating: false,

    setRulebooks: (rulebooks) => set({ rulebooks }),

    addRulebook: (rulebook) => set((state) => ({
        rulebooks: [...state.rulebooks, rulebook],
    })),

    updateRulebook: (id, updates) => set((state) => ({
        rulebooks: state.rulebooks.map((rb) =>
            rb.id === id ? { ...rb, ...updates, updatedAt: new Date() } : rb
        ),
        selectedRulebook: state.selectedRulebook?.id === id
            ? { ...state.selectedRulebook, ...updates, updatedAt: new Date() }
            : state.selectedRulebook,
    })),

    deleteRulebook: (id) => set((state) => ({
        rulebooks: state.rulebooks.filter((rb) => rb.id !== id),
        selectedRulebook: state.selectedRulebook?.id === id ? null : state.selectedRulebook,
    })),

    selectRulebook: (rulebook) => set({ selectedRulebook: rulebook, isEditing: false }),

    setEditing: (editing) => set({ isEditing: editing }),

    addRule: (rulebookId, rule) => set((state) => ({
        rulebooks: state.rulebooks.map((rb) =>
            rb.id === rulebookId
                ? { ...rb, rules: [...rb.rules, rule], updatedAt: new Date() }
                : rb
        ),
    })),

    updateRule: (rulebookId, ruleId, updates) => set((state) => ({
        rulebooks: state.rulebooks.map((rb) =>
            rb.id === rulebookId
                ? {
                    ...rb,
                    rules: rb.rules.map((r) => r.id === ruleId ? { ...r, ...updates } : r),
                    updatedAt: new Date(),
                }
                : rb
        ),
    })),

    deleteRule: (rulebookId, ruleId) => set((state) => ({
        rulebooks: state.rulebooks.map((rb) =>
            rb.id === rulebookId
                ? { ...rb, rules: rb.rules.filter((r) => r.id !== ruleId), updatedAt: new Date() }
                : rb
        ),
    })),

    toggleRule: (rulebookId, ruleId) => {
        const { rulebooks } = get();
        const rulebook = rulebooks.find((rb) => rb.id === rulebookId);
        const rule = rulebook?.rules.find((r) => r.id === ruleId);
        if (rule) {
            get().updateRule(rulebookId, ruleId, { isActive: !rule.isActive });
        }
    },

    addRules: (rulebookId, rules) => set((state) => ({
        rulebooks: state.rulebooks.map((rb) =>
            rb.id === rulebookId
                ? { ...rb, rules: [...rb.rules, ...rules], updatedAt: new Date() }
                : rb
        ),
    })),

    // Interpretation session actions
    setCurrentSession: (session) => set({ currentSession: session }),

    setIsInterpreting: (interpreting) => set({ isInterpreting: interpreting }),

    updateInterpretedRule: (ruleId, updates) => set((state) => {
        if (!state.currentSession) return state;
        return {
            currentSession: {
                ...state.currentSession,
                interpretedRules: state.currentSession.interpretedRules.map((r) =>
                    r.id === ruleId ? { ...r, ...updates } : r
                ),
                stats: {
                    ...state.currentSession.stats,
                    pending: state.currentSession.interpretedRules.filter(
                        (r) => (r.id === ruleId ? updates.status : r.status) === 'pending'
                    ).length,
                    approved: state.currentSession.interpretedRules.filter(
                        (r) => (r.id === ruleId ? updates.status : r.status) === 'approved'
                    ).length,
                    rejected: state.currentSession.interpretedRules.filter(
                        (r) => (r.id === ruleId ? updates.status : r.status) === 'rejected'
                    ).length,
                },
            },
        };
    }),

    setSimulationResult: (result) => set({ simulationResult: result }),

    setIsSimulating: (simulating) => set({ isSimulating: simulating }),

    clearSession: () => set({
        currentSession: null,
        simulationResult: null,
        isInterpreting: false,
        isSimulating: false,
    }),
}));

export { DEFAULT_PENALTY_MATRIX, DEFAULT_SETTINGS };

