// =====================================================================
// Advisor Chip Component
// Small indicator badge for incidents with advisor status
// =====================================================================

import React from 'react';
import { useAdvisorStore } from '../stores/advisor.store';

interface AdvisorChipProps {
    incidentId: string;
    onClick?: () => void;
    size?: 'small' | 'medium';
}

export const AdvisorChip: React.FC<AdvisorChipProps> = ({
    incidentId,
    onClick,
    size = 'small'
}) => {
    const { getAdvice, isLoading, hasWarnings } = useAdvisorStore();

    const advice = getAdvice(incidentId);
    const loading = isLoading(incidentId);
    const warnings = hasWarnings(incidentId);

    // Determine chip state
    const hasAdvice = advice.length > 0;

    // Calculate highest confidence
    const highestConfidence = advice.reduce((highest, a) => {
        if (a.confidence === 'HIGH') return 'HIGH';
        if (a.confidence === 'MEDIUM' && highest !== 'HIGH') return 'MEDIUM';
        if (a.confidence === 'LOW' && highest === undefined) return 'LOW';
        return highest;
    }, undefined as 'HIGH' | 'MEDIUM' | 'LOW' | undefined);

    const getChipStyle = (): React.CSSProperties => {
        const baseStyle: React.CSSProperties = {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: size === 'small' ? '2px 6px' : '4px 10px',
            borderRadius: '12px',
            fontSize: size === 'small' ? '11px' : '12px',
            fontWeight: 600,
            cursor: onClick ? 'pointer' : 'default',
            transition: 'all 0.2s',
            gap: '4px',
        };

        if (loading) {
            return {
                ...baseStyle,
                background: 'rgba(107, 114, 128, 0.2)',
                color: '#9ca3af',
                border: '1px solid rgba(107, 114, 128, 0.3)',
            };
        }

        if (!hasAdvice) {
            return {
                ...baseStyle,
                background: 'rgba(107, 114, 128, 0.1)',
                color: '#6b7280',
                border: '1px solid rgba(107, 114, 128, 0.2)',
            };
        }

        if (warnings) {
            return {
                ...baseStyle,
                background: 'rgba(234, 179, 8, 0.2)',
                color: '#eab308',
                border: '1px solid rgba(234, 179, 8, 0.3)',
            };
        }

        // Color by confidence
        const colors = {
            HIGH: { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' },
            MEDIUM: { bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
            LOW: { bg: 'rgba(234, 179, 8, 0.2)', color: '#eab308', border: 'rgba(234, 179, 8, 0.3)' },
        };

        const colorSet = colors[highestConfidence || 'MEDIUM'];
        return {
            ...baseStyle,
            background: colorSet.bg,
            color: colorSet.color,
            border: `1px solid ${colorSet.border}`,
        };
    };

    const getChipContent = () => {
        if (loading) {
            return '⏳';
        }

        if (!hasAdvice) {
            return '–';
        }

        if (warnings) {
            return (
                <>
                    <span>⚠️</span>
                    <span>{advice.length}</span>
                </>
            );
        }

        return (
            <>
                <span>🤖</span>
                <span>{advice.length}</span>
            </>
        );
    };

    const getTooltip = () => {
        if (loading) return 'Loading advisor...';
        if (!hasAdvice) return 'No advice yet';
        if (warnings) return `${advice.length} advice(s) with warnings`;
        return `${advice.length} advisor recommendation(s)`;
    };

    return (
        <span
            style={getChipStyle()}
            onClick={onClick}
            title={getTooltip()}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            {getChipContent()}
        </span>
    );
};

export default AdvisorChip;
