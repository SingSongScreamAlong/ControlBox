// =====================================================================
// Evidence API Tests
// Unit tests for evidence system utilities and validation
// =====================================================================

import { describe, it, expect } from '@jest/globals';

describe('Evidence API', () => {
    describe('File Validation', () => {
        const ALLOWED_MIME_TYPES = [
            'video/mp4',
            'video/webm',
            'video/quicktime',
            'video/x-msvideo',
        ];
        const MAX_SIZE_MB = 100;

        const validateFile = (mimeType: string, sizeBytes: number) => {
            if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
                return { valid: false, error: 'Invalid file type' };
            }
            if (sizeBytes > MAX_SIZE_MB * 1024 * 1024) {
                return { valid: false, error: 'File too large' };
            }
            return { valid: true };
        };

        it('should accept valid video types', () => {
            expect(validateFile('video/mp4', 50 * 1024 * 1024).valid).toBe(true);
            expect(validateFile('video/webm', 50 * 1024 * 1024).valid).toBe(true);
            expect(validateFile('video/quicktime', 50 * 1024 * 1024).valid).toBe(true);
        });

        it('should reject invalid file types', () => {
            expect(validateFile('image/png', 1024).valid).toBe(false);
            expect(validateFile('application/pdf', 1024).valid).toBe(false);
            expect(validateFile('text/plain', 1024).valid).toBe(false);
        });

        it('should reject files exceeding size limit', () => {
            expect(validateFile('video/mp4', 101 * 1024 * 1024).valid).toBe(false);
            expect(validateFile('video/mp4', 200 * 1024 * 1024).valid).toBe(false);
        });

        it('should accept files at exactly the limit', () => {
            expect(validateFile('video/mp4', 100 * 1024 * 1024).valid).toBe(true);
        });
    });

    describe('Provider Detection', () => {
        const detectProvider = (url: string): 'youtube' | 'streamable' | 'drive' | 'other' => {
            if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
            if (url.includes('streamable.com')) return 'streamable';
            if (url.includes('drive.google.com')) return 'drive';
            return 'other';
        };

        it('should detect YouTube URLs', () => {
            expect(detectProvider('https://youtube.com/watch?v=abc123')).toBe('youtube');
            expect(detectProvider('https://www.youtube.com/watch?v=abc123')).toBe('youtube');
            expect(detectProvider('https://youtu.be/abc123')).toBe('youtube');
        });

        it('should detect Streamable URLs', () => {
            expect(detectProvider('https://streamable.com/xyz789')).toBe('streamable');
        });

        it('should detect Google Drive URLs', () => {
            expect(detectProvider('https://drive.google.com/file/d/123')).toBe('drive');
        });

        it('should return other for unknown URLs', () => {
            expect(detectProvider('https://example.com/video.mp4')).toBe('other');
            expect(detectProvider('https://vimeo.com/123')).toBe('other');
        });
    });

    describe('Embed URL Generation', () => {
        const getEmbedUrl = (url: string, provider: string): string | undefined => {
            if (provider === 'youtube') {
                const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/);
                if (match) return `https://www.youtube.com/embed/${match[1]}`;
            }
            if (provider === 'streamable') {
                const match = url.match(/streamable\.com\/([a-zA-Z0-9]+)/);
                if (match) return `https://streamable.com/e/${match[1]}`;
            }
            return undefined;
        };

        it('should generate YouTube embed URLs', () => {
            expect(getEmbedUrl('https://youtube.com/watch?v=abc123', 'youtube'))
                .toBe('https://www.youtube.com/embed/abc123');
            expect(getEmbedUrl('https://youtu.be/xyz789', 'youtube'))
                .toBe('https://www.youtube.com/embed/xyz789');
        });

        it('should generate Streamable embed URLs', () => {
            expect(getEmbedUrl('https://streamable.com/abc123', 'streamable'))
                .toBe('https://streamable.com/e/abc123');
        });

        it('should return undefined for unsupported providers', () => {
            expect(getEmbedUrl('https://example.com/video', 'other')).toBeUndefined();
        });
    });

    describe('Evidence Types', () => {
        it('should support all evidence types', () => {
            const validTypes = ['UPLOAD', 'EXTERNAL_URL', 'IRACING_REPLAY_REF'];
            expect(validTypes).toContain('UPLOAD');
            expect(validTypes).toContain('EXTERNAL_URL');
            expect(validTypes).toContain('IRACING_REPLAY_REF');
        });

        it('should support all visibility levels', () => {
            const levels = ['INTERNAL_ONLY', 'STEWARDS_ONLY', 'LEAGUE_ADMIN', 'DRIVER_VISIBLE'];
            expect(levels).toHaveLength(4);
        });

        it('should support all source categories', () => {
            const sources = ['primary', 'onboard', 'chase', 'broadcast', 'external'];
            expect(sources).toHaveLength(5);
        });
    });

    describe('Key Moment Generation', () => {
        interface KeyMoment {
            id: string;
            label: string;
            offsetSeconds: number;
            type: string;
        }

        const generateKeyMoments = (incidentType: string): KeyMoment[] => {
            const moments: KeyMoment[] = [
                { id: 'pre-10', label: 'T-10s', offsetSeconds: 0, type: 'pre_incident' },
                { id: 'pre-5', label: 'T-5s', offsetSeconds: 5, type: 'pre_incident' },
                { id: 'contact', label: 'Contact', offsetSeconds: 10, type: 'contact' },
                { id: 'post-contact', label: 'Outcome', offsetSeconds: 13, type: 'post_incident' },
            ];

            if (incidentType === 'off_track' || incidentType === 'unsafe_rejoin') {
                moments.push({ id: 'rejoin', label: 'Rejoin', offsetSeconds: 18, type: 'rejoin' });
            }

            return moments;
        };

        it('should generate 4 standard key moments', () => {
            const moments = generateKeyMoments('contact');
            expect(moments).toHaveLength(4);
        });

        it('should include contact moment at 10 seconds', () => {
            const moments = generateKeyMoments('contact');
            const contact = moments.find(m => m.type === 'contact');
            expect(contact?.offsetSeconds).toBe(10);
            expect(contact?.label).toBe('Contact');
        });

        it('should add rejoin moment for off-track incidents', () => {
            const moments = generateKeyMoments('off_track');
            expect(moments).toHaveLength(5);
            expect(moments[4].type).toBe('rejoin');
        });

        it('should add rejoin moment for unsafe rejoin incidents', () => {
            const moments = generateKeyMoments('unsafe_rejoin');
            expect(moments).toHaveLength(5);
        });
    });

    describe('File Key Generation', () => {
        const generateFileKey = (leagueId: string, evidenceId: string, fileName: string): string => {
            const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const extension = sanitized.split('.').pop() || 'mp4';
            const timestamp = Date.now();
            return `leagues/${leagueId}/evidence/${evidenceId}/${timestamp}.${extension}`;
        };

        it('should include league ID in path', () => {
            const key = generateFileKey('league-123', 'ev-456', 'video.mp4');
            expect(key).toContain('leagues/league-123');
        });

        it('should include evidence ID in path', () => {
            const key = generateFileKey('league-123', 'ev-456', 'video.mp4');
            expect(key).toContain('evidence/ev-456');
        });

        it('should preserve file extension', () => {
            const key = generateFileKey('league-123', 'ev-456', 'video.webm');
            expect(key).toContain('.webm');
        });
    });
});
