-- =====================================================================
-- ControlBox Database Schema - Discipline Profiles Migration
-- Migration: 002_discipline_profiles.sql
-- =====================================================================

-- ========================
-- Discipline Profiles Table
-- ========================

CREATE TABLE IF NOT EXISTS discipline_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('oval', 'road', 'dirtOval', 'dirtRoad', 'endurance', 'openWheel')),
    description TEXT,
    
    -- Configuration JSON fields
    caution_rules JSONB NOT NULL DEFAULT '{}',
    penalty_model JSONB NOT NULL DEFAULT '{}',
    incident_thresholds JSONB NOT NULL DEFAULT '{}',
    special_rules JSONB DEFAULT '{}',
    
    -- Flags
    is_default BOOLEAN DEFAULT false,
    is_builtin BOOLEAN DEFAULT false,
    version VARCHAR(50) DEFAULT '1.0.0',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one default per category
CREATE UNIQUE INDEX IF NOT EXISTS idx_discipline_profiles_default_category 
    ON discipline_profiles(category) WHERE is_default = true;

-- ========================
-- Sessions Table Updates
-- ========================

-- Add discipline columns to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS discipline VARCHAR(50);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS discipline_profile_id UUID REFERENCES discipline_profiles(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_metadata JSONB DEFAULT '{}';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS league_id UUID;

-- ========================
-- Recommendations Table
-- ========================

CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
    
    -- Recommendation details
    recommendation_type VARCHAR(50) NOT NULL,
    discipline_context VARCHAR(50),
    details TEXT,
    confidence DECIMAL(4,3),
    priority INTEGER DEFAULT 5,
    
    -- Payload for specific recommendation types
    payload JSONB DEFAULT '{}',
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed', 'modified', 'expired')),
    actioned_by UUID,
    actioned_at TIMESTAMPTZ,
    action_notes TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Steward Commands Audit Table
-- ========================

CREATE TABLE IF NOT EXISTS steward_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    
    -- Command details
    command VARCHAR(50) NOT NULL,
    reason TEXT,
    target_car_id INTEGER,
    payload JSONB DEFAULT '{}',
    
    -- Who issued it
    issued_by UUID,
    issued_by_name VARCHAR(255),
    
    -- Execution status
    executed BOOLEAN DEFAULT false,
    executed_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- Leagues Table
-- ========================

CREATE TABLE IF NOT EXISTS leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Default profile for this league
    default_profile_id UUID REFERENCES discipline_profiles(id),
    -- Default rulebook for this league
    default_rulebook_id UUID REFERENCES rulebooks(id),
    
    -- League settings
    settings JSONB DEFAULT '{}',
    
    -- Contact info
    owner_id UUID,
    contact_email VARCHAR(255),
    
    -- Flags
    is_active BOOLEAN DEFAULT true,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- League Profile Overrides
-- ========================

-- Allows leagues to have different profiles for different categories
CREATE TABLE IF NOT EXISTS league_profile_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    profile_id UUID REFERENCES discipline_profiles(id) ON DELETE CASCADE,
    
    UNIQUE(league_id, category)
);

-- ========================
-- Add discipline context to incidents
-- ========================

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS discipline_context VARCHAR(50);

-- ========================
-- Indexes
-- ========================

