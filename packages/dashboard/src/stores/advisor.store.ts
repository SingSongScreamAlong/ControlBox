// =====================================================================
// Advisor Store
// State management for steward advisor recommendations
// =====================================================================

import { create } from 'zustand';
import type { StewardAdvice } from '@controlbox/common';

interface AdvisorState {
    // Advice indexed by incident ID
    adviceByIncidentId: Record<string, StewardAdvice[]>;

    // Loading states by incident ID
    loadingByIncidentId: Record<string, boolean>;

    // Error states by incident ID
    errorByIncidentId: Record<string, string | null>;
}

interface AdvisorActions {
    // Fetch advice for an incident
    fetchAdvice: (incidentId: string, rules?: unknown[], context?: Record<string, unknown>) => Promise<void>;

    // Clear advice for an incident
    clearAdvice: (incidentId: string) => void;

    // Clear all advice
    clearAllAdvice: () => void;

    // Get advice for an incident
    getAdvice: (incidentId: string) => StewardAdvice[];

    // Check if advice is loading
    isLoading: (incidentId: string) => boolean;

    // Get error for an incident
    getError: (incidentId: string) => string | null;

    // Check if incident has any warnings/flags
    hasWarnings: (incidentId: string) => boolean;
}

export const useAdvisorStore = create<AdvisorState & AdvisorActions>((set, get) => ({
    // Initial state
    adviceByIncidentId: {},
    loadingByIncidentId: {},
    errorByIncidentId: {},

    // Actions
    fetchAdvice: async (incidentId: string, rules = [], context = {}) => {
        // Set loading state
        set(state => ({
            loadingByIncidentId: { ...state.loadingByIncidentId, [incidentId]: true },
            errorByIncidentId: { ...state.errorByIncidentId, [incidentId]: null }
        }));

        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/api/incidents/${incidentId}/advice`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                    },
                    body: JSON.stringify({ rules, context })
                }
            );

            const data = await response.json();

            if (data.success) {
                set(state => ({
                    adviceByIncidentId: { ...state.adviceByIncidentId, [incidentId]: data.data },
                    loadingByIncidentId: { ...state.loadingByIncidentId, [incidentId]: false }
                }));
            } else {
                set(state => ({
                    errorByIncidentId: { ...state.errorByIncidentId, [incidentId]: data.error?.message || 'Failed to fetch advice' },
                    loadingByIncidentId: { ...state.loadingByIncidentId, [incidentId]: false }
                }));
            }
        } catch (error) {
            set(state => ({
                errorByIncidentId: { ...state.errorByIncidentId, [incidentId]: 'Network error' },
                loadingByIncidentId: { ...state.loadingByIncidentId, [incidentId]: false }
            }));
        }
    },

    clearAdvice: (incidentId: string) => {
        set(state => {
            const { [incidentId]: _, ...restAdvice } = state.adviceByIncidentId;
            const { [incidentId]: __, ...restLoading } = state.loadingByIncidentId;
            const { [incidentId]: ___, ...restErrors } = state.errorByIncidentId;
            return {
                adviceByIncidentId: restAdvice,
                loadingByIncidentId: restLoading,
                errorByIncidentId: restErrors
            };
        });
    },

    clearAllAdvice: () => {
        set({
            adviceByIncidentId: {},
            loadingByIncidentId: {},
            errorByIncidentId: {}
        });
    },

    getAdvice: (incidentId: string) => {
        return get().adviceByIncidentId[incidentId] || [];
    },

    isLoading: (incidentId: string) => {
        return get().loadingByIncidentId[incidentId] || false;
    },

    getError: (incidentId: string) => {
        return get().errorByIncidentId[incidentId] || null;
    },

    hasWarnings: (incidentId: string) => {
        const advice = get().adviceByIncidentId[incidentId] || [];
        return advice.some(a => a.flags && a.flags.length > 0);
    }
}));
