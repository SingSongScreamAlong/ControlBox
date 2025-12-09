// =====================================================================
// SimulationPreview Component
// Test a rule against a sample incident to see if it would trigger
// =====================================================================

import React, { useState } from 'react';
import type { Rule, PenaltyDefinition } from '@controlbox/common';
import { formatPenaltyType } from '@controlbox/common';
import './SimulationPreview.css';

interface SampleIncident {
    type: string;
    contactType?: string;
    severity: string;
    severityScore?: number;
    lapNumber: number;
    trackPosition?: number;
    isUnderCaution?: boolean;
}

interface SimulationResult {
    wouldTrigger: boolean;
    matchConfidence: number;
    resultingPenalty?: PenaltyDefinition;
    explanation: string;
    matchedConditions: string[];
    unmatchedConditions: string[];
}

interface SimulationPreviewProps {
    rule: Rule;
    onClose: () => void;
    onSimulate: (rule: Rule, incident: SampleIncident) => Promise<SimulationResult>;
}

export const SimulationPreview: React.FC<SimulationPreviewProps> = ({
    rule,
    onClose,
    onSimulate
}) => {
    const [incident, setIncident] = useState<SampleIncident>({
        type: 'contact',
        contactType: 'rear_end',
        severity: 'medium',
        severityScore: 50,
        lapNumber: 5,
        trackPosition: 0.5,
        isUnderCaution: false
    });

    const [result, setResult] = useState<SimulationResult | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    const handleRunSimulation = async () => {
        setIsRunning(true);
        try {
            const simResult = await onSimulate(rule, incident);
            setResult(simResult);
        } catch (error) {
            setResult({
                wouldTrigger: false,
                matchConfidence: 0,
                explanation: 'Simulation failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
                matchedConditions: [],
                unmatchedConditions: []
            });
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content simulation-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Simulation Preview</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {/* Rule Info */}
                    <div className="rule-info-box">
                        <div className="rule-ref">{rule.reference}</div>
                        <div className="rule-title">{rule.title}</div>
                        <div className="rule-penalty">
                            Penalty: {formatPenaltyType(rule.penalty.type)}
                            {rule.penalty.value && ` (${rule.penalty.value})`}
                        </div>
                    </div>

                    {/* Sample Incident Configuration */}
                    <div className="incident-config">
                        <h4>Configure Sample Incident</h4>
                        <div className="config-grid">
                            <div className="config-field">
                                <label>Incident Type</label>
                                <select
                                    value={incident.type}
                                    onChange={e => setIncident({ ...incident, type: e.target.value })}
                                >
                                    <option value="contact">Contact</option>
                                    <option value="spin">Spin</option>
                                    <option value="off_track">Off Track</option>
                                    <option value="unsafe_rejoin">Unsafe Rejoin</option>
                                    <option value="pit_violation">Pit Violation</option>
                                    <option value="blocking">Blocking</option>
                                    <option value="yellow_flag_violation">Yellow Flag Violation</option>
                                    <option value="track_limits">Track Limits</option>
                                    <option value="loss_of_control">Loss of Control</option>
                                </select>
                            </div>

                            <div className="config-field">
                                <label>Contact Type</label>
                                <select
                                    value={incident.contactType || ''}
                                    onChange={e => setIncident({ ...incident, contactType: e.target.value || undefined })}
                                >
                                    <option value="">N/A</option>
                                    <option value="rear_end">Rear End</option>
                                    <option value="side_swipe">Side Swipe</option>
                                    <option value="divebomb">Divebomb</option>
                                    <option value="squeeze">Squeeze</option>
                                    <option value="door_slam">Door Slam</option>
                                </select>
                            </div>

                            <div className="config-field">
                                <label>Severity</label>
                                <select
                                    value={incident.severity}
                                    onChange={e => setIncident({ ...incident, severity: e.target.value })}
                                >
                                    <option value="light">Light</option>
                                    <option value="medium">Medium</option>
                                    <option value="heavy">Heavy</option>
                                </select>
                            </div>

                            <div className="config-field">
                                <label>Severity Score (0-100)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={incident.severityScore || 0}
                                    onChange={e => setIncident({ ...incident, severityScore: parseInt(e.target.value) || 0 })}
                                />
                            </div>

                            <div className="config-field">
                                <label>Lap Number</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={incident.lapNumber}
                                    onChange={e => setIncident({ ...incident, lapNumber: parseInt(e.target.value) || 1 })}
                                />
                            </div>

                            <div className="config-field">
                                <label>Track Position (0-1)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={incident.trackPosition || 0}
                                    onChange={e => setIncident({ ...incident, trackPosition: parseFloat(e.target.value) || 0 })}
                                />
                            </div>

                            <div className="config-field config-checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={incident.isUnderCaution || false}
                                        onChange={e => setIncident({ ...incident, isUnderCaution: e.target.checked })}
                                    />
                                    Under Caution
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Run Simulation Button */}
                    <div className="simulation-action">
                        <button
                            className="btn-simulate-run"
                            onClick={handleRunSimulation}
                            disabled={isRunning}
                        >
                            {isRunning ? (
                                <>
                                    <span className="spinner" />
                                    Running...
                                </>
                            ) : (
                                <>
                                    ▶ Run Simulation
                                </>
                            )}
                        </button>
                    </div>

                    {/* Results */}
                    {result && (
                        <div className={`simulation-result ${result.wouldTrigger ? 'triggered' : 'not-triggered'}`}>
                            <div className="result-header">
                                <span className={`trigger-badge ${result.wouldTrigger ? 'yes' : 'no'}`}>
                                    {result.wouldTrigger ? '✓ WOULD TRIGGER' : '✕ WOULD NOT TRIGGER'}
                                </span>
                                <span className="confidence-value">
                                    {Math.round(result.matchConfidence * 100)}% confidence
                                </span>
                            </div>

                            <div className="result-explanation">
                                {result.explanation}
                            </div>

                            {result.wouldTrigger && result.resultingPenalty && (
                                <div className="result-penalty">
                                    <strong>Resulting Penalty:</strong>{' '}
                                    {formatPenaltyType(result.resultingPenalty.type)}
                                    {result.resultingPenalty.value && ` (${result.resultingPenalty.value})`}
                                </div>
                            )}

                            <div className="conditions-breakdown">
                                {result.matchedConditions.length > 0 && (
                                    <div className="conditions-matched">
                                        <h5>✓ Matched Conditions</h5>
                                        <ul>
                                            {result.matchedConditions.map((cond, i) => (
                                                <li key={i}>{cond}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {result.unmatchedConditions.length > 0 && (
                                    <div className="conditions-unmatched">
                                        <h5>✕ Unmatched Conditions</h5>
                                        <ul>
                                            {result.unmatchedConditions.map((cond, i) => (
                                                <li key={i}>{cond}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default SimulationPreview;
