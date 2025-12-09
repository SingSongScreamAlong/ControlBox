-- =====================================================================
-- Migration 005: Scoring Engine
-- Points tables, standings, event results, drop weeks
-- =====================================================================

-- Points tables (custom per series)
CREATE TABLE IF NOT EXISTS points_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    -- Position -> points mapping: {"1": 25, "2": 18, ...}
    points JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Class-specific overrides: {"GT4": {"1": 20, ...}}
    class_points JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Bonus points configuration
CREATE TABLE IF NOT EXISTS bonus_points_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    -- pole, laps_led, most_laps_led, clean_race, fastest_lap
    type VARCHAR(50) NOT NULL,
    points INTEGER NOT NULL,
    -- Additional conditions: {"min_starters": 10}
    conditions JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Driver standings (aggregate per season)
CREATE TABLE IF NOT EXISTS driver_standings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    driver_id VARCHAR(100) NOT NULL,
    driver_name VARCHAR(200) NOT NULL,
    team_id VARCHAR(100),
    team_name VARCHAR(200),
    car_class VARCHAR(50),
    -- Stats
    points INTEGER DEFAULT 0,
    points_with_drops INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    podiums INTEGER DEFAULT 0,
    top5s INTEGER DEFAULT 0,
    top10s INTEGER DEFAULT 0,
    dnfs INTEGER DEFAULT 0,
    dsqs INTEGER DEFAULT 0,
    laps_led INTEGER DEFAULT 0,
    poles INTEGER DEFAULT 0,
    incidents INTEGER DEFAULT 0,
    races_started INTEGER DEFAULT 0,
    -- Computed position (updated on rebuild)
    position INTEGER,
    class_position INTEGER,
    behind_leader INTEGER DEFAULT 0,
    -- Metadata
    iracing_cust_id VARCHAR(50),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(season_id, driver_id)
);

-- Team standings (aggregate per season)
CREATE TABLE IF NOT EXISTS team_standings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    team_id VARCHAR(100) NOT NULL,
    team_name VARCHAR(200) NOT NULL,
    car_class VARCHAR(50),
    points INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    position INTEGER,
    class_position INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(season_id, team_id)
);

-- Event results (individual per event per driver)
CREATE TABLE IF NOT EXISTS event_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    driver_id VARCHAR(100) NOT NULL,
    driver_name VARCHAR(200) NOT NULL,
    team_id VARCHAR(100),
    team_name VARCHAR(200),
    car_number VARCHAR(10),
    car_class VARCHAR(50),
    car_name VARCHAR(100),
    -- Positions
    starting_position INTEGER,
    finishing_position INTEGER NOT NULL,
    class_starting_position INTEGER,
    class_finishing_position INTEGER,
    -- Race data
    laps_completed INTEGER DEFAULT 0,
    laps_led INTEGER DEFAULT 0,
    -- Finish status
    finish_status VARCHAR(20) DEFAULT 'finished', -- finished, dnf, dsq, dns, dq
    -- Points breakdown
    base_points INTEGER DEFAULT 0,
    bonus_points INTEGER DEFAULT 0,
    penalty_points INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    -- Drop week tracking
    is_dropped BOOLEAN DEFAULT FALSE,
    -- Times
    fastest_lap_time NUMERIC(10, 3),
    average_lap_time NUMERIC(10, 3),
    total_time VARCHAR(50),
    gap_to_leader VARCHAR(50),
    -- Incidents
    incident_count INTEGER DEFAULT 0,
    -- Metadata
    iracing_cust_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, driver_id)
);

-- Drop week configuration per season
CREATE TABLE IF NOT EXISTS drop_week_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    -- Number of worst results to drop
    max_drops INTEGER DEFAULT 0,
    -- Minimum events before drops apply
    min_events_for_drops INTEGER DEFAULT 0,
    -- Class-specific rules: {"GT4": {"max_drops": 1}}
    class_rules JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(season_id)
);

-- Scoring audit log
CREATE TABLE IF NOT EXISTS scoring_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id),
    season_id UUID REFERENCES seasons(id),
    action VARCHAR(50) NOT NULL, -- score_event, rebuild_standings, apply_drops
    performed_by UUID REFERENCES admin_users(id),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_points_tables_series ON points_tables(series_id);
CREATE INDEX IF NOT EXISTS idx_bonus_points_series ON bonus_points_config(series_id);
CREATE INDEX IF NOT EXISTS idx_driver_standings_season ON driver_standings(season_id);
CREATE INDEX IF NOT EXISTS idx_driver_standings_position ON driver_standings(season_id, position);
CREATE INDEX IF NOT EXISTS idx_driver_standings_class ON driver_standings(season_id, car_class, class_position);
CREATE INDEX IF NOT EXISTS idx_team_standings_season ON team_standings(season_id);
CREATE INDEX IF NOT EXISTS idx_event_results_event ON event_results(event_id);
CREATE INDEX IF NOT EXISTS idx_event_results_driver ON event_results(driver_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_scoring_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_points_tables_timestamp
    BEFORE UPDATE ON points_tables
    FOR EACH ROW EXECUTE FUNCTION update_scoring_timestamp();

CREATE TRIGGER update_driver_standings_timestamp
    BEFORE UPDATE ON driver_standings
    FOR EACH ROW EXECUTE FUNCTION update_scoring_timestamp();

CREATE TRIGGER update_team_standings_timestamp
    BEFORE UPDATE ON team_standings
    FOR EACH ROW EXECUTE FUNCTION update_scoring_timestamp();

-- Seed default NASCAR-style points table
INSERT INTO points_tables (series_id, name, is_default, points)
SELECT 
    id,
    'NASCAR Stage Points',
    true,
    '{
        "1": 40, "2": 35, "3": 34, "4": 33, "5": 32, "6": 31, "7": 30, "8": 29, "9": 28, "10": 27,
        "11": 26, "12": 25, "13": 24, "14": 23, "15": 22, "16": 21, "17": 20, "18": 19, "19": 18, "20": 17,
        "21": 16, "22": 15, "23": 14, "24": 13, "25": 12, "26": 11, "27": 10, "28": 9, "29": 8, "30": 7,
        "31": 6, "32": 5, "33": 4, "34": 3, "35": 2, "36": 1
    }'::jsonb
FROM series
WHERE NOT EXISTS (SELECT 1 FROM points_tables WHERE series_id = series.id)
LIMIT 1;
