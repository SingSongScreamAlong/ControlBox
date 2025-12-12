// =====================================================================
// Evidence Store
// State management for video/replay evidence
// =====================================================================

import { create } from 'zustand';
import type {
    EvidenceAsset,
    EvidenceSource,
    EvidenceVisibility,
    EvidenceKeyMoment,
} from '@controlbox/common';

interface UploadProgress {
    evidenceId: string;
    fileName: string;
    progress: number;
    status: 'preparing' | 'uploading' | 'processing' | 'complete' | 'error';
    error?: string;
}

interface EvidenceState {
    // Evidence for current context (incident/case/protest)
    evidence: EvidenceAsset[];
    selectedEvidence: EvidenceAsset | null;
    isLoading: boolean;
    error: string | null;

    // Upload tracking
    uploads: UploadProgress[];

    // Playback state
    currentTime: number;
    isPlaying: boolean;
    selectedMoment: EvidenceKeyMoment | null;

    // Actions
    setEvidence: (evidence: EvidenceAsset[]) => void;
    addEvidence: (evidence: EvidenceAsset) => void;
    removeEvidence: (evidenceId: string) => void;
    selectEvidence: (evidence: EvidenceAsset | null) => void;
    updateEvidence: (evidenceId: string, updates: Partial<EvidenceAsset>) => void;

    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;

    // Upload actions
    addUpload: (upload: UploadProgress) => void;
    updateUpload: (evidenceId: string, updates: Partial<UploadProgress>) => void;
    removeUpload: (evidenceId: string) => void;

    // Playback actions
    setCurrentTime: (time: number) => void;
    setIsPlaying: (playing: boolean) => void;
    jumpToMoment: (moment: EvidenceKeyMoment) => void;

    // API methods
    fetchEvidenceForIncident: (incidentId: string) => Promise<void>;
    fetchEvidenceForCase: (caseId: string) => Promise<void>;
    fetchEvidenceForProtest: (protestId: string) => Promise<void>;
    uploadEvidence: (file: File, options: UploadOptions) => Promise<EvidenceAsset | null>;
    addExternalUrl: (url: string, options: ExternalUrlOptions) => Promise<EvidenceAsset | null>;
    addReplayRef: (options: ReplayRefOptions) => Promise<EvidenceAsset | null>;
    deleteEvidence: (evidenceId: string) => Promise<void>;
}

interface UploadOptions {
    title: string;
    source: EvidenceSource;
    visibility?: EvidenceVisibility;
    incidentId?: string;
    caseId?: string;
    protestId?: string;
}

interface ExternalUrlOptions {
    title: string;
    notes?: string;
    source: EvidenceSource;
    visibility?: EvidenceVisibility;
    incidentId?: string;
    caseId?: string;
    protestId?: string;
}

interface ReplayRefOptions {
    title: string;
    notes?: string;
    visibility?: EvidenceVisibility;
    incidentId?: string;
    eventId: string;
    subsessionId?: string;
    lap: number;
    corner?: string;
    timecodeHint?: string;
    offsetSecondsBefore?: number;
    offsetSecondsAfter?: number;
    cameraHint?: string;
}

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || '';

