-- =====================================================================
-- Migration: 004_events_discord.sql
-- Post-Race Upload, Reporting, and Discord Integration
-- =====================================================================

-- Events table (scheduled races, distinct from live sessions)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    track_name VARCHAR(200),
    track_config VARCHAR(100),
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artifact type enum
DO $$ BEGIN
    CREATE TYPE artifact_type AS ENUM ('replay', 'results', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Event artifacts (replay files, results files)
CREATE TABLE IF NOT EXISTS event_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    type artifact_type NOT NULL,
    filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    uploaded_by UUID NOT NULL REFERENCES admin_users(id),
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report status enum
DO $$ BEGIN
    CREATE TYPE report_status AS ENUM ('pending', 'processing', 'ready', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Post-race reports (generated from results)
CREATE TABLE IF NOT EXISTS post_race_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
    status report_status DEFAULT 'pending',
    generated_by UUID REFERENCES admin_users(id),
    summary_json JSONB NOT NULL DEFAULT '{}',
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    error_message TEXT,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discord integration configuration per league
CREATE TABLE IF NOT EXISTS league_discord_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE UNIQUE,
    discord_guild_id VARCHAR(20) NOT NULL,
    announcements_channel_id VARCHAR(20),
    results_channel_id VARCHAR(20),
    race_control_channel_id VARCHAR(20),
    steward_channel_id VARCHAR(20),
    is_enabled BOOLEAN DEFAULT TRUE,
    pre_race_reminder_hours INTEGER DEFAULT 2,
    bot_nickname VARCHAR(100),
    webhook_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discord notification type enum
DO $$ BEGIN
    CREATE TYPE discord_notification_type AS ENUM (
        'pre_race_reminder',
        'session_started', 
        'report_published',
        'penalty_finalized',
        'test_message'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Discord notification log (for debugging/audit)
CREATE TABLE IF NOT EXISTS discord_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    notification_type discord_notification_type NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    message_content TEXT NOT NULL,
    discord_message_id VARCHAR(20),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled reminders tracking (to avoid duplicate sends)
CREATE TABLE IF NOT EXISTS scheduled_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50) NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    notification_id UUID REFERENCES discord_notifications(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, reminder_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_season ON events(season_id);
CREATE INDEX IF NOT EXISTS idx_events_series ON events(series_id);
CREATE INDEX IF NOT EXISTS idx_events_league ON events(league_id);
CREATE INDEX IF NOT EXISTS idx_events_scheduled ON events(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_events_upcoming ON events(scheduled_at) 
    WHERE started_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_artifacts_event ON event_artifacts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_artifacts_type ON event_artifacts(event_id, type);

CREATE INDEX IF NOT EXISTS idx_post_race_reports_event ON post_race_reports(event_id);
CREATE INDEX IF NOT EXISTS idx_post_race_reports_status ON post_race_reports(status);

CREATE INDEX IF NOT EXISTS idx_discord_configs_league ON league_discord_configs(league_id);
CREATE INDEX IF NOT EXISTS idx_discord_configs_guild ON league_discord_configs(discord_guild_id);

CREATE INDEX IF NOT EXISTS idx_discord_notifications_event ON discord_notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_discord_notifications_league ON discord_notifications(league_id);
CREATE INDEX IF NOT EXISTS idx_discord_notifications_sent ON discord_notifications(sent_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_pending ON scheduled_reminders(scheduled_for)
    WHERE sent_at IS NULL;

-- Update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
DO $$ BEGIN
    CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_event_artifacts_updated_at BEFORE UPDATE ON event_artifacts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_post_race_reports_updated_at BEFORE UPDATE ON post_race_reports
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_league_discord_configs_updated_at BEFORE UPDATE ON league_discord_configs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =====================================================================
-- Comments for documentation
-- =====================================================================

COMMENT ON TABLE events IS 'Scheduled race events within a season';
COMMENT ON TABLE event_artifacts IS 'Uploaded files (replays, results) for events';
COMMENT ON TABLE post_race_reports IS 'Generated reports from race results';
COMMENT ON TABLE league_discord_configs IS 'Discord integration settings per league';
COMMENT ON TABLE discord_notifications IS 'Log of all Discord messages sent';
COMMENT ON TABLE scheduled_reminders IS 'Tracks scheduled pre-race reminders';

COMMENT ON COLUMN events.session_id IS 'Link to live ControlBox session if tracked';
COMMENT ON COLUMN event_artifacts.storage_path IS 'Path in object storage (DO Spaces/S3)';
COMMENT ON COLUMN post_race_reports.summary_json IS 'Structured report data (finishing order, penalties, stats)';
COMMENT ON COLUMN league_discord_configs.webhook_url IS 'Optional webhook for simpler integration';