CREATE INDEX IF NOT EXISTS idx_discipline_profiles_category ON discipline_profiles(category);
CREATE INDEX IF NOT EXISTS idx_discipline_profiles_builtin ON discipline_profiles(is_builtin);
CREATE INDEX IF NOT EXISTS idx_recommendations_session ON recommendations(session_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_steward_commands_session ON steward_commands(session_id);
CREATE INDEX IF NOT EXISTS idx_steward_commands_issued_by ON steward_commands(issued_by);
CREATE INDEX IF NOT EXISTS idx_leagues_active ON leagues(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_discipline ON sessions(discipline);
CREATE INDEX IF NOT EXISTS idx_sessions_league ON sessions(league_id);

-- ========================
-- Built-in Discipline Profiles
-- ========================

-- Oval Default Profile
INSERT INTO discipline_profiles (name, category, description, caution_rules, penalty_model, incident_thresholds, special_rules, is_default, is_builtin, version)
VALUES (
    'Oval - Standard',
    'oval',
    'Standard oval racing profile with full-course yellows, lucky dog, and wave around',
    '{
        "fullCourseEnabled": true,
        "localYellowEnabled": false,
        "slowZonesEnabled": false,
        "safetyCarEnabled": true,
        "triggerThreshold": "medium",
        "autoRestart": true,
        "restartType": "double_file",
        "luckyDogEnabled": true,
        "waveAroundEnabled": true,
        "pitRoadClosedOnYellow": true,
        "cautionLaps": 3
    }',
    '{
        "strictness": 0.6,
        "contactTolerance": 0.7,
        "availablePenalties": [
            {"type": "warning", "displayName": "Warning", "isEnabled": true},
            {"type": "time_penalty", "displayName": "Time Penalty", "isEnabled": true, "defaultValue": "15 seconds"},
            {"type": "drive_through", "displayName": "Drive Through", "isEnabled": true},
            {"type": "disqualification", "displayName": "Disqualification", "isEnabled": true}
        ],
        "racingIncidentDefault": "no_action",
        "timePenaltyOptions": [5, 10, 15, 30],
        "gridPenaltyOptions": [3, 5, 10],
        "lap1ForgivenessFactor": 0.5
    }',
    '{
        "lightContactSpeedDelta": 15,
        "mediumContactSpeedDelta": 30,
        "heavyContactSpeedDelta": 50,
        "divebombOverlapThreshold": 0.5,
        "dangerousClosingSpeed": 80,
        "minorOffTrackDistance": 2,
        "minorSpinDuration": 2
    }',
    '{
        "pitLaneSpeedLimitEnabled": true,
        "pitLaneSpeedLimit": 65,
        "bumpDraftingAllowed": true,
        "sideDraftingAllowed": true
    }',
    true,
    true,
    '1.0.0'
) ON CONFLICT DO NOTHING;

-- Road Default Profile
INSERT INTO discipline_profiles (name, category, description, caution_rules, penalty_model, incident_thresholds, special_rules, is_default, is_builtin, version)
VALUES (
    'Road - Sprint',
    'road',
    'Standard road course sprint racing profile with local yellows and track limits',
    '{
        "fullCourseEnabled": false,
        "localYellowEnabled": true,
        "slowZonesEnabled": false,
        "safetyCarEnabled": true,
        "triggerThreshold": "high",
        "autoRestart": true,
        "restartType": "single_file",
        "luckyDogEnabled": false,
        "waveAroundEnabled": false
    }',
    '{
        "strictness": 0.7,
        "contactTolerance": 0.5,
        "availablePenalties": [
            {"type": "warning", "displayName": "Warning", "isEnabled": true},
            {"type": "time_penalty", "displayName": "Time Penalty", "isEnabled": true, "defaultValue": "5 seconds"},
            {"type": "position_penalty", "displayName": "Position Penalty", "isEnabled": true},
            {"type": "drive_through", "displayName": "Drive Through", "isEnabled": true},
            {"type": "disqualification", "displayName": "Disqualification", "isEnabled": true}
        ],
        "racingIncidentDefault": "investigate",
        "timePenaltyOptions": [3, 5, 10, 20, 30],
        "gridPenaltyOptions": [3, 5, 10, 20]
    }',
    '{
        "lightContactSpeedDelta": 10,
        "mediumContactSpeedDelta": 25,
        "heavyContactSpeedDelta": 40,
        "divebombOverlapThreshold": 0.4,
        "dangerousClosingSpeed": 60,
        "minorOffTrackDistance": 1,
        "minorSpinDuration": 1.5,
        "trackLimitWarningCount": 3
    }',
    '{
        "trackLimitsEnabled": true,
        "trackLimitThreshold": 4,
        "trackLimitLapDeletion": true,
        "pitLaneSpeedLimitEnabled": true,
        "pitLaneSpeedLimit": 80
    }',
    true,
    true,
    '1.0.0'
) ON CONFLICT DO NOTHING;

