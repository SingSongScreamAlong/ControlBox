// =====================================================================
// Advisor Panel Component
// Displays steward advisor recommendations for incident review
// =====================================================================

import React, { useEffect } from 'react';
import { useAdvisorStore } from '../stores/advisor.store';
import type { StewardAdvice, AdvisorFlag, AlternativeOutcome } from '@controlbox/common';
import './AdvisorPanel.css';

interface AdvisorPanelProps {
    incidentId: string;
    rules?: unknown[];
    onClose?: () => void;
}

export const AdvisorPanel: React.FC<AdvisorPanelProps> = ({
    incidentId,
    rules = [],
    onClose
}) => {
    const {
        getAdvice,
        fetchAdvice,
        isLoading,
        getError,
        hasWarnings
    } = useAdvisorStore();

    const advice = getAdvice(incidentId);
    const loading = isLoading(incidentId);
    const error = getError(incidentId);

    useEffect(() => {
        if (incidentId && advice.length === 0 && !loading) {
            fetchAdvice(incidentId, rules);
        }
    }, [incidentId, advice.length, loading, fetchAdvice, rules]);

    const getConfidenceColor = (confidence: string): string => {
        switch (confidence) {
            case 'HIGH': return 'var(--color-success)';
            case 'MEDIUM': return 'var(--color-warning)';
            case 'LOW': return 'var(--color-error)';
            default: return 'var(--color-text-secondary)';
        }
    };

    const getFlagIcon = (type: string): string => {
        switch (type) {
            case 'CONFLICTING_RULE': return '⚠️';
            case 'LOW_DATA': return '📊';
            case 'AMBIGUITY': return '❓';
            case 'SEVERITY_MISMATCH': return '⚖️';
            default: return '🔔';
        }
    };

    if (loading) {
        return (
            <div className="advisor-panel advisor-panel--loading">
                <div className="advisor-panel__header">
                    <h3>Steward Advisor</h3>
                    {onClose && <button className="advisor-panel__close" onClick={onClose}>×</button>}
                </div>
                <div className="advisor-panel__loading">
                    <div className="advisor-panel__spinner"></div>
                    <span>Analyzing incident...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="advisor-panel advisor-panel--error">
                <div className="advisor-panel__header">
                    <h3>Steward Advisor</h3>
                    {onClose && <button className="advisor-panel__close" onClick={onClose}>×</button>}
                </div>
                <div className="advisor-panel__error">
                    <span>⚠️ {error}</span>
                    <button onClick={() => fetchAdvice(incidentId, rules)}>Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="advisor-panel">
            <div className="advisor-panel__header">
                <h3>
                    🤖 Steward Advisor
                    {hasWarnings(incidentId) && <span className="advisor-panel__warning-badge">⚠️</span>}
                </h3>
                {onClose && <button className="advisor-panel__close" onClick={onClose}>×</button>}
            </div>

            <div className="advisor-panel__disclaimer">
                ⚖️ Advisors provide guidance only. Final decisions remain with human stewards.
            </div>

            <div className="advisor-panel__content">
                {advice.length === 0 ? (
                    <div className="advisor-panel__empty">
                        No advice generated yet.
                        <button onClick={() => fetchAdvice(incidentId, rules)}>Generate Advice</button>
                    </div>
                ) : (
                    advice.map((item) => (
                        <AdviceCard key={item.id} advice={item} getConfidenceColor={getConfidenceColor} getFlagIcon={getFlagIcon} />
                    ))
                )}
            </div>
        </div>
    );
};

// Sub-component for individual advice cards
interface AdviceCardProps {
    advice: StewardAdvice;
    getConfidenceColor: (confidence: string) => string;
    getFlagIcon: (type: string) => string;
}

const AdviceCard: React.FC<AdviceCardProps> = ({ advice, getConfidenceColor, getFlagIcon }) => {
    return (
        <div className="advice-card">
            <div className="advice-card__header">
                <span className="advice-card__summary">{advice.summary}</span>
                <span
                    className="advice-card__confidence"
                    style={{ backgroundColor: getConfidenceColor(advice.confidence) }}
                >
                    {advice.confidence}
                </span>
            </div>

            {advice.applicableRules.length > 0 && (
                <div className="advice-card__rules">
                    <span className="advice-card__rules-label">Rules:</span>
                    {advice.applicableRules.map((rule, idx) => (
                        <span key={idx} className="advice-card__rule-tag">{rule}</span>
                    ))}
                </div>
            )}

            <div className="advice-card__reasoning">
                {advice.reasoning}
            </div>

            {advice.flags.length > 0 && (
                <div className="advice-card__flags">
                    {advice.flags.map((flag: AdvisorFlag, idx: number) => (
                        <div key={idx} className="advice-card__flag">
                            <span className="advice-card__flag-icon">{getFlagIcon(flag.type)}</span>
                            <span className="advice-card__flag-message">{flag.message}</span>
                        </div>
                    ))}
                </div>
            )}

            {advice.alternatives.length > 0 && (
                <div className="advice-card__alternatives">
                    <div className="advice-card__alternatives-header">Alternative Actions:</div>
                    {advice.alternatives.map((alt: AlternativeOutcome, idx: number) => (
                        <div key={idx} className="advice-card__alternative">
                            <div className="advice-card__alternative-label">{alt.label}</div>
                            <div className="advice-card__alternative-desc">{alt.description}</div>
                            <div className="advice-card__alternative-consequence">
                                → {alt.consequence}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdvisorPanel;
