-- =====================================================================
-- ControlBox Database Schema - Protests, Appeals, Voting, Teams, Audit
-- Migration: 008_protests_appeals.sql
-- =====================================================================

-- ========================
-- Protest Status Enum
-- ========================

DO $$ BEGIN
    CREATE TYPE protest_status AS ENUM ('submitted', 'under_review', 'upheld', 'rejected', 'withdrawn');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE appeal_status AS ENUM ('submitted', 'under_review', 'granted', 'denied', 'withdrawn');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ========================
-- Protests Table
-- ========================

CREATE TABLE IF NOT EXISTS protests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
    penalty_id UUID,
    
    -- Submitter info
    submitted_by_driver_id UUID NOT NULL,
    submitted_by_name VARCHAR(255) NOT NULL,
    submitted_by_email VARCHAR(255),
    
    -- Protest details
    status protest_status DEFAULT 'submitted',
    grounds TEXT NOT NULL,
    evidence_urls TEXT[],
    
    -- Resolution
    steward_notes TEXT,
    resolution TEXT,
    resolved_by UUID REFERENCES admin_users(id),
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Appeals Table
-- ========================

CREATE TABLE IF NOT EXISTS appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    protest_id UUID REFERENCES protests(id) ON DELETE SET NULL,
    original_penalty_id UUID,
    
    -- Submitter
    submitted_by UUID NOT NULL,
    submitted_by_name VARCHAR(255),
    
    -- Appeal details
    status appeal_status DEFAULT 'submitted',
    grounds TEXT NOT NULL,
    new_evidence TEXT[],
    
    -- Resolution
    panel_notes TEXT,
    final_ruling TEXT,
    new_penalty_id UUID,
    resolved_by UUID REFERENCES admin_users(id),
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Steward Panels (Voting)
-- ========================

DO $$ BEGIN
    CREATE TYPE panel_status AS ENUM ('voting', 'closed', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE decision_method AS ENUM ('majority', 'unanimous', 'chair_decides');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS steward_panels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
    protest_id UUID REFERENCES protests(id) ON DELETE SET NULL,
    appeal_id UUID REFERENCES appeals(id) ON DELETE SET NULL,
    
    -- Panel configuration
    required_votes INTEGER DEFAULT 3,
    decision_method decision_method DEFAULT 'majority',
    status panel_status DEFAULT 'voting',
    
    -- Outcome
    final_decision VARCHAR(100),
    decision_rationale TEXT,
    
    -- Timing
    voting_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- ========================
-- Steward Votes
-- ========================

DO $$ BEGIN
    CREATE TYPE vote_decision AS ENUM ('penalty', 'warning', 'reprimand', 'no_action', 'dismiss', 'uphold', 'reject');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS steward_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    panel_id UUID NOT NULL REFERENCES steward_panels(id) ON DELETE CASCADE,
    steward_id UUID NOT NULL REFERENCES admin_users(id),
    
    vote vote_decision NOT NULL,
    reasoning TEXT,
    is_dissent BOOLEAN DEFAULT false,
    
    voted_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(panel_id, steward_id)
);

-- ========================
-- Teams Table
-- ========================

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(50),
    color VARCHAR(7),
    logo_url TEXT,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(league_id, name)
);

-- Add team reference to drivers/entries
ALTER TABLE drivers_entries ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- ========================
-- Audit Log
-- ========================

DO $$ BEGIN
    CREATE TYPE audit_action AS ENUM (
        'create', 'update', 'delete',
        'penalty_issued', 'penalty_revoked',
        'protest_submitted', 'protest_resolved',
        'appeal_submitted', 'appeal_resolved',
        'vote_cast', 'panel_closed',
        'rulebook_updated', 'rule_added', 'rule_deleted',
        'session_started', 'session_ended',
        'login', 'logout'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who did it
    actor_id UUID REFERENCES admin_users(id),
    actor_email VARCHAR(255),
    actor_ip VARCHAR(45),
    
    -- What happened
    action audit_action NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    
    -- Change details
    description TEXT,
    old_value JSONB,
    new_value JSONB,
    
    -- Metadata
    user_agent TEXT,
    league_id UUID REFERENCES leagues(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Notification Preferences
-- ========================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Either admin user or driver
    user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    driver_email VARCHAR(255),
    
    -- Preferences
    notify_penalties BOOLEAN DEFAULT true,
    notify_protests BOOLEAN DEFAULT true,
    notify_appeals BOOLEAN DEFAULT true,
    notify_events BOOLEAN DEFAULT true,
    notify_results BOOLEAN DEFAULT true,
    
    -- Channels
    email_enabled BOOLEAN DEFAULT true,
    discord_enabled BOOLEAN DEFAULT false,
    discord_user_id VARCHAR(100),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Email Log
-- ========================

CREATE TABLE IF NOT EXISTS email_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    
    subject VARCHAR(500) NOT NULL,
    template VARCHAR(100),
    body_preview TEXT,
    
    status VARCHAR(50) DEFAULT 'sent',
    error_message TEXT,
    
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Indexes
-- ========================

CREATE INDEX IF NOT EXISTS idx_protests_league ON protests(league_id);
CREATE INDEX IF NOT EXISTS idx_protests_status ON protests(status);
CREATE INDEX IF NOT EXISTS idx_protests_incident ON protests(incident_id);
CREATE INDEX IF NOT EXISTS idx_appeals_league ON appeals(league_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);
CREATE INDEX IF NOT EXISTS idx_panels_league ON steward_panels(league_id);
CREATE INDEX IF NOT EXISTS idx_panels_status ON steward_panels(status);
CREATE INDEX IF NOT EXISTS idx_votes_panel ON steward_votes(panel_id);
CREATE INDEX IF NOT EXISTS idx_teams_league ON teams(league_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_email_log_recipient ON email_log(recipient_email);
