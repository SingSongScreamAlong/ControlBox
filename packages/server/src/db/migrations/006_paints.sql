-- =====================================================================
-- Migration 006: Paint/Livery Management
-- Driver paint submissions, approval workflow
-- =====================================================================

-- Paint submissions
CREATE TABLE IF NOT EXISTS paint_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    driver_id VARCHAR(100) NOT NULL,
    driver_name VARCHAR(200) NOT NULL,
    car_number VARCHAR(10),
    -- Paint sources
    trading_paints_url VARCHAR(500),
    custom_file_path VARCHAR(500),
    -- Colors for overlays
    primary_color VARCHAR(7),  -- Hex: #FF0000
    secondary_color VARCHAR(7),
    accent_color VARCHAR(7),
    -- Team branding
    team_name VARCHAR(200),
    team_logo_url VARCHAR(500),
    -- Approval workflow
    status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected, revision_needed
    admin_notes TEXT,
    reviewed_by UUID REFERENCES admin_users(id),
    reviewed_at TIMESTAMPTZ,
    -- Metadata
    season_id UUID REFERENCES seasons(id),
    is_official BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_paint_submissions_series ON paint_submissions(series_id);
CREATE INDEX IF NOT EXISTS idx_paint_submissions_league ON paint_submissions(league_id);
CREATE INDEX IF NOT EXISTS idx_paint_submissions_driver ON paint_submissions(driver_id);
CREATE INDEX IF NOT EXISTS idx_paint_submissions_status ON paint_submissions(status);

-- Updated_at trigger
CREATE TRIGGER update_paint_submissions_timestamp
    BEFORE UPDATE ON paint_submissions
    FOR EACH ROW EXECUTE FUNCTION update_scoring_timestamp();
