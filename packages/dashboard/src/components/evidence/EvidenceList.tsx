// =====================================================================
// Evidence List Component
// Compact list view for Steward Case Manager
// =====================================================================

import { type FC } from 'react';
import type { EvidenceAsset } from '@controlbox/common';
import './EvidenceList.css';

interface EvidenceListProps {
    evidence: EvidenceAsset[];
    selectedId?: string;
    onSelect?: (evidence: EvidenceAsset) => void;
    onDelete?: (evidenceId: string) => void;
    compact?: boolean;
}

export const EvidenceList: FC<EvidenceListProps> = ({
    evidence,
    selectedId,
    onSelect,
    onDelete,
    compact = false,
}) => {
    if (evidence.length === 0) {
        return (
            <div className="evidence-list evidence-list--empty">
                <span className="empty-icon">📹</span>
                <span>No evidence attached</span>
            </div>
        );
    }

    return (
        <div className={`evidence-list ${compact ? 'evidence-list--compact' : ''}`}>
            {evidence.map((ev) => (
                <div
                    key={ev.id}
                    className={`evidence-list-item ${selectedId === ev.id ? 'evidence-list-item--selected' : ''}`}
                    onClick={() => onSelect?.(ev)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onSelect?.(ev)}
                >
                    <div className="evidence-list-item__icon">
                        {getTypeIcon(ev.type)}
                    </div>

                    <div className="evidence-list-item__content">
                        <div className="evidence-list-item__title">{ev.title}</div>
                        {!compact && (
                            <div className="evidence-list-item__meta">
                                <span className="type-badge">{getTypeLabel(ev.type)}</span>
                                <span className="source-badge">{ev.source}</span>
                                {ev.upload?.durationSeconds && (
                                    <span className="duration">{formatDuration(ev.upload.durationSeconds)}</span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="evidence-list-item__actions">
                        <span className={`assessment-dot assessment-dot--${ev.assessment.toLowerCase()}`} />
                        {onDelete && (
                            <button
                                className="delete-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(ev.id);
                                }}
                                title="Remove evidence"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

// =====================================================================
// Evidence Badge Component (for Case Manager column)
// =====================================================================

interface EvidenceBadgeProps {
    count: number;
    hasVideo?: boolean;
    hasUrl?: boolean;
    hasReplay?: boolean;
    onClick?: () => void;
}

export const EvidenceBadge: FC<EvidenceBadgeProps> = ({
    count,
    hasVideo,
    hasUrl,
    hasReplay,
    onClick,
}) => {
    if (count === 0) {
        return <span className="evidence-badge evidence-badge--empty">—</span>;
    }

    return (
        <button className="evidence-badge" onClick={onClick} title={`${count} evidence item(s)`}>
            <span className="evidence-badge__count">{count}</span>
            <span className="evidence-badge__icons">
                {hasVideo && <span>🎥</span>}
                {hasUrl && <span>🔗</span>}
                {hasReplay && <span>🏎️</span>}
            </span>
        </button>
    );
};

// =====================================================================
// Helpers
// =====================================================================

function getTypeIcon(type: string): string {
    switch (type) {
        case 'UPLOAD': return '🎥';
        case 'EXTERNAL_URL': return '🔗';
        case 'IRACING_REPLAY_REF': return '🏎️';
        default: return '📄';
    }
}

function getTypeLabel(type: string): string {
    switch (type) {
        case 'UPLOAD': return 'Video';
        case 'EXTERNAL_URL': return 'Link';
        case 'IRACING_REPLAY_REF': return 'Replay';
        default: return type;
    }
}

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
