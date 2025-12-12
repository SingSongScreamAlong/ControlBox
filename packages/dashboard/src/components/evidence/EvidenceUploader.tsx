// =====================================================================
// Evidence Uploader Component
// Drag-and-drop upload, external URLs, and replay references
// =====================================================================

import { useState, useCallback, type FC, type ChangeEvent, type DragEvent } from 'react';
import type { EvidenceSource, EvidenceVisibility } from '@controlbox/common';
import { useEvidenceStore } from '../../stores/evidence.store';
import './EvidenceUploader.css';

interface EvidenceUploaderProps {
    incidentId?: string;
    caseId?: string;
    protestId?: string;
    onClose?: () => void;
}

type UploadMode = 'file' | 'url' | 'replay';

export const EvidenceUploader: FC<EvidenceUploaderProps> = ({
    incidentId,
    caseId,
    protestId,
    onClose,
}) => {
    const { uploads, uploadEvidence, addExternalUrl, addReplayRef } = useEvidenceStore();

    const [mode, setMode] = useState<UploadMode>('file');
    const [isDragging, setIsDragging] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [source, setSource] = useState<EvidenceSource>('primary');
    const [visibility, setVisibility] = useState<EvidenceVisibility>('STEWARDS_ONLY');

    // External URL state
    const [externalUrl, setExternalUrl] = useState('');

    // Replay ref state
    const [eventId, setEventId] = useState('');
    const [lap, setLap] = useState('');
    const [corner, setCorner] = useState('');
    const [timecodeHint, setTimecodeHint] = useState('');
    const [cameraHint, setCameraHint] = useState('');

    // Handle file drop
    const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        const videoFile = files.find(f => f.type.startsWith('video/'));

        if (videoFile) {
            handleFileUpload(videoFile);
        }
    }, []);

    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Handle file input change
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileUpload(file);
        }
    };

    // Upload file
    const handleFileUpload = async (file: File) => {
        if (!title) {
            setTitle(file.name.replace(/\.[^.]+$/, ''));
        }

        const result = await uploadEvidence(file, {
            title: title || file.name.replace(/\.[^.]+$/, ''),
            source,
            visibility,
            incidentId,
            caseId,
            protestId,
        });

        if (result) {
            resetForm();
            onClose?.();
        }
    };

    // Add external URL
    const handleAddUrl = async () => {
        if (!externalUrl || !title) return;

        const result = await addExternalUrl(externalUrl, {
            title,
            notes,
            source,
            visibility,
            incidentId,
            caseId,
            protestId,
        });

        if (result) {
            resetForm();
            onClose?.();
        }
    };

    // Add replay reference
    const handleAddReplayRef = async () => {
        if (!eventId || !lap || !title) return;

        const result = await addReplayRef({
            title,
            notes,
            visibility,
            incidentId,
            eventId,
            lap: parseInt(lap),
            corner: corner || undefined,
            timecodeHint: timecodeHint || undefined,
            cameraHint: cameraHint || undefined,
        });

        if (result) {
            resetForm();
            onClose?.();
        }
    };

    const resetForm = () => {
        setTitle('');
        setNotes('');
        setExternalUrl('');
        setEventId('');
        setLap('');
        setCorner('');
        setTimecodeHint('');
        setCameraHint('');
    };

    // Active uploads
    const activeUploads = uploads.filter(u => u.status !== 'complete');

    return (
        <div className="evidence-uploader">
            {/* Mode Tabs */}
            <div className="uploader-tabs">
                <button
                    className={`uploader-tab ${mode === 'file' ? 'uploader-tab--active' : ''}`}
                    onClick={() => setMode('file')}
                >
                    📹 Upload Video
                </button>
                <button
                    className={`uploader-tab ${mode === 'url' ? 'uploader-tab--active' : ''}`}
                    onClick={() => setMode('url')}
                >
                    🔗 External Link
                </button>
                <button
                    className={`uploader-tab ${mode === 'replay' ? 'uploader-tab--active' : ''}`}
                    onClick={() => setMode('replay')}
                >
                    🏎️ Replay Reference
                </button>
            </div>

            {/* Common Fields */}
            <div className="uploader-form">
                <div className="form-row">
                    <label>Title *</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Evidence title"
                        className="form-input"
                    />
                </div>

                <div className="form-row form-row--inline">
                    <div>
                        <label>Source</label>
                        <select
                            value={source}
                            onChange={(e) => setSource(e.target.value as EvidenceSource)}
                            className="form-input"
                        >
                            <option value="primary">Primary</option>
                            <option value="onboard">Onboard</option>
                            <option value="chase">Chase</option>
                            <option value="broadcast">Broadcast</option>
                            <option value="external">External</option>
                        </select>
                    </div>
                    <div>
                        <label>Visibility</label>
                        <select
                            value={visibility}
                            onChange={(e) => setVisibility(e.target.value as EvidenceVisibility)}
                            className="form-input"
                        >
                            <option value="STEWARDS_ONLY">Stewards Only</option>
                            <option value="LEAGUE_ADMIN">League Admin</option>
                            <option value="DRIVER_VISIBLE">Driver Visible</option>
                        </select>
                    </div>
                </div>

                {/* File Upload Mode */}
                {mode === 'file' && (
                    <div
                        className={`dropzone ${isDragging ? 'dropzone--dragging' : ''}`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                    >
                        <div className="dropzone-content">
                            <div className="dropzone-icon">📁</div>
                            <p>Drag & drop video file here</p>
                            <span className="dropzone-divider">or</span>
                            <label className="file-input-label">
                                Browse Files
                                <input
                                    type="file"
                                    accept="video/*"
                                    onChange={handleFileChange}
                                    className="file-input"
                                />
                            </label>
                            <p className="dropzone-hint">MP4, WebM • Max 100MB</p>
                        </div>
                    </div>
                )}

                {/* External URL Mode */}
                {mode === 'url' && (
                    <>
                        <div className="form-row">
                            <label>URL *</label>
                            <input
                                type="url"
                                value={externalUrl}
                                onChange={(e) => setExternalUrl(e.target.value)}
                                placeholder="https://youtube.com/watch?v=..."
                                className="form-input"
                            />
                        </div>
                        <div className="form-row">
                            <label>Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Additional context..."
                                className="form-input"
                                rows={3}
                            />
                        </div>
                        <button
                            className="submit-btn"
                            onClick={handleAddUrl}
                            disabled={!externalUrl || !title}
                        >
                            Add External Link
                        </button>
                    </>
                )}

                {/* Replay Reference Mode */}
                {mode === 'replay' && (
                    <>
                        <div className="form-row form-row--inline">
                            <div>
                                <label>Event/Session ID *</label>
                                <input
                                    type="text"
                                    value={eventId}
                                    onChange={(e) => setEventId(e.target.value)}
                                    placeholder="12345678"
                                    className="form-input"
                                />
                            </div>
                            <div>
                                <label>Lap *</label>
                                <input
                                    type="number"
                                    value={lap}
                                    onChange={(e) => setLap(e.target.value)}
                                    placeholder="15"
                                    className="form-input"
                                />
                            </div>
                        </div>
                        <div className="form-row form-row--inline">
                            <div>
                                <label>Corner/Sector</label>
                                <input
                                    type="text"
                                    value={corner}
                                    onChange={(e) => setCorner(e.target.value)}
                                    placeholder="T1"
                                    className="form-input"
                                />
                            </div>
                            <div>
                                <label>Timecode</label>
                                <input
                                    type="text"
                                    value={timecodeHint}
                                    onChange={(e) => setTimecodeHint(e.target.value)}
                                    placeholder="0:45:23"
                                    className="form-input"
                                />
                            </div>
                        </div>
                        <div className="form-row">
                            <label>Suggested Camera</label>
                            <input
                                type="text"
                                value={cameraHint}
                                onChange={(e) => setCameraHint(e.target.value)}
                                placeholder="TV1, Onboard, Chase"
                                className="form-input"
                            />
                        </div>
                        <div className="form-row">
                            <label>Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Additional viewing instructions..."
                                className="form-input"
                                rows={2}
                            />
                        </div>
                        <button
                            className="submit-btn"
                            onClick={handleAddReplayRef}
                            disabled={!eventId || !lap || !title}
                        >
                            Add Replay Reference
                        </button>
                    </>
                )}
            </div>

            {/* Active Uploads */}
            {activeUploads.length > 0 && (
                <div className="upload-progress-list">
                    {activeUploads.map((upload) => (
                        <div key={upload.evidenceId} className="upload-progress-item">
                            <div className="upload-info">
                                <span className="upload-filename">{upload.fileName}</span>
                                <span className="upload-status">{upload.status}</span>
                            </div>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${upload.progress}%` }}
                                />
                            </div>
                            {upload.error && (
                                <span className="upload-error">{upload.error}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
