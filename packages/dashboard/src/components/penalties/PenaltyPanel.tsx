// =====================================================================
// Penalty Panel Component
// Displays pending and issued penalties with advisor integration
// =====================================================================

import { useState } from 'react';
import { useIncidentStore } from '../../stores/incident.store';
import { useAdvisorStore } from '../../stores/advisor.store';
import { formatPenaltyType } from '@controlbox/common';
import type { Penalty, PenaltyStatus } from '@controlbox/common';
import { AdvisorChip } from '../AdvisorChip';
import { AdvisorPanel } from '../AdvisorPanel';

export function PenaltyPanel() {
    const { penalties } = useIncidentStore();
    const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

    const pendingPenalties = penalties.filter((p: Penalty) => p.status === 'proposed');
    const issuedPenalties = penalties.filter((p: Penalty) => p.status === 'approved' || p.status === 'applied');

    return (
        <div className="card h-full flex flex-col">
            <div className="card-header">
                <h3 className="font-semibold text-white">Penalties</h3>
                <span className={`badge ${pendingPenalties.length > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>
                    {pendingPenalties.length} pending
                </span>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Advisor Panel for selected incident */}
                {selectedIncidentId && (
                    <div className="p-3 border-b border-slate-700">
                        <AdvisorPanel
                            incidentId={selectedIncidentId}
                            onClose={() => setSelectedIncidentId(null)}
                        />
                    </div>
                )}

                {/* Pending Proposals */}
                {pendingPenalties.length > 0 && (
                    <div className="border-b border-slate-700/50">
                        <div className="px-4 py-2 bg-amber-500/10">
                            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                                Awaiting Approval
                            </span>
                        </div>
                        <div className="divide-y divide-slate-700/30">
                            {pendingPenalties.map((penalty: Penalty) => (
                                <PenaltyItem
                                    key={penalty.id}
                                    penalty={penalty}
                                    isPending
                                    onShowAdvisor={() => setSelectedIncidentId(penalty.incidentId ?? null)}
                                    showingAdvisor={selectedIncidentId === penalty.incidentId}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Issued Penalties */}
                {issuedPenalties.length > 0 && (
                    <div>
                        <div className="px-4 py-2 bg-slate-700/30">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Issued
                            </span>
                        </div>
                        <div className="divide-y divide-slate-700/30">
                            {issuedPenalties.map((penalty: Penalty) => (
                                <PenaltyItem key={penalty.id} penalty={penalty} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {penalties.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        <p>No penalties</p>
                    </div>
                )}
            </div>
        </div>
    );
}

interface PenaltyItemProps {
    penalty: Penalty;
    isPending?: boolean;
    onShowAdvisor?: () => void;
    showingAdvisor?: boolean;
}

function PenaltyItem({ penalty, isPending, onShowAdvisor, showingAdvisor }: PenaltyItemProps) {
    const { approvePenalty, rejectPenalty } = useIncidentStore();
    const { hasWarnings } = useAdvisorStore();

    const typeColors: Record<string, string> = {
        warning: 'bg-blue-500/20 text-blue-400',
        reprimand: 'bg-blue-500/20 text-blue-400',
        time_penalty: 'bg-amber-500/20 text-amber-400',
        position_penalty: 'bg-orange-500/20 text-orange-400',
        drive_through: 'bg-red-500/20 text-red-400',
        stop_go: 'bg-red-500/20 text-red-400',
        disqualification: 'bg-red-600/30 text-red-300',
        grid_penalty: 'bg-orange-500/20 text-orange-400',
        points_deduction: 'bg-orange-500/20 text-orange-400',
        race_ban: 'bg-red-600/30 text-red-300',
        custom: 'bg-slate-600/50 text-slate-300',
    };

    const handleApprove = () => {
        approvePenalty(penalty.id);
    };

    const handleReject = () => {
        rejectPenalty(penalty.id);
    };

    // Format created date for display
    const formatDate = (date: Date) => {
        const d = new Date(date);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className={`px-4 py-3 ${isPending ? 'bg-amber-500/5' : ''}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    {/* Type badge and driver */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`badge ${typeColors[penalty.type] || 'bg-slate-600'}`}>
                            {formatPenaltyType(penalty.type)}
                            {penalty.value && ` ${penalty.value}`}
                        </span>
                        <span className="font-medium text-white">
                            #{penalty.carNumber}
                        </span>
                        {/* Advisor chip for pending penalties */}
                        {isPending && penalty.incidentId && (
                            <AdvisorChip
                                incidentId={penalty.incidentId}
                                onClick={onShowAdvisor}
                                size="small"
                            />
                        )}
                    </div>

                    {/* Rationale */}
                    <p className="text-sm text-slate-400 truncate">
                        {penalty.rationale}
                    </p>

                    {/* Advisor warning indicator */}
                    {isPending && penalty.incidentId && hasWarnings(penalty.incidentId) && (
                        <p className="text-xs text-amber-400 mt-1">
                            ⚠️ Advisor flagged concerns — review recommended
                        </p>
                    )}

                    {/* Time info */}
                    <p className="text-xs text-slate-500 mt-1">
                        {formatDate(penalty.proposedAt)}
                    </p>
                </div>

                {/* Actions for pending */}
                {isPending && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Advisor button */}
                        {onShowAdvisor && (
                            <button
                                onClick={onShowAdvisor}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showingAdvisor
                                    ? 'bg-blue-500/30 text-blue-400'
                                    : 'bg-slate-700 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400'
                                    }`}
                                title="Get Advisor Recommendations"
                            >
                                📋
                            </button>
                        )}
                        <button
                            onClick={handleReject}
                            className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-red-500/30 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors"
                            title="Reject"
                        >
                            ✕
                        </button>
                        <button
                            onClick={handleApprove}
                            className="w-8 h-8 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 flex items-center justify-center transition-colors"
                            title="Approve"
                        >
                            ✓
                        </button>
                    </div>
                )}

                {/* Status for issued */}
                {!isPending && (
                    <StatusBadge status={penalty.status} />
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: PenaltyStatus }) {
    const statusColors: Record<PenaltyStatus, string> = {
        proposed: 'bg-amber-500/20 text-amber-400',
        under_review: 'bg-purple-500/20 text-purple-400',
        approved: 'bg-green-500/20 text-green-400',
        applied: 'bg-blue-500/20 text-blue-400',
        appealed: 'bg-orange-500/20 text-orange-400',
        overturned: 'bg-slate-500/20 text-slate-400',
        rejected: 'bg-red-500/20 text-red-400',
    };

    const statusLabels: Record<PenaltyStatus, string> = {
        proposed: 'Proposed',
        under_review: 'Reviewing',
        approved: 'Approved',
        applied: 'Applied',
        appealed: 'Appealed',
        overturned: 'Overturned',
        rejected: 'Rejected',
    };

    return (
        <span className={`badge ${statusColors[status]}`}>
            {statusLabels[status]}
        </span>
    );
}

