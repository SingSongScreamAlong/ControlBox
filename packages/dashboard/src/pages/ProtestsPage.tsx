// =====================================================================
// Protests Page
// List and manage protest submissions
// =====================================================================

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { EvidenceViewer, EvidenceUploader } from '../components/evidence';

interface Protest {
    id: string;
    leagueId: string;
    incidentId?: string;
    submittedByName: string;
    status: 'submitted' | 'under_review' | 'upheld' | 'rejected' | 'withdrawn';
    grounds: string;
    resolution?: string;
    createdAt: string;
    resolvedAt?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function ProtestsPage() {
    const { accessToken } = useAuthStore();
    const [protests, setProtests] = useState<Protest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'submitted' | 'under_review' | 'resolved'>('all');
    const [selectedProtest, setSelectedProtest] = useState<Protest | null>(null);

    useEffect(() => {
        fetchProtests();
    }, []);

    const fetchProtests = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/protests`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const data = await res.json();
            if (data.success) {
                setProtests(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch protests:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateProtest = async (id: string, updates: { status?: string; resolution?: string; stewardNotes?: string }) => {
        try {
            const res = await fetch(`${API_BASE}/api/protests/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`
                },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                fetchProtests();
                setSelectedProtest(null);
            }
        } catch (err) {
            console.error('Failed to update protest:', err);
        }
    };

    const filteredProtests = protests.filter(p => {
        if (filter === 'all') return true;
        if (filter === 'submitted') return p.status === 'submitted';
        if (filter === 'under_review') return p.status === 'under_review';
        if (filter === 'resolved') return ['upheld', 'rejected', 'withdrawn'].includes(p.status);
        return true;
    });

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            submitted: 'bg-blue-500/20 text-blue-400',
            under_review: 'bg-amber-500/20 text-amber-400',
            upheld: 'bg-green-500/20 text-green-400',
            rejected: 'bg-red-500/20 text-red-400',
            withdrawn: 'bg-slate-500/20 text-slate-400'
        };
        return colors[status] || 'bg-slate-600';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-slate-400">Loading protests...</div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Protests & Appeals</h1>
                    <p className="text-slate-400 mt-1">Review and resolve driver protests</p>
                </div>
                <div className="flex gap-2">
                    {(['all', 'submitted', 'under_review', 'resolved'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${filter === f
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                }`}
                        >
                            {f.replace('_', ' ').charAt(0).toUpperCase() + f.replace('_', ' ').slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {filteredProtests.length === 0 ? (
                <div className="bg-slate-800 rounded-xl p-12 text-center border border-slate-700">
                    <p className="text-slate-400">No protests found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredProtests.map(protest => (
                        <div
                            key={protest.id}
                            onClick={() => setSelectedProtest(protest)}
                            className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-600 cursor-pointer transition-all"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`badge ${getStatusBadge(protest.status)}`}>
                                            {protest.status.replace('_', ' ')}
                                        </span>
                                        <span className="text-white font-medium">{protest.submittedByName}</span>
                                    </div>
                                    <p className="text-slate-300 text-sm line-clamp-2">{protest.grounds}</p>
                                </div>
                                <div className="text-right text-sm text-slate-500">
                                    {new Date(protest.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Protest Detail Modal */}
            {selectedProtest && (
                <ProtestDetailModal
                    protest={selectedProtest}
                    onClose={() => setSelectedProtest(null)}
                    onUpdate={updateProtest}
                />
            )}
        </div>
    );
}

interface ProtestDetailModalProps {
    protest: Protest;
    onClose: () => void;
    onUpdate: (id: string, updates: { status?: string; resolution?: string; stewardNotes?: string }) => void;
}

function ProtestDetailModal({ protest, onClose, onUpdate }: ProtestDetailModalProps) {
    const [resolution, setResolution] = useState(protest.resolution || '');
    const [notes, setNotes] = useState('');
    const [showEvidence, setShowEvidence] = useState(true);
    const [showUploader, setShowUploader] = useState(false);

    const handleResolve = (status: 'upheld' | 'rejected') => {
        onUpdate(protest.id, { status, resolution, stewardNotes: notes });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-slate-700">
                <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Protest Review</h2>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    <div className="mb-6">
                        <div className="text-sm text-slate-400 mb-1">Submitted by</div>
                        <div className="text-white font-medium">{protest.submittedByName}</div>
                    </div>

                    <div className="mb-6">
                        <div className="text-sm text-slate-400 mb-1">Grounds for Protest</div>
                        <div className="bg-slate-700/50 rounded-lg p-4 text-slate-200">
                            {protest.grounds}
                        </div>
                    </div>

                    {/* Evidence Section */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-sm text-slate-400">Evidence</div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowUploader(!showUploader)}
                                    className="text-xs px-3 py-1 bg-primary-600 hover:bg-primary-500 text-white rounded-lg"
                                >
                                    {showUploader ? 'Cancel' : '+ Add Evidence'}
                                </button>
                                <button
                                    onClick={() => setShowEvidence(!showEvidence)}
                                    className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg"
                                >
                                    {showEvidence ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>

                        {showUploader && (
                            <div className="mb-4 p-4 bg-slate-700/50 rounded-lg">
                                <EvidenceUploader
                                    protestId={protest.id}
                                    onClose={() => setShowUploader(false)}
                                />
                            </div>
                        )}

                        {showEvidence && (
                            <div className="bg-slate-900/50 rounded-lg overflow-hidden">
                                <EvidenceViewer protestId={protest.id} />
                            </div>
                        )}
                    </div>

                    {protest.status === 'submitted' || protest.status === 'under_review' ? (
                        <>
                            <div className="mb-6">
                                <label className="text-sm text-slate-400 mb-1 block">Steward Notes</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white resize-none"
                                    rows={3}
                                    placeholder="Internal notes..."
                                />
                            </div>

                            <div className="mb-6">
                                <label className="text-sm text-slate-400 mb-1 block">Resolution</label>
                                <textarea
                                    value={resolution}
                                    onChange={(e) => setResolution(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white resize-none"
                                    rows={3}
                                    placeholder="Official resolution text..."
                                />
                            </div>
                        </>
                    ) : (
                        <div className="mb-6">
                            <div className="text-sm text-slate-400 mb-1">Resolution</div>
                            <div className="bg-slate-700/50 rounded-lg p-4 text-slate-200">
                                {protest.resolution || 'No resolution recorded'}
                            </div>
                        </div>
                    )}
                </div>

                {(protest.status === 'submitted' || protest.status === 'under_review') && (
                    <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
                        <button
                            onClick={() => handleResolve('rejected')}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
                        >
                            Reject Protest
                        </button>
                        <button
                            onClick={() => handleResolve('upheld')}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg"
                        >
                            Uphold Protest
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
