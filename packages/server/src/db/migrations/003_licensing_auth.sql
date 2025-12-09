-- =====================================================================
-- ControlBox Database Schema - Licensing & Auth Migration
-- Migration: 003_licensing_auth.sql
-- =====================================================================

-- ========================
-- Series Table
-- ========================

CREATE TABLE IF NOT EXISTS series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Discipline settings for this series
    default_discipline VARCHAR(50),
    default_profile_id UUID REFERENCES discipline_profiles(id),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(league_id, name)
);

-- ========================
-- Seasons Table
-- ========================

CREATE TABLE IF NOT EXISTS seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Optional rulebook override for this season
    rulebook_id UUID REFERENCES rulebooks(id),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(series_id, name),
    CHECK (end_date > start_date)
);

-- ========================
-- Licenses Table
-- ========================

CREATE TYPE license_status AS ENUM ('pending', 'active', 'expired', 'suspended');

CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    
    status license_status DEFAULT 'pending',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Optional license metadata
    notes TEXT,
    max_concurrent_sessions INTEGER DEFAULT 1,
    features JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Only one license per season
    UNIQUE(season_id),
    CHECK (end_date >= start_date)
);

-- ========================
-- Admin Users Table
-- ========================

CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    
    -- Platform-level admin (can manage all leagues)
    is_super_admin BOOLEAN DEFAULT false,
    
    -- Account status
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMPTZ,
    
    -- Password reset
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Admin User League Roles
-- ========================

CREATE TYPE admin_role AS ENUM ('Owner', 'RaceControl', 'Steward', 'Broadcaster', 'ReadOnly');

CREATE TABLE IF NOT EXISTS admin_user_league_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    
    -- Optional scoping to series/season (null = entire league)
    series_id UUID REFERENCES series(id) ON DELETE CASCADE,
    season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
    
    role admin_role NOT NULL,
    
    -- Role metadata
    granted_by UUID REFERENCES admin_users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate role assignments
    UNIQUE(admin_user_id, league_id, series_id, season_id, role)
);

-- ========================
-- iRacing Account Links (Stub)
-- ========================

CREATE TABLE IF NOT EXISTS iracing_account_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    
    iracing_customer_id VARCHAR(50) NOT NULL,
    iracing_display_name VARCHAR(255),
    
    verified_at TIMESTAMPTZ,
    verification_method VARCHAR(50), -- 'manual', 'oauth', etc.
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(admin_user_id, iracing_customer_id)
);

-- ========================
-- Refresh Tokens Table
-- ========================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    
    -- Client metadata
    user_agent TEXT,
    ip_address VARCHAR(45),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Update Sessions Table
-- ========================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES series(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS license_id UUID REFERENCES licenses(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES admin_users(id);

-- ========================
-- Update Leagues Table
-- ========================

-- Add owner reference if not exists
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES admin_users(id);

-- ========================
-- Indexes
-- ========================

CREATE INDEX IF NOT EXISTS idx_series_league ON series(league_id);
CREATE INDEX IF NOT EXISTS idx_series_active ON series(is_active);
CREATE INDEX IF NOT EXISTS idx_seasons_league ON seasons(league_id);
CREATE INDEX IF NOT EXISTS idx_seasons_series ON seasons(series_id);
CREATE INDEX IF NOT EXISTS idx_seasons_dates ON seasons(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_licenses_league ON licenses(league_id);
CREATE INDEX IF NOT EXISTS idx_licenses_season ON licenses(season_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_dates ON licenses(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_roles_user ON admin_user_league_roles(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_league ON admin_user_league_roles(league_id);
CREATE INDEX IF NOT EXISTS idx_iracing_links_user ON iracing_account_links(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_series ON sessions(series_id);
CREATE INDEX IF NOT EXISTS idx_sessions_season ON sessions(season_id);
CREATE INDEX IF NOT EXISTS idx_sessions_license ON sessions(license_id);

-- ========================
-- Seed Default Super Admin
-- ========================
-- Password: 'controlbox-admin' (bcrypt hash)
-- In production, change this immediately!

INSERT INTO admin_users (id, email, password_hash, display_name, is_super_admin, is_active, email_verified)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@controlbox.local',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X.i.1/LMdA7YPXK6e', -- 'controlbox-admin'
    'System Admin',
    true,
    true,
    true
) ON CONFLICT (email) DO NOTHING;