export const useEvidenceStore = create<EvidenceState>((set, get) => ({
    evidence: [],
    selectedEvidence: null,
    isLoading: false,
    error: null,
    uploads: [],
    currentTime: 0,
    isPlaying: false,
    selectedMoment: null,

    // State setters
    setEvidence: (evidence) => set({ evidence }),
    addEvidence: (evidence) => set((state) => ({
        evidence: [evidence, ...state.evidence]
    })),
    removeEvidence: (evidenceId) => set((state) => ({
        evidence: state.evidence.filter(e => e.id !== evidenceId),
        selectedEvidence: state.selectedEvidence?.id === evidenceId ? null : state.selectedEvidence
    })),
    selectEvidence: (evidence) => set({ selectedEvidence: evidence }),
    updateEvidence: (evidenceId, updates) => set((state) => ({
        evidence: state.evidence.map(e => e.id === evidenceId ? { ...e, ...updates } : e),
        selectedEvidence: state.selectedEvidence?.id === evidenceId
            ? { ...state.selectedEvidence, ...updates }
            : state.selectedEvidence
    })),

    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),

    // Upload tracking
    addUpload: (upload) => set((state) => ({
        uploads: [...state.uploads, upload]
    })),
    updateUpload: (evidenceId, updates) => set((state) => ({
        uploads: state.uploads.map(u =>
            u.evidenceId === evidenceId ? { ...u, ...updates } : u
        )
    })),
    removeUpload: (evidenceId) => set((state) => ({
        uploads: state.uploads.filter(u => u.evidenceId !== evidenceId)
    })),

    // Playback
    setCurrentTime: (time) => set({ currentTime: time }),
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    jumpToMoment: (moment) => set({
        selectedMoment: moment,
        currentTime: moment.offsetSeconds
    }),

    // API: Fetch evidence
    fetchEvidenceForIncident: async (incidentId) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/api/evidence/by-incident/${incidentId}`);
            const data = await response.json();
            if (data.success) {
                set({ evidence: data.data, isLoading: false });
            } else {
                set({ error: data.error?.message || 'Failed to fetch evidence', isLoading: false });
            }
        } catch (error) {
            set({ error: 'Failed to fetch evidence', isLoading: false });
        }
    },

    fetchEvidenceForCase: async (caseId) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/api/evidence/by-case/${caseId}`);
            const data = await response.json();
            if (data.success) {
                set({ evidence: data.data, isLoading: false });
            } else {
                set({ error: data.error?.message || 'Failed to fetch evidence', isLoading: false });
            }
        } catch (error) {
            set({ error: 'Failed to fetch evidence', isLoading: false });
        }
    },

    fetchEvidenceForProtest: async (protestId) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/api/evidence/by-protest/${protestId}`);
            const data = await response.json();
            if (data.success) {
                set({ evidence: data.data, isLoading: false });
            } else {
                set({ error: data.error?.message || 'Failed to fetch evidence', isLoading: false });
            }
        } catch (error) {
            set({ error: 'Failed to fetch evidence', isLoading: false });
        }
    },

    // API: Upload file
    uploadEvidence: async (file, options) => {
        const uploadId = `upload-${Date.now()}`;

        try {
            // Add to upload tracking
            get().addUpload({
                evidenceId: uploadId,
                fileName: file.name,
                progress: 0,
                status: 'preparing'
            });

            // Request pre-signed URL
            const uploadResponse = await fetch(`${API_BASE}/api/evidence/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: file.name,
                    mimeType: file.type,
                    sizeBytes: file.size,
                    title: options.title,
                    source: options.source,
                    visibility: options.visibility,
                    incidentId: options.incidentId,
                    caseId: options.caseId,
                    protestId: options.protestId,
                }),
            });

            const uploadData = await uploadResponse.json();
            if (!uploadData.success) {
                throw new Error(uploadData.error?.message || 'Failed to get upload URL');
            }

            const { evidenceId, uploadUrl } = uploadData.data;

            // Update tracking with real evidence ID
            get().updateUpload(uploadId, { evidenceId, status: 'uploading' });

            // Upload file directly to S3
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', uploadUrl);
            xhr.setRequestHeader('Content-Type', file.type);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const progress = Math.round((event.loaded / event.total) * 100);
                    get().updateUpload(uploadId, { progress });
                }
            };

            await new Promise<void>((resolve, reject) => {
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(new Error('Upload failed'));
                    }
                };
                xhr.onerror = () => reject(new Error('Upload failed'));
                xhr.send(file);
            });

            // Notify server upload is complete
            get().updateUpload(uploadId, { status: 'processing', progress: 100 });

            const completeResponse = await fetch(`${API_BASE}/api/evidence/upload/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ evidenceId }),
            });

            const completeData = await completeResponse.json();
            if (!completeData.success) {
                throw new Error('Failed to complete upload');
            }

            // Add to evidence list
            const evidence = completeData.data;
            get().addEvidence(evidence);
            get().updateUpload(uploadId, { status: 'complete' });

            // Remove from tracking after delay
            setTimeout(() => get().removeUpload(uploadId), 3000);

            return evidence;
        } catch (error) {
            get().updateUpload(uploadId, {
                status: 'error',
                error: error instanceof Error ? error.message : 'Upload failed'
            });
            return null;
        }
    },

    // API: Add external URL
    addExternalUrl: async (url, options) => {
        try {
            const response = await fetch(`${API_BASE}/api/evidence/external`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    title: options.title,
                    notes: options.notes,
                    source: options.source,
                    visibility: options.visibility,
                    incidentId: options.incidentId,
                    caseId: options.caseId,
                    protestId: options.protestId,
                }),
            });

            const data = await response.json();
            if (data.success) {
                get().addEvidence(data.data);
                return data.data;
            }
            return null;
        } catch {
            return null;
        }
    },

    // API: Add replay reference
    addReplayRef: async (options) => {
        try {
            const response = await fetch(`${API_BASE}/api/evidence/replay-ref`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(options),
            });

            const data = await response.json();
            if (data.success) {
                get().addEvidence(data.data);
                return data.data;
            }
            return null;
        } catch {
            return null;
        }
    },

    // API: Delete evidence
    deleteEvidence: async (evidenceId) => {
        try {
            await fetch(`${API_BASE}/api/evidence/${evidenceId}`, {
                method: 'DELETE',
            });
            get().removeEvidence(evidenceId);
        } catch {
            // Silent fail
        }
    },
}));

// =====================================================================
// Helper: Generate key moments from incident data
// =====================================================================

export function generateKeyMoments(
    _incidentTimeMs: number,
    incidentType: string
): EvidenceKeyMoment[] {
    const moments: EvidenceKeyMoment[] = [];

    // T-10s (start of clip)
    moments.push({
        id: 'pre-10',
        label: 'T-10s',
        offsetSeconds: 0,
        type: 'pre_incident',
        isAutoGenerated: true,
    });

    // T-5s
    moments.push({
        id: 'pre-5',
        label: 'T-5s',
        offsetSeconds: 5,
        type: 'pre_incident',
        isAutoGenerated: true,
    });

    // Contact moment (at 10s in video)
    moments.push({
        id: 'contact',
        label: 'Contact',
        offsetSeconds: 10,
        type: 'contact',
        isAutoGenerated: true,
    });

    // Post-contact outcome
    moments.push({
        id: 'post-contact',
        label: 'Outcome',
        offsetSeconds: 13,
        type: 'post_incident',
        isAutoGenerated: true,
    });

    // Rejoin (for off-track incidents)
    if (incidentType === 'off_track' || incidentType === 'unsafe_rejoin') {
        moments.push({
            id: 'rejoin',
            label: 'Rejoin',
            offsetSeconds: 18,
            type: 'rejoin',
            isAutoGenerated: true,
        });
    }

    return moments;
}