-- Dirt Oval Default Profile
INSERT INTO discipline_profiles (name, category, description, caution_rules, penalty_model, incident_thresholds, special_rules, is_default, is_builtin, version)
VALUES (
    'Dirt Oval - Standard',
    'dirtOval',
    'Standard dirt oval profile with higher contact tolerance for slides',
    '{
        "fullCourseEnabled": true,
        "localYellowEnabled": false,
        "slowZonesEnabled": false,
        "safetyCarEnabled": false,
        "triggerThreshold": "high",
        "autoRestart": true,
        "restartType": "double_file"
    }',
    '{
        "strictness": 0.4,
        "contactTolerance": 0.85,
        "availablePenalties": [
            {"type": "warning", "displayName": "Warning", "isEnabled": true},
            {"type": "time_penalty", "displayName": "Time Penalty", "isEnabled": true},
            {"type": "disqualification", "displayName": "Disqualification", "isEnabled": true}
        ],
        "racingIncidentDefault": "no_action",
        "timePenaltyOptions": [10, 15, 30],
        "gridPenaltyOptions": [5, 10]
    }',
    '{
        "lightContactSpeedDelta": 25,
        "mediumContactSpeedDelta": 45,
        "heavyContactSpeedDelta": 70,
        "divebombOverlapThreshold": 0.6,
        "dangerousClosingSpeed": 100,
        "minorOffTrackDistance": 3,
        "minorSpinDuration": 3
    }',
    '{
        "slideContactTolerance": 0.9,
        "roostDamageEnabled": false
    }',
    true,
    true,
    '1.0.0'
) ON CONFLICT DO NOTHING;

-- Endurance Default Profile
INSERT INTO discipline_profiles (name, category, description, caution_rules, penalty_model, incident_thresholds, special_rules, is_default, is_builtin, version)
VALUES (
    'Endurance - Multi-Class',
    'endurance',
    'Endurance racing profile with slow zones, multi-class rules, and driver swaps',
    '{
        "fullCourseEnabled": false,
        "localYellowEnabled": true,
        "slowZonesEnabled": true,
        "safetyCarEnabled": true,
        "triggerThreshold": "high",
        "autoRestart": true,
        "restartType": "single_file",
        "slowZoneSpeedLimit": 80,
        "slowZoneMinDuration": 60
    }',
    '{
        "strictness": 0.6,
        "contactTolerance": 0.6,
        "availablePenalties": [
            {"type": "warning", "displayName": "Warning", "isEnabled": true},
            {"type": "time_penalty", "displayName": "Time Penalty", "isEnabled": true, "defaultValue": "30 seconds"},
            {"type": "stop_go", "displayName": "Stop & Go", "isEnabled": true},
            {"type": "drive_through", "displayName": "Drive Through", "isEnabled": true},
            {"type": "disqualification", "displayName": "Disqualification", "isEnabled": true}
        ],
        "racingIncidentDefault": "investigate",
        "timePenaltyOptions": [10, 30, 60, 120],
        "gridPenaltyOptions": [],
        "multiClassForgiveness": 0.7
    }',
    '{
        "lightContactSpeedDelta": 12,
        "mediumContactSpeedDelta": 28,
        "heavyContactSpeedDelta": 45,
        "divebombOverlapThreshold": 0.35,
        "dangerousClosingSpeed": 50,
        "minorOffTrackDistance": 1.5,
        "minorSpinDuration": 2,
        "trackLimitWarningCount": 5
    }',
    '{
        "trackLimitsEnabled": true,
        "trackLimitThreshold": 6,
        "multiClassEnabled": true,
        "blueFlagEnforcement": true,
        "classYieldingRules": {
            "cornerRule": 3,
            "blueFlagLaps": 2,
            "fasterClassResponsibility": 0.6
        },
        "driverSwapEnabled": true,
        "minStintTime": 1800,
        "maxStintTime": 10800,
        "pitLaneSpeedLimitEnabled": true,
        "pitLaneSpeedLimit": 60,
        "unsafeReleaseEnabled": true
    }',
    true,
    true,
    '1.0.0'
) ON CONFLICT DO NOTHING;

