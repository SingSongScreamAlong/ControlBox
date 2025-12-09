// =====================================================================
// Events Page
// Season events list with status and actions
// =====================================================================

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useEventsStore } from '../stores/events.store';

export function EventsPage() {
    const { seasonId } = useParams<{ seasonId: string }>();
    const { events, isLoading, error, fetchEvents, createEvent } = useEventsStore();
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        if (seasonId) {
            fetchEvents(seasonId);
        }
    }, [seasonId, fetchEvents]);

    const getEventStatus = (event: typeof events[0]) => {
        if (event.endedAt) return { label: 'Completed', color: 'bg-green-500' };
        if (event.startedAt) return { label: 'In Progress', color: 'bg-yellow-500 animate-pulse' };
        const now = new Date();
        const scheduled = new Date(event.scheduledAt);
        if (scheduled < now) return { label: 'Overdue', color: 'bg-red-500' };
        return { label: 'Scheduled', color: 'bg-blue-500' };
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Events</h1>
                    <p className="text-slate-400">Manage scheduled races and results</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                >
                    + New Event
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
                    {error}
                </div>
            )}

            {/* Events List */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-700/50">
                            <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Event</th>
                            <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Track</th>
                            <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Date</th>
                            <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Status</th>
                            <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    No events scheduled. Create one to get started.
                                </td>
                            </tr>
                        ) : (
                            events.map(event => {
                                const status = getEventStatus(event);
                                return (
                                    <tr key={event.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                                        <td className="px-6 py-4">
                                            <Link
                                                to={`/events/${event.id}`}
                                                className="text-white font-medium hover:text-primary-400 transition-colors"
                                            >
                                                {event.name}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">
                                            {event.trackName || '—'}
                                            {event.trackConfig && (
                                                <span className="text-slate-500 ml-1">({event.trackConfig})</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">
                                            {formatDate(event.scheduledAt)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium text-white ${status.color}`}>
                                                <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                to={`/events/${event.id}`}
                                                className="text-primary-400 hover:text-primary-300 text-sm"
                                            >
                                                View Details →
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <CreateEventModal
                    seasonId={seasonId!}
                    onClose={() => setShowCreateModal(false)}
                    onCreate={createEvent}
                />
            )}
        </div>
    );
}

interface CreateEventModalProps {
    seasonId: string;
    onClose: () => void;
    onCreate: (seasonId: string, data: { name: string; scheduledAt: string; trackName?: string; trackConfig?: string }) => Promise<unknown>;
}

function CreateEventModal({ seasonId, onClose, onCreate }: CreateEventModalProps) {
    const [name, setName] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [trackName, setTrackName] = useState('');
    const [trackConfig, setTrackConfig] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !scheduledAt) return;

        setIsSubmitting(true);
        await onCreate(seasonId, {
            name,
            scheduledAt: new Date(scheduledAt).toISOString(),
            trackName: trackName || undefined,
            trackConfig: trackConfig || undefined
        });
        setIsSubmitting(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
                <h2 className="text-xl font-bold text-white mb-4">Create Event</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Event Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Round 1 – Daytona"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Scheduled Date/Time *</label>
                        <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={e => setScheduledAt(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Track Name</label>
                        <input
                            type="text"
                            value={trackName}
                            onChange={e => setTrackName(e.target.value)}
                            placeholder="Daytona International Speedway"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Track Config</label>
                        <input
                            type="text"
                            value={trackConfig}
                            onChange={e => setTrackConfig(e.target.value)}
                            placeholder="Oval"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !name || !scheduledAt}
                            className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
                        >
                            {isSubmitting ? 'Creating...' : 'Create Event'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
