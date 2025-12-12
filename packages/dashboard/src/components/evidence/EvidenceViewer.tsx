// =====================================================================
// Evidence Viewer Component
// Video/replay evidence player for incident review
// =====================================================================

import { useEffect, useRef, useState, type FC } from 'react';
import type { EvidenceAsset, EvidenceKeyMoment, EvidenceSource } from '@controlbox/common';
import { useEvidenceStore } from '../../stores/evidence.store';
import './EvidenceViewer.css';

interface EvidenceViewerProps {
    incidentId?: string;
    caseId?: string;
    protestId?: string;
    /** Auto-generate key moments from incident data */
    incidentTimeMs?: number;
    incidentType?: string;
}

export const EvidenceViewer: FC<EvidenceViewerProps> = ({
    incidentId,
    caseId,
    protestId,
    // incidentTimeMs and incidentType reserved for future key moment generation
}) => {
    const {
        evidence,
        selectedEvidence,
        isLoading,
        error,
        currentTime,
        isPlaying,
        selectedMoment,
        fetchEvidenceForIncident,
        fetchEvidenceForCase,
        fetchEvidenceForProtest,
        selectEvidence,
        setCurrentTime,
        setIsPlaying,
        jumpToMoment,
    } = useEvidenceStore();

    const videoRef = useRef<HTMLVideoElement>(null);
    const [activeSource, setActiveSource] = useState<EvidenceSource>('primary');

    // Fetch evidence on mount
    useEffect(() => {
        if (incidentId) {
            fetchEvidenceForIncident(incidentId);
        } else if (caseId) {
            fetchEvidenceForCase(caseId);
        } else if (protestId) {
            fetchEvidenceForProtest(protestId);
        }
    }, [incidentId, caseId, protestId, fetchEvidenceForIncident, fetchEvidenceForCase, fetchEvidenceForProtest]);

    // Filter evidence by source
    const filteredEvidence = evidence.filter(e => e.source === activeSource);

    // Auto-select first evidence when available
    useEffect(() => {
        if (filteredEvidence.length > 0 && !selectedEvidence) {
            selectEvidence(filteredEvidence[0]);
        }
    }, [filteredEvidence, selectedEvidence, selectEvidence]);

    // Sync video with store time
    useEffect(() => {
        if (videoRef.current && selectedMoment) {
            videoRef.current.currentTime = selectedMoment.offsetSeconds;
        }
    }, [selectedMoment]);

    // Handle video time update
    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    // Handle play/pause
    const handlePlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    // Handle moment jump
    const handleJumpToMoment = (moment: EvidenceKeyMoment) => {
        jumpToMoment(moment);
        if (videoRef.current) {
            videoRef.current.currentTime = moment.offsetSeconds;
        }
    };

    // Source tabs
    const sources: { key: EvidenceSource; label: string }[] = [
        { key: 'primary', label: 'Primary' },
        { key: 'onboard', label: 'Onboard' },
        { key: 'chase', label: 'Chase' },
        { key: 'broadcast', label: 'Broadcast' },
        { key: 'external', label: 'External' },
    ];

    // Get evidence counts by source
    const getSourceCount = (source: EvidenceSource) =>
        evidence.filter(e => e.source === source).length;

    if (isLoading) {
        return (
            <div className="evidence-viewer evidence-viewer--loading">
                <div className="evidence-viewer__loading">
                    <div className="spinner" />
                    <span>Loading evidence...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="evidence-viewer evidence-viewer--error">
                <div className="evidence-viewer__error">
                    <span className="error-icon">⚠️</span>
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    if (evidence.length === 0) {
        return (
            <div className="evidence-viewer evidence-viewer--empty">
                <div className="evidence-viewer__empty">
                    <span className="empty-icon">📹</span>
                    <h4>No Evidence Available</h4>
                    <p>Upload video, add external links, or reference iRacing replays.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="evidence-viewer">
            {/* Source Tabs */}
            <div className="evidence-viewer__tabs">
                {sources.map(({ key, label }) => {
                    const count = getSourceCount(key);
                    return (
                        <button
                            key={key}
                            className={`evidence-tab ${activeSource === key ? 'evidence-tab--active' : ''}`}
                            onClick={() => setActiveSource(key)}
                            disabled={count === 0}
                        >
                            {label}
                            {count > 0 && <span className="evidence-tab__count">{count}</span>}
                        </button>
                    );
                })}
            </div>

            {/* Main Content */}
            <div className="evidence-viewer__content">
                {/* Video Player Area */}
                <div className="evidence-viewer__player">
                    {selectedEvidence ? (
                        <EvidencePlayer
                            evidence={selectedEvidence}
                            videoRef={videoRef}
                            onTimeUpdate={handleTimeUpdate}
                            onPlayPause={handlePlayPause}
                            isPlaying={isPlaying}
                            currentTime={currentTime}
                        />
                    ) : (
                        <div className="evidence-viewer__no-selection">
                            <p>Select evidence from the list below</p>
                        </div>
                    )}
                </div>

                {/* Key Moment Buttons */}
                {selectedEvidence?.keyMoments && selectedEvidence.keyMoments.length > 0 && (
                    <div className="evidence-viewer__moments">
                        <span className="moments-label">Jump to:</span>
                        {selectedEvidence.keyMoments.map((moment) => (
                            <button
                                key={moment.id}
                                className={`moment-btn moment-btn--${moment.type} ${selectedMoment?.id === moment.id ? 'moment-btn--active' : ''}`}
                                onClick={() => handleJumpToMoment(moment)}
                            >
                                {moment.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Evidence List */}
                <div className="evidence-viewer__list">
                    {filteredEvidence.map((ev) => (
                        <button
                            key={ev.id}
                            className={`evidence-item ${selectedEvidence?.id === ev.id ? 'evidence-item--selected' : ''}`}
                            onClick={() => selectEvidence(ev)}
                        >
                            <div className="evidence-item__icon">
                                {ev.type === 'UPLOAD' && '🎥'}
                                {ev.type === 'EXTERNAL_URL' && '🔗'}
                                {ev.type === 'IRACING_REPLAY_REF' && '🏎️'}
                            </div>
                            <div className="evidence-item__info">
                                <div className="evidence-item__title">{ev.title}</div>
                                <div className="evidence-item__meta">
                                    {ev.uploadedByName && <span>by {ev.uploadedByName}</span>}
                                    {ev.upload?.durationSeconds && (
                                        <span>{formatDuration(ev.upload.durationSeconds)}</span>
                                    )}
                                </div>
                            </div>
                            <div className={`evidence-item__assessment evidence-item__assessment--${ev.assessment.toLowerCase()}`}>
                                {ev.assessment}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Evidence Metadata */}
                {selectedEvidence && (
                    <div className="evidence-viewer__metadata">
                        <div className="metadata-row">
                            <span className="metadata-label">Type:</span>
                            <span className="metadata-value">{formatEvidenceType(selectedEvidence.type)}</span>
                        </div>
                        <div className="metadata-row">
                            <span className="metadata-label">Visibility:</span>
                            <span className={`visibility-badge visibility-badge--${selectedEvidence.visibility.toLowerCase()}`}>
                                {formatVisibility(selectedEvidence.visibility)}
                            </span>
                        </div>
                        {selectedEvidence.notes && (
                            <div className="metadata-row metadata-row--notes">
                                <span className="metadata-label">Notes:</span>
                                <span className="metadata-value">{selectedEvidence.notes}</span>
                            </div>
                        )}
                        <div className="metadata-row">
                            <span className="metadata-label">Added:</span>
                            <span className="metadata-value">
                                {new Date(selectedEvidence.createdAt).toLocaleString()}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// =====================================================================
// Evidence Player Sub-component
// =====================================================================

interface EvidencePlayerProps {
    evidence: EvidenceAsset;
    videoRef: React.RefObject<HTMLVideoElement>;
    onTimeUpdate: () => void;
    onPlayPause: () => void;
    isPlaying: boolean;
    currentTime: number;
}

const EvidencePlayer: FC<EvidencePlayerProps> = ({
    evidence,
    videoRef,
    onTimeUpdate,
    onPlayPause,
    isPlaying,
    currentTime,
}) => {
    // Render based on evidence type
    if (evidence.type === 'UPLOAD' && evidence.upload?.signedUrl) {
        return (
            <div className="player-container">
                <video
                    ref={videoRef}
                    src={evidence.upload.signedUrl}
                    controls
                    onTimeUpdate={onTimeUpdate}
                    onPlay={() => { }}
                    onPause={() => { }}
                    className="player-video"
                >
                    Your browser does not support video playback.
                </video>
                <div className="player-controls">
                    <button className="play-btn" onClick={onPlayPause}>
                        {isPlaying ? '⏸️' : '▶️'}
                    </button>
                    <span className="time-display">{formatTime(currentTime)}</span>
                    {evidence.upload.durationSeconds && (
                        <span className="duration">/ {formatTime(evidence.upload.durationSeconds)}</span>
                    )}
                </div>
            </div>
        );
    }

    if (evidence.type === 'EXTERNAL_URL' && evidence.externalUrl) {
        const { url, embedUrl, providerHint } = evidence.externalUrl;

        if (providerHint === 'youtube' && embedUrl) {
            return (
                <div className="player-container player-container--embed">
                    <iframe
                        src={embedUrl}
                        title={evidence.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="player-iframe"
                    />
                </div>
            );
        }

        if (providerHint === 'streamable' && embedUrl) {
            return (
                <div className="player-container player-container--embed">
                    <iframe
                        src={embedUrl}
                        title={evidence.title}
                        allowFullScreen
                        className="player-iframe"
                    />
                </div>
            );
        }

        // Fallback: link to external
        return (
            <div className="player-container player-container--link">
                <div className="external-link">
                    <span className="link-icon">🔗</span>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                        Open in new tab
                    </a>
                    <p className="provider-hint">{providerHint}</p>
                </div>
            </div>
        );
    }

    if (evidence.type === 'IRACING_REPLAY_REF' && evidence.replayRef) {
        const { eventId, lap, corner, timecodeHint, offsetSecondsBefore, offsetSecondsAfter, cameraHint } = evidence.replayRef;

        return (
            <div className="player-container player-container--replay">
                <div className="replay-ref">
                    <div className="replay-ref__icon">🏎️</div>
                    <h4>iRacing Replay Reference</h4>
                    <div className="replay-ref__details">
                        <div className="detail-row">
                            <span>Event ID:</span>
                            <code>{eventId}</code>
                        </div>
                        <div className="detail-row">
                            <span>Lap:</span>
                            <strong>{lap}</strong>
                        </div>
                        {corner && (
                            <div className="detail-row">
                                <span>Corner:</span>
                                <span>{corner}</span>
                            </div>
                        )}
                        {timecodeHint && (
                            <div className="detail-row">
                                <span>Timecode:</span>
                                <code>{timecodeHint}</code>
                            </div>
                        )}
                        <div className="detail-row">
                            <span>View window:</span>
                            <span>-{offsetSecondsBefore}s to +{offsetSecondsAfter}s</span>
                        </div>
                        {cameraHint && (
                            <div className="detail-row">
                                <span>Suggested camera:</span>
                                <span>{cameraHint}</span>
                            </div>
                        )}
                    </div>
                    <p className="replay-ref__note">
                        Open iRacing and load this replay at the specified point.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="player-container player-container--unavailable">
            <p>Evidence preview not available</p>
        </div>
    );
};

// =====================================================================
// Helpers
// =====================================================================

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatEvidenceType(type: string): string {
    switch (type) {
        case 'UPLOAD': return 'Video Upload';
        case 'EXTERNAL_URL': return 'External Link';
        case 'IRACING_REPLAY_REF': return 'iRacing Replay';
        default: return type;
    }
}

function formatVisibility(visibility: string): string {
    switch (visibility) {
        case 'INTERNAL_ONLY': return 'Internal Only';
        case 'STEWARDS_ONLY': return 'Stewards Only';
        case 'LEAGUE_ADMIN': return 'League Admin';
        case 'DRIVER_VISIBLE': return 'Driver Visible';
        default: return visibility;
    }
}
