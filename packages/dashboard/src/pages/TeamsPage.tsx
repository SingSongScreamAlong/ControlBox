// =====================================================================
// Teams Page
// Team management for multi-driver championships
// =====================================================================

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth.store';

interface Team {
    id: string;
    name: string;
    shortName: string;
    country?: string;
    color?: string;
    logoUrl?: string;
    members: { driverId: string; role: string }[];
    seasonId?: string;
    points?: number;
    createdAt: string;
}

export default function TeamsPage() {
    const { accessToken } = useAuthStore();
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTeam, setNewTeam] = useState({ name: '', shortName: '', color: '#3b82f6' });

    useEffect(() => {
        fetchTeams();
    }, []);

    const fetchTeams = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/teams`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const data = await response.json();
            if (data.success) {
                setTeams(data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch teams:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTeam = async () => {
        if (!newTeam.name.trim()) return;

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/teams`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(newTeam)
            });

            if (response.ok) {
                setShowCreateModal(false);
                setNewTeam({ name: '', shortName: '', color: '#3b82f6' });
                fetchTeams();
            }
        } catch (error) {
            console.error('Failed to create team:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-slate-400">Loading teams...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Teams</h2>
                    <p className="text-slate-400">Manage racing teams and driver assignments</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-primary"
                >
                    + New Team
                </button>
            </div>

            {/* Teams Grid */}
            {teams.length === 0 ? (
                <div className="card p-12 text-center">
                    <div className="text-4xl mb-4">👥</div>
                    <h3 className="text-lg font-semibold text-white mb-2">No Teams Yet</h3>
                    <p className="text-slate-400 mb-4">
                        Create teams to organize drivers for championship standings
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-primary"
                    >
                        Create First Team
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.map(team => (
                        <div key={team.id} className="card hover:border-primary-500/50 transition-colors">
                            <div className="card-header flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                                    style={{ backgroundColor: team.color || '#3b82f6' }}
                                >
                                    {team.shortName?.substring(0, 2) || team.name.substring(0, 2)}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">{team.name}</h3>
                                    <p className="text-sm text-slate-400">{team.shortName}</p>
                                </div>
                            </div>
                            <div className="card-body">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-400">Members</span>
                                    <span className="text-white font-medium">
                                        {team.members?.length || 0} drivers
                                    </span>
                                </div>
                                {team.points !== undefined && (
                                    <div className="flex items-center justify-between text-sm mt-2">
                                        <span className="text-slate-400">Points</span>
                                        <span className="text-primary-400 font-bold">
                                            {team.points}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Team Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="card w-full max-w-md">
                        <div className="card-header">
                            <h3 className="font-semibold text-white">Create Team</h3>
                        </div>
                        <div className="card-body space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Team Name
                                </label>
                                <input
                                    type="text"
                                    value={newTeam.name}
                                    onChange={e => setNewTeam({ ...newTeam, name: e.target.value })}
                                    placeholder="e.g., Red Bull Racing"
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Short Name
                                </label>
                                <input
                                    type="text"
                                    value={newTeam.shortName}
                                    onChange={e => setNewTeam({ ...newTeam, shortName: e.target.value })}
                                    placeholder="e.g., RBR"
                                    maxLength={4}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Team Color
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={newTeam.color}
                                        onChange={e => setNewTeam({ ...newTeam, color: e.target.value })}
                                        className="w-12 h-10 rounded border-0 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={newTeam.color}
                                        onChange={e => setNewTeam({ ...newTeam, color: e.target.value })}
                                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="card-footer flex justify-end gap-2">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="btn btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateTeam}
                                className="btn btn-primary"
                            >
                                Create Team
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
