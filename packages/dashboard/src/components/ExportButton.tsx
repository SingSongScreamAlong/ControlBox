// =====================================================================
// Export Button Component
// Download PDF or CSV exports
// =====================================================================

import { useState } from 'react';
import { useAuthStore } from '../stores/auth.store';

interface ExportButtonProps {
    type: 'bulletin' | 'incident' | 'motec';
    id: string;
    label?: string;
    className?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

export function ExportButton({ type, id, label, className = '' }: ExportButtonProps) {
    const { accessToken } = useAuthStore();
    const [downloading, setDownloading] = useState(false);

    const getEndpoint = () => {
        switch (type) {
            case 'bulletin': return `/api/export/bulletin/${id}`;
            case 'incident': return `/api/export/incident/${id}`;
            case 'motec': return `/api/export/motec/${id}`;
        }
    };

    const getFilename = () => {
        switch (type) {
            case 'bulletin': return `steward-bulletin-${id.slice(0, 8)}.pdf`;
            case 'incident': return `incident-${id.slice(0, 8)}.pdf`;
            case 'motec': return `telemetry-${id.slice(0, 8)}.csv`;
        }
    };

    const getMimeType = () => {
        return type === 'motec' ? 'text/csv' : 'application/pdf';
    };

    const getDefaultLabel = () => {
        switch (type) {
            case 'bulletin': return 'Download Bulletin';
            case 'incident': return 'Export PDF';
            case 'motec': return 'Export to MoTeC';
        }
    };

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const res = await fetch(`${API_BASE}${getEndpoint()}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (!res.ok) {
                throw new Error('Download failed');
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(new Blob([blob], { type: getMimeType() }));
            const link = document.createElement('a');
            link.href = url;
            link.download = getFilename();
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download error:', err);
            alert('Failed to download file');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <button
            onClick={handleDownload}
            disabled={downloading}
            className={`inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white rounded-lg transition-colors ${className}`}
        >
            {downloading ? (
                <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Downloading...</span>
                </>
            ) : (
                <>
                    <span>{type === 'motec' ? '📊' : '📄'}</span>
                    <span>{label || getDefaultLabel()}</span>
                </>
            )}
        </button>
    );
}

export default ExportButton;
