// =====================================================================
// Steward Voting Panel Component
// Multi-steward voting interface for incident decisions
// =====================================================================

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth.store';

interface Vote {
    id: string;
    stewardId: string;
    stewardName?: string;
    vote: VoteDecision;
    reasoning?: string;
    isDissent: boolean;
    votedAt: string;
}

interface Panel {
    id: string;
    incidentId?: string;
    requiredVotes: number;
    status: 'voting' | 'closed' | 'expired';
    finalDecision?: string;
    votes: Vote[];
    votedCount: number;
}

type VoteDecision = 'penalty' | 'warning' | 'reprimand' | 'no_action' | 'dismiss';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface StewardVotingPanelProps {
    panelId: string;
    onClose?: () => void;
}

export function StewardVotingPanel({ panelId, onClose }: StewardVotingPanelProps) {
    const { accessToken, user } = useAuthStore();
    const [panel, setPanel] = useState<Panel | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedVote, setSelectedVote] = useState<VoteDecision | null>(null);
    const [reasoning, setReasoning] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchPanel();
    }, [panelId]);

    const fetchPanel = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/panels/${panelId}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const data = await res.json();
            if (data.success) {
                setPanel(data.data);
                // Check if current user already voted
                const myVote = data.data.votes?.find((v: Vote) => v.stewardId === user?.id);
                if (myVote) {
                    setSelectedVote(myVote.vote);
                    setReasoning(myVote.reasoning || '');
                }
            }
        } catch (err) {
            console.error('Failed to fetch panel:', err);
        } finally {
            setLoading(false);
        }
    };

    const castVote = async () => {
        if (!selectedVote) return;
        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/api/panels/${panelId}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`
                },
                body: JSON.stringify({ vote: selectedVote, reasoning })
            });
            if (res.ok) {
                fetchPanel();
            }
        } catch (err) {
            console.error('Failed to cast vote:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const voteOptions: { value: VoteDecision; label: string; color: string }[] = [
        { value: 'penalty', label: 'Penalty', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
        { value: 'warning', label: 'Warning', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
        { value: 'reprimand', label: 'Reprimand', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
        { value: 'no_action', label: 'No Action', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
        { value: 'dismiss', label: 'Dismiss', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
    ];

    if (loading) {
        return (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="text-slate-400 text-center">Loading panel...</div>
            </div>
        );
    }

    if (!panel) {
        return (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="text-red-400 text-center">Panel not found</div>
            </div>
        );
    }

    const hasVoted = panel.votes?.some(v => v.stewardId === user?.id);
    const voteCounts = panel.votes?.reduce((acc, v) => {
        acc[v.vote] = (acc[v.vote] || 0) + 1;
        return acc;
    }, {} as Record<string, number>) || {};

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">Steward Panel Vote</h3>
                    <p className="text-sm text-slate-400">
                        {panel.votedCount} of {panel.requiredVotes} votes cast
                    </p>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
                )}
            </div>

            <div className="p-6">
                {/* Voting Progress */}
                <div className="mb-6">
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${(panel.votedCount / panel.requiredVotes) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Vote Buttons */}
                {panel.status === 'voting' && !hasVoted && (
                    <div className="mb-6">
                        <div className="text-sm text-slate-400 mb-3">Cast Your Vote</div>
                        <div className="flex flex-wrap gap-2">
                            {voteOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setSelectedVote(opt.value)}
                                    className={`px-4 py-2 rounded-lg border transition-all ${selectedVote === opt.value
                                            ? opt.color + ' border-2'
                                            : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-slate-500'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {selectedVote && (
                            <>
                                <textarea
                                    value={reasoning}
                                    onChange={(e) => setReasoning(e.target.value)}
                                    placeholder="Reasoning (optional)..."
                                    className="w-full mt-4 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white resize-none"
                                    rows={3}
                                />
                                <button
                                    onClick={castVote}
                                    disabled={submitting}
                                    className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white rounded-lg font-medium"
                                >
                                    {submitting ? 'Submitting...' : 'Submit Vote'}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Already Voted */}
                {hasVoted && panel.status === 'voting' && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-green-400">✓ You have cast your vote</p>
                    </div>
                )}

                {/* Vote Summary */}
                {panel.votes && panel.votes.length > 0 && (
                    <div>
                        <div className="text-sm text-slate-400 mb-3">Vote Summary</div>
                        <div className="space-y-2">
                            {voteOptions.map(opt => {
                                const count = voteCounts[opt.value] || 0;
                                if (count === 0) return null;
                                return (
                                    <div key={opt.value} className="flex items-center justify-between">
                                        <span className={`badge ${opt.color}`}>{opt.label}</span>
                                        <span className="text-white font-mono">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Final Decision */}
                {panel.status === 'closed' && panel.finalDecision && (
                    <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <div className="text-sm text-blue-400 mb-1">Final Decision</div>
                        <div className="text-white font-medium">{panel.finalDecision}</div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default StewardVotingPanel;
