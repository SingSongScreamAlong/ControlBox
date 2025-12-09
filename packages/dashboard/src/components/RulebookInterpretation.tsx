// =====================================================================
// RulebookInterpretation Component
// Review, approve, reject, and edit AI-interpreted rules
// =====================================================================

import React, { useState, useMemo } from 'react';
import type {
    InterpretedRule,
    InterpretationSession,
    RuleCategory,
    Rule
} from '@controlbox/common';
import { formatPenaltyType } from '@controlbox/common';
import './RulebookInterpretation.css';

interface RulebookInterpretationProps {
    session: InterpretationSession;
    onApprove: (ruleId: string) => Promise<void>;
    onReject: (ruleId: string) => Promise<void>;
    onEdit: (ruleId: string, updatedRule: Rule) => Promise<void>;
    onBulkApprove: (ruleIds: string[]) => Promise<void>;
    onBulkReject: (ruleIds: string[]) => Promise<void>;
    onCommit: (ruleIds: string[]) => Promise<void>;
    onSimulate: (rule: Rule) => void;
}

export const RulebookInterpretation: React.FC<RulebookInterpretationProps> = ({
    session,
    onApprove,
    onReject,
    onEdit,
    onBulkApprove,
    onBulkReject,
    onCommit,
    onSimulate
}) => {
    const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
    const [editingRule, setEditingRule] = useState<InterpretedRule | null>(null);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [categoryFilter, setCategoryFilter] = useState<RuleCategory | 'all'>('all');
    const [isProcessing, setIsProcessing] = useState(false);

    const filteredRules = useMemo(() => {
        return session.interpretedRules.filter(rule => {
            if (filter !== 'all' && rule.status !== filter) return false;
            if (categoryFilter !== 'all' && rule.category !== categoryFilter) return false;
            return true;
        });
    }, [session.interpretedRules, filter, categoryFilter]);

    const handleSelectAll = () => {
        if (selectedRules.size === filteredRules.length) {
            setSelectedRules(new Set());
        } else {
            setSelectedRules(new Set(filteredRules.map(r => r.id)));
        }
    };

    const handleToggleSelect = (ruleId: string) => {
        const newSelected = new Set(selectedRules);
        if (newSelected.has(ruleId)) {
            newSelected.delete(ruleId);
        } else {
            newSelected.add(ruleId);
        }
        setSelectedRules(newSelected);
    };

    const handleBulkAction = async (action: 'approve' | 'reject') => {
        if (selectedRules.size === 0) return;
        setIsProcessing(true);
        try {
            if (action === 'approve') {
                await onBulkApprove(Array.from(selectedRules));
            } else {
                await onBulkReject(Array.from(selectedRules));
            }
            setSelectedRules(new Set());
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCommit = async () => {
        const approvedIds = session.interpretedRules
            .filter(r => r.status === 'approved')
            .map(r => r.id);
        if (approvedIds.length === 0) return;
        setIsProcessing(true);
        try {
            await onCommit(approvedIds);
        } finally {
            setIsProcessing(false);
        }
    };

    const approvedCount = session.interpretedRules.filter(r => r.status === 'approved').length;

    return (
        <div className="rulebook-interpretation">
            {/* Header */}
            <div className="interpretation-header">
                <div className="header-info">
                    <h2>Interpreted Rules</h2>
                    <p className="session-meta">
                        {session.fileName} • {session.interpretedRules.length} rules extracted
                    </p>
                </div>
                <div className="header-actions">
                    <button
                        className="btn-commit"
                        onClick={handleCommit}
                        disabled={approvedCount === 0 || isProcessing}
                    >
                        Commit {approvedCount} Approved Rules
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="stats-bar">
                <div className="stat">
                    <span className="stat-value">{session.stats.totalRulesFound}</span>
                    <span className="stat-label">Total</span>
                </div>
                <div className="stat stat-pending">
                    <span className="stat-value">{session.stats.pending}</span>
                    <span className="stat-label">Pending</span>
                </div>
                <div className="stat stat-approved">
                    <span className="stat-value">{session.stats.approved}</span>
                    <span className="stat-label">Approved</span>
                </div>
                <div className="stat stat-rejected">
                    <span className="stat-value">{session.stats.rejected}</span>
                    <span className="stat-label">Rejected</span>
                </div>
                <div className="stat-divider" />
                <div className="confidence-stats">
                    <span className="confidence-badge high">{session.stats.byConfidence?.HIGH || 0} HIGH</span>
                    <span className="confidence-badge medium">{session.stats.byConfidence?.MEDIUM || 0} MED</span>
                    <span className="confidence-badge low">{session.stats.byConfidence?.LOW || 0} LOW</span>
                </div>
            </div>

            {/* Filters and Bulk Actions */}
            <div className="toolbar">
                <div className="filters">
                    <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as typeof categoryFilter)}>
                        <option value="all">All Categories</option>
                        <option value="INCIDENT">Incident</option>
                        <option value="PENALTY">Penalty</option>
                        <option value="START_PROC">Start Procedure</option>
                        <option value="RACE_CONTROL">Race Control</option>
                        <option value="CONDUCT">Conduct</option>
                        <option value="OTHER">Other</option>
                    </select>
                </div>
                <div className="bulk-actions">
                    <button
                        className="btn-select-all"
                        onClick={handleSelectAll}
                    >
                        {selectedRules.size === filteredRules.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <button
                        className="btn-bulk btn-approve"
                        onClick={() => handleBulkAction('approve')}
                        disabled={selectedRules.size === 0 || isProcessing}
                    >
                        ✓ Approve Selected ({selectedRules.size})
                    </button>
                    <button
                        className="btn-bulk btn-reject"
                        onClick={() => handleBulkAction('reject')}
                        disabled={selectedRules.size === 0 || isProcessing}
                    >
                        ✕ Reject Selected
                    </button>
                </div>
            </div>

            {/* Rules Table */}
            <div className="rules-table">
                <div className="table-header">
                    <div className="col-select">
                        <input
                            type="checkbox"
                            checked={selectedRules.size === filteredRules.length && filteredRules.length > 0}
                            onChange={handleSelectAll}
                        />
                    </div>
                    <div className="col-original">Original Text</div>
                    <div className="col-summary">AI Summary</div>
                    <div className="col-structured">Structured Rule</div>
                    <div className="col-actions">Actions</div>
                </div>

                {filteredRules.length === 0 ? (
                    <div className="empty-state">
                        <p>No rules match the current filters</p>
                    </div>
                ) : (
                    filteredRules.map(rule => (
                        <InterpretedRuleRow
                            key={rule.id}
                            rule={rule}
                            isSelected={selectedRules.has(rule.id)}
                            onToggleSelect={() => handleToggleSelect(rule.id)}
                            onApprove={() => onApprove(rule.id)}
                            onReject={() => onReject(rule.id)}
                            onEdit={() => setEditingRule(rule)}
                            onSimulate={() => onSimulate(rule.structuredRule)}
                        />
                    ))
                )}
            </div>

            {/* Edit Modal */}
            {editingRule && (
                <RuleEditModal
                    rule={editingRule}
                    onClose={() => setEditingRule(null)}
                    onSave={async (updatedRule) => {
                        await onEdit(editingRule.id, updatedRule);
                        setEditingRule(null);
                    }}
                />
            )}
        </div>
    );
};

// --- InterpretedRuleRow Component ---

interface InterpretedRuleRowProps {
    rule: InterpretedRule;
    isSelected: boolean;
    onToggleSelect: () => void;
    onApprove: () => void;
    onReject: () => void;
    onEdit: () => void;
    onSimulate: () => void;
}

const InterpretedRuleRow: React.FC<InterpretedRuleRowProps> = ({
    rule,
    isSelected,
    onToggleSelect,
    onApprove,
    onReject,
    onEdit,
    onSimulate
}) => {
    const confidenceClass = rule.confidence.toLowerCase();
    const statusClass = rule.status;

    return (
        <div className={`rule-row ${statusClass}`}>
            <div className="col-select">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={onToggleSelect}
                />
            </div>

            {/* Column 1: Original Text */}
            <div className="col-original">
                <div className="original-text">{rule.originalText}</div>
                {rule.sourceLines && (
                    <span className="source-lines">
                        Lines {rule.sourceLines.start}-{rule.sourceLines.end}
                    </span>
                )}
            </div>

            {/* Column 2: AI Summary */}
            <div className="col-summary">
                <div className="summary-content">
                    <p>{rule.summary}</p>
                    <div className="badges">
                        <span className={`confidence-badge ${confidenceClass}`}>
                            {rule.confidence}
                        </span>
                        <span className={`category-badge cat-${rule.category.toLowerCase()}`}>
                            {rule.category.replace('_', ' ')}
                        </span>
                    </div>
                </div>
                {rule.confidence === 'LOW' && (
                    <div className="low-confidence-warning">
                        ⚠️ Low confidence - review carefully
                    </div>
                )}
            </div>

            {/* Column 3: Structured Rule */}
            <div className="col-structured">
                <div className="structured-preview">
                    <div className="rule-ref">{rule.structuredRule.reference}</div>
                    <div className="rule-title">{rule.structuredRule.title}</div>
                    <div className="conditions-preview">
                        {rule.structuredRule.conditions.slice(0, 2).map((cond, i) => (
                            <span key={i} className="condition-chip">
                                {cond.field} {cond.operator} {JSON.stringify(cond.value)}
                            </span>
                        ))}
                        {rule.structuredRule.conditions.length > 2 && (
                            <span className="condition-chip more">
                                +{rule.structuredRule.conditions.length - 2} more
                            </span>
                        )}
                    </div>
                    <div className="penalty-preview">
                        → {formatPenaltyType(rule.structuredRule.penalty.type)}
                        {rule.structuredRule.penalty.value && ` (${rule.structuredRule.penalty.value})`}
                    </div>
                </div>
            </div>

            {/* Column 4: Actions */}
            <div className="col-actions">
                <div className="action-buttons">
                    {rule.status === 'pending' && (
                        <>
                            <button className="btn-action btn-approve" onClick={onApprove} title="Approve">
                                ✓
                            </button>
                            <button className="btn-action btn-reject" onClick={onReject} title="Reject">
                                ✕
                            </button>
                        </>
                    )}
                    <button className="btn-action btn-edit" onClick={onEdit} title="Edit">
                        ✎
                    </button>
                    <button className="btn-action btn-simulate" onClick={onSimulate} title="Simulate">
                        ▶
                    </button>
                </div>
                <span className={`status-badge ${statusClass}`}>
                    {rule.status}
                </span>
            </div>
        </div>
    );
};

// --- Rule Edit Modal ---

interface RuleEditModalProps {
    rule: InterpretedRule;
    onClose: () => void;
    onSave: (updatedRule: Rule) => Promise<void>;
}

const RuleEditModal: React.FC<RuleEditModalProps> = ({ rule, onClose, onSave }) => {
    const [editedRule, setEditedRule] = useState<Rule>({ ...rule.structuredRule });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(editedRule);
        } finally {
            setIsSaving(false);
        }
    };

    const updateCondition = (index: number, field: string, value: string) => {
        const newConditions = [...editedRule.conditions];
        newConditions[index] = { ...newConditions[index], [field]: value };
        setEditedRule({ ...editedRule, conditions: newConditions });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content edit-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Edit Structured Rule</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {/* Basic Info */}
                    <div className="form-group">
                        <label>Reference</label>
                        <input
                            type="text"
                            value={editedRule.reference}
                            onChange={e => setEditedRule({ ...editedRule, reference: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label>Title</label>
                        <input
                            type="text"
                            value={editedRule.title}
                            onChange={e => setEditedRule({ ...editedRule, title: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            value={editedRule.description}
                            onChange={e => setEditedRule({ ...editedRule, description: e.target.value })}
                            rows={3}
                        />
                    </div>

                    {/* Conditions */}
                    <div className="form-section">
                        <h4>Conditions</h4>
                        {editedRule.conditions.map((cond, i) => (
                            <div key={i} className="condition-row">
                                <select
                                    value={cond.field}
                                    onChange={e => updateCondition(i, 'field', e.target.value)}
                                >
                                    <option value="incident.type">Incident Type</option>
                                    <option value="incident.contactType">Contact Type</option>
                                    <option value="incident.severity">Severity</option>
                                    <option value="incident.severityScore">Severity Score</option>
                                    <option value="session.type">Session Type</option>
                                    <option value="context.isUnderCaution">Under Caution</option>
                                </select>
                                <select
                                    value={cond.operator}
                                    onChange={e => updateCondition(i, 'operator', e.target.value)}
                                >
                                    <option value="eq">equals</option>
                                    <option value="neq">not equals</option>
                                    <option value="gt">greater than</option>
                                    <option value="lt">less than</option>
                                    <option value="in">in list</option>
                                </select>
                                <input
                                    type="text"
                                    value={typeof cond.value === 'string' ? cond.value : JSON.stringify(cond.value)}
                                    onChange={e => updateCondition(i, 'value', e.target.value)}
                                    placeholder="value"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Penalty */}
                    <div className="form-section">
                        <h4>Penalty</h4>
                        <div className="penalty-row">
                            <select
                                value={editedRule.penalty.type}
                                onChange={e => setEditedRule({
                                    ...editedRule,
                                    penalty: { ...editedRule.penalty, type: e.target.value as Rule['penalty']['type'] }
                                })}
                            >
                                <option value="warning">Warning</option>
                                <option value="reprimand">Reprimand</option>
                                <option value="time_penalty">Time Penalty</option>
                                <option value="position_penalty">Position Penalty</option>
                                <option value="drive_through">Drive Through</option>
                                <option value="stop_go">Stop & Go</option>
                                <option value="disqualification">Disqualification</option>
                            </select>
                            <input
                                type="text"
                                value={editedRule.penalty.value || ''}
                                onChange={e => setEditedRule({
                                    ...editedRule,
                                    penalty: { ...editedRule.penalty, value: e.target.value }
                                })}
                                placeholder="e.g., 5 seconds"
                            />
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RulebookInterpretation;
