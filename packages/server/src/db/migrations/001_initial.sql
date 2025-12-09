-- =====================================================================
-- ControlBox Database Schema - Initial Migration
-- =====================================================================

-- Session tracking
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    sim_type VARCHAR(50) DEFAULT 'iracing',
    track_name VARCHAR(255),
    track_config VARCHAR(255),
    session_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drivers in a session
CREATE TABLE IF NOT EXISTS session_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    driver_id VARCHAR(255),
    driver_name VARCHAR(255),
    car_number VARCHAR(10),
    car_name VARCHAR(255),
    team_name VARCHAR(255),
    irating INTEGER,
    safety_rating DECIMAL(4,2),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    UNIQUE(session_id, driver_id)
);

-- Detected incidents
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    incident_type VARCHAR(50),
    contact_type VARCHAR(50),
    severity VARCHAR(20),
    severity_score DECIMAL(5,2),
    lap_number INTEGER,
    session_time_ms BIGINT,
    track_position DECIMAL(7,4),
    corner_name VARCHAR(100),
    involved_drivers JSONB DEFAULT '[]',
    fault_attribution JSONB DEFAULT '{}',
    ai_recommendation VARCHAR(50),
    ai_confidence DECIMAL(4,3),
    ai_reasoning TEXT,
    telemetry_snapshot JSONB DEFAULT '{}',
    replay_timestamp_ms BIGINT,
    status VARCHAR(50) DEFAULT 'pending',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    steward_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rulebooks
CREATE TABLE IF NOT EXISTS rulebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    league_name VARCHAR(255),
    version VARCHAR(50),
    description TEXT,
    rules JSONB NOT NULL,
    penalty_matrix JSONB NOT NULL,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Penalties
CREATE TABLE IF NOT EXISTS penalties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
    rulebook_id UUID REFERENCES rulebooks(id) ON DELETE SET NULL,
    driver_id VARCHAR(255),
    driver_name VARCHAR(255),
    car_number VARCHAR(10),
    penalty_type VARCHAR(50),
    penalty_value VARCHAR(100),
    rule_reference VARCHAR(100),
    severity VARCHAR(20),
    points INTEGER,
    rationale TEXT,
    evidence_bundle JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'proposed',
    proposed_by VARCHAR(50) DEFAULT 'system',
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    is_appealed BOOLEAN DEFAULT false,
    appeal JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Steward notes and bookmarks
CREATE TABLE IF NOT EXISTS steward_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
    author_id UUID,
    author_name VARCHAR(255),
    note_type VARCHAR(50),
    content TEXT,
    replay_timestamp_ms BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_sim_type ON sessions(sim_type);
CREATE INDEX IF NOT EXISTS idx_incidents_session ON incidents(session_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_penalties_session ON penalties(session_id);
CREATE INDEX IF NOT EXISTS idx_penalties_status ON penalties(status);
CREATE INDEX IF NOT EXISTS idx_penalties_driver ON penalties(driver_id);
CREATE INDEX IF NOT EXISTS idx_session_drivers_session ON session_drivers(session_id);
CREATE INDEX IF NOT EXISTS idx_steward_notes_session ON steward_notes(session_id);
