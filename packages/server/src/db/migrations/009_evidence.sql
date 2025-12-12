-- =====================================================================
-- Evidence Tables Migration
-- Video/replay evidence for incident review, protests, and appeals
-- =====================================================================

-- Evidence types enum
CREATE TYPE evidence_type AS ENUM ('UPLOAD', 'EXTERNAL_URL', 'IRACING_REPLAY_REF');

-- Evidence visibility enum
CREATE TYPE evidence_visibility AS ENUM ('INTERNAL_ONLY', 'STEWARDS_ONLY', 'LEAGUE_ADMIN', 'DRIVER_VISIBLE');

-- Evidence source categories enum
CREATE TYPE evidence_source AS ENUM ('primary', 'onboard', 'chase', 'broadcast', 'external');

-- Evidence assessment status enum
CREATE TYPE evidence_assessment AS ENUM ('PENDING', 'ACCEPTED', 'NOT_ACCEPTED', 'INSUFFICIENT');

-- Storage provider enum
CREATE TYPE storage_provider AS ENUM ('DO_SPACES', 'S3', 'LOCAL');

-- External URL provider hints
CREATE TYPE url_provider AS ENUM ('youtube', 'streamable', 'drive', 'other');

-- Evidence audit actions
CREATE TYPE evidence_audit_action AS ENUM (
    'UPLOADED',
    'EXTERNAL_ADDED',
    'REPLAY_REF_ADDED',
    'LINKED',
    'UNLINKED',
    'VISIBILITY_CHANGED',
    'ASSESSMENT_CHANGED',
    'DELETED'
);

-- =====================================================================
-- Main Evidence Assets Table
-- =====================================================================

CREATE TABLE IF NOT EXISTS evidence_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type evidence_type NOT NULL,
    owner_league_id UUID NOT NULL,
    uploaded_by_user_id UUID NOT NULL,
    uploaded_by_name VARCHAR(255),
    
    title VARCHAR(500) NOT NULL,
    notes TEXT,
    source evidence_source NOT NULL DEFAULT 'primary',
    visibility evidence_visibility NOT NULL DEFAULT 'STEWARDS_ONLY',
    assessment evidence_assessment NOT NULL DEFAULT 'PENDING',
    assessment_notes TEXT,
    
    -- Key moments stored as JSONB array
    key_moments JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_evidence_assets_league ON evidence_assets(owner_league_id);
CREATE INDEX idx_evidence_assets_uploader ON evidence_assets(uploaded_by_user_id);
CREATE INDEX idx_evidence_assets_type ON evidence_assets(type);
CREATE INDEX idx_evidence_assets_visibility ON evidence_assets(visibility);
CREATE INDEX idx_evidence_assets_created ON evidence_assets(created_at DESC);

-- =====================================================================
-- Evidence Uploads (for file uploads)
-- =====================================================================

CREATE TABLE IF NOT EXISTS evidence_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id UUID NOT NULL REFERENCES evidence_assets(id) ON DELETE CASCADE,
    
    storage_provider storage_provider NOT NULL DEFAULT 'DO_SPACES',
    file_key VARCHAR(1000) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    duration_seconds DECIMAL(10, 2),
    thumbnail_key VARCHAR(1000),
    
    -- Upload status tracking
    upload_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_evidence_uploads_evidence ON evidence_uploads(evidence_id);
CREATE INDEX idx_evidence_uploads_file_key ON evidence_uploads(file_key);

-- =====================================================================
-- Evidence External URLs
-- =====================================================================

CREATE TABLE IF NOT EXISTS evidence_external_urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id UUID NOT NULL REFERENCES evidence_assets(id) ON DELETE CASCADE,
    
    url TEXT NOT NULL,
    provider_hint url_provider NOT NULL DEFAULT 'other',
    embed_url TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_evidence_external_urls_evidence ON evidence_external_urls(evidence_id);

-- =====================================================================
-- Evidence Replay References (iRacing)
-- =====================================================================

CREATE TABLE IF NOT EXISTS evidence_replay_refs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id UUID NOT NULL REFERENCES evidence_assets(id) ON DELETE CASCADE,
    
    sim VARCHAR(50) NOT NULL DEFAULT 'iracing',
    event_id VARCHAR(100) NOT NULL,
    subsession_id VARCHAR(100),
    lap INTEGER NOT NULL,
    corner VARCHAR(100),
    timecode_hint VARCHAR(50),
    offset_seconds_before INTEGER NOT NULL DEFAULT 10,
    offset_seconds_after INTEGER NOT NULL DEFAULT 10,
    camera_hint VARCHAR(100),
    viewing_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_evidence_replay_refs_evidence ON evidence_replay_refs(evidence_id);
CREATE INDEX idx_evidence_replay_refs_event ON evidence_replay_refs(event_id);

-- =====================================================================
-- Evidence Links (junction table for incidents/cases/protests)
-- =====================================================================

CREATE TABLE IF NOT EXISTS evidence_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id UUID NOT NULL REFERENCES evidence_assets(id) ON DELETE CASCADE,
    
    -- Only one of these should be non-null per row
    incident_id UUID,
    case_id UUID,
    protest_id UUID,
    
    linked_by_user_id UUID NOT NULL,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT evidence_links_one_target CHECK (
        (incident_id IS NOT NULL)::int +
        (case_id IS NOT NULL)::int +
        (protest_id IS NOT NULL)::int = 1
    )
);

CREATE INDEX idx_evidence_links_evidence ON evidence_links(evidence_id);
CREATE INDEX idx_evidence_links_incident ON evidence_links(incident_id) WHERE incident_id IS NOT NULL;
CREATE INDEX idx_evidence_links_case ON evidence_links(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX idx_evidence_links_protest ON evidence_links(protest_id) WHERE protest_id IS NOT NULL;

-- Prevent duplicate links
CREATE UNIQUE INDEX idx_evidence_links_unique_incident ON evidence_links(evidence_id, incident_id) WHERE incident_id IS NOT NULL;
CREATE UNIQUE INDEX idx_evidence_links_unique_case ON evidence_links(evidence_id, case_id) WHERE case_id IS NOT NULL;
CREATE UNIQUE INDEX idx_evidence_links_unique_protest ON evidence_links(evidence_id, protest_id) WHERE protest_id IS NOT NULL;

-- =====================================================================
-- Evidence Audit Log
-- =====================================================================

CREATE TABLE IF NOT EXISTS evidence_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id UUID NOT NULL,
    action evidence_audit_action NOT NULL,
    performed_by_user_id UUID NOT NULL,
    performed_by_name VARCHAR(255),
    details JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_audit_log_evidence ON evidence_audit_log(evidence_id);
CREATE INDEX idx_evidence_audit_log_user ON evidence_audit_log(performed_by_user_id);
CREATE INDEX idx_evidence_audit_log_action ON evidence_audit_log(action);
CREATE INDEX idx_evidence_audit_log_timestamp ON evidence_audit_log(timestamp DESC);

-- =====================================================================
-- Trigger to update updated_at on evidence_assets
-- =====================================================================

CREATE OR REPLACE FUNCTION update_evidence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_evidence_updated_at
    BEFORE UPDATE ON evidence_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_evidence_updated_at();