-- Open Wheel Default Profile
INSERT INTO discipline_profiles (name, category, description, caution_rules, penalty_model, incident_thresholds, special_rules, is_default, is_builtin, version)
VALUES (
    'Open Wheel - Strict',
    'openWheel',
    'Open wheel racing with strict penalties and wing damage consideration',
    '{
        "fullCourseEnabled": false,
        "localYellowEnabled": true,
        "slowZonesEnabled": false,
        "safetyCarEnabled": true,
        "triggerThreshold": "medium",
        "autoRestart": true,
        "restartType": "standing"
    }',
    '{
        "strictness": 0.85,
        "contactTolerance": 0.3,
        "availablePenalties": [
            {"type": "warning", "displayName": "Warning", "isEnabled": true},
            {"type": "time_penalty", "displayName": "Time Penalty", "isEnabled": true, "defaultValue": "5 seconds"},
            {"type": "position_penalty", "displayName": "Position Penalty", "isEnabled": true},
            {"type": "drive_through", "displayName": "Drive Through", "isEnabled": true},
            {"type": "stop_go", "displayName": "Stop & Go", "isEnabled": true},
            {"type": "grid_penalty", "displayName": "Grid Penalty", "isEnabled": true},
            {"type": "disqualification", "displayName": "Disqualification", "isEnabled": true}
        ],
        "racingIncidentDefault": "investigate",
        "timePenaltyOptions": [3, 5, 10, 20],
        "gridPenaltyOptions": [3, 5, 10, 20]
    }',
    '{
        "lightContactSpeedDelta": 8,
        "mediumContactSpeedDelta": 18,
        "heavyContactSpeedDelta": 30,
        "divebombOverlapThreshold": 0.3,
        "dangerousClosingSpeed": 40,
        "minorOffTrackDistance": 0.5,
        "minorSpinDuration": 1,
        "trackLimitWarningCount": 2,
        "unsafeRejoinSpeedThreshold": 60
    }',
    '{
        "trackLimitsEnabled": true,
        "trackLimitThreshold": 3,
        "trackLimitLapDeletion": true,
        "pitLaneSpeedLimitEnabled": true,
        "pitLaneSpeedLimit": 80,
        "unsafeReleaseEnabled": true,
        "wingDamageAssessment": true,
        "frontWingContactPenalty": true
    }',
    true,
    true,
    '1.0.0'
) ON CONFLICT DO NOTHING;

-- Dirt Road Default Profile
INSERT INTO discipline_profiles (name, category, description, caution_rules, penalty_model, incident_thresholds, special_rules, is_default, is_builtin, version)
VALUES (
    'Dirt Road - Rallycross',
    'dirtRoad',
    'Rallycross and dirt road profile with high contact tolerance',
    '{
        "fullCourseEnabled": false,
        "localYellowEnabled": false,
        "slowZonesEnabled": false,
        "safetyCarEnabled": false,
        "triggerThreshold": "high",
        "autoRestart": false,
        "restartType": "standing"
    }',
    '{
        "strictness": 0.3,
        "contactTolerance": 0.9,
        "availablePenalties": [
            {"type": "warning", "displayName": "Warning", "isEnabled": true},
            {"type": "time_penalty", "displayName": "Time Penalty", "isEnabled": true},
            {"type": "disqualification", "displayName": "Disqualification", "isEnabled": true}
        ],
        "racingIncidentDefault": "no_action",
        "timePenaltyOptions": [5, 10, 30],
        "gridPenaltyOptions": []
    }',
    '{
        "lightContactSpeedDelta": 30,
        "mediumContactSpeedDelta": 50,
        "heavyContactSpeedDelta": 80,
        "divebombOverlapThreshold": 0.7,
        "dangerousClosingSpeed": 120,
        "minorOffTrackDistance": 5,
        "minorSpinDuration": 4
    }',
    '{
        "slideContactTolerance": 0.95,
        "roostDamageEnabled": true
    }',
    true,
    true,
    '1.0.0'
) ON CONFLICT DO NOTHING;
