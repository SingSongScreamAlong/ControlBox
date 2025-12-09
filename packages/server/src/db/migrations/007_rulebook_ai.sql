-- =====================================================================
-- Migration 007: Rulebook AI Interpretation
-- Natural-language rulebook parsing sessions
-- =====================================================================

-- Interpretation sessions
CREATE TABLE IF NOT EXISTS rulebook_interpretation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rulebook_id UUID NOT NULL REFERENCES rulebooks(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(10) NOT NULL DEFAULT 'txt',
    source_char_count INTEGER NOT NULL,
    extracted_text TEXT NOT NULL,
    interpreted_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'processing',
    error_message TEXT,
    stats JSONB NOT NULL DEFAULT '{"totalRulesFound": 0, "approved": 0, "rejected": 0, "pending": 0}'::jsonb,
    created_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_interpretation_sessions_rulebook ON rulebook_interpretation_sessions(rulebook_id);
CREATE INDEX IF NOT EXISTS idx_interpretation_sessions_status ON rulebook_interpretation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_interpretation_sessions_created_by ON rulebook_interpretation_sessions(created_by);

-- Updated_at trigger
CREATE TRIGGER update_interpretation_sessions_timestamp
    BEFORE UPDATE ON rulebook_interpretation_sessions
    FOR EACH ROW EXECUTE FUNCTION update_scoring_timestamp();
