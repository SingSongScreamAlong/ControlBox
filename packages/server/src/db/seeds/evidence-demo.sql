-- =====================================================================
-- Evidence Demo Data Seed (Fixed UUID format)
-- Sample evidence records for testing
-- =====================================================================

DO $$
DECLARE
    v_league_id UUID := 'a0000000-0000-0000-0000-000000000001';
    v_user_id UUID := 'b0000000-0000-0000-0000-000000000001';
    v_evidence_1 UUID := 'e0000000-0000-0000-0000-000000000001';
    v_evidence_2 UUID := 'e0000000-0000-0000-0000-000000000002';
    v_evidence_3 UUID := 'e0000000-0000-0000-0000-000000000003';
    v_evidence_4 UUID := 'e0000000-0000-0000-0000-000000000004';
BEGIN
    -- Create demo league if not exists
    INSERT INTO leagues (id, name, created_at, updated_at)
    VALUES (v_league_id, 'Demo Racing League', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    -- Sample Evidence Assets
    -- 1. YouTube broadcast view
    INSERT INTO evidence_assets (
        id, type, owner_league_id, uploaded_by_user_id, uploaded_by_name,
        title, notes, source, visibility, assessment
    ) VALUES (
        v_evidence_1,
        'EXTERNAL_URL',
        v_league_id,
        v_user_id,
        'Demo Steward',
        'T1 Contact - Broadcast View',
        'Clear view of the contact from broadcast camera',
        'broadcast',
        'STEWARDS_ONLY',
        'PENDING'
    ) ON CONFLICT (id) DO NOTHING;

    -- 2. Streamable onboard view
    INSERT INTO evidence_assets (
        id, type, owner_league_id, uploaded_by_user_id, uploaded_by_name,
        title, notes, source, visibility, assessment
    ) VALUES (
        v_evidence_2,
        'EXTERNAL_URL',
        v_league_id,
        v_user_id,
        'Demo Steward',
        'Driver A Onboard - Contact POV',
        'Onboard footage from the attacking driver',
        'onboard',
        'STEWARDS_ONLY',
        'PENDING'
    ) ON CONFLICT (id) DO NOTHING;

    -- 3. iRacing replay reference
    INSERT INTO evidence_assets (
        id, type, owner_league_id, uploaded_by_user_id, uploaded_by_name,
        title, notes, source, visibility, assessment,
        key_moments
    ) VALUES (
        v_evidence_3,
        'IRACING_REPLAY_REF',
        v_league_id,
        v_user_id,
        'Demo Steward',
        'iRacing Replay - Lap 15 Incident',
        'Official iRacing replay data for incident review',
        'primary',
        'STEWARDS_ONLY',
        'PENDING',
        '[{"id":"pre-10","label":"T-10s","offsetSeconds":0,"type":"pre_incident"},{"id":"contact","label":"Contact","offsetSeconds":10,"type":"contact"},{"id":"outcome","label":"Outcome","offsetSeconds":13,"type":"post_incident"}]'::jsonb
    ) ON CONFLICT (id) DO NOTHING;

    -- 4. Chase cam (driver visible)
    INSERT INTO evidence_assets (
        id, type, owner_league_id, uploaded_by_user_id, uploaded_by_name,
        title, notes, source, visibility, assessment
    ) VALUES (
        v_evidence_4,
        'EXTERNAL_URL',
        v_league_id,
        v_user_id,
        'Demo Steward',
        'Off-Track Incident - Chase Cam',
        'Chase camera view of the off-track excursion',
        'chase',
        'DRIVER_VISIBLE',
        'ACCEPTED'
    ) ON CONFLICT (id) DO NOTHING;

    -- External URL details for YouTube/Streamable
    INSERT INTO evidence_external_urls (evidence_id, url, embed_url, provider_hint)
    VALUES 
        (v_evidence_1, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube'),
        (v_evidence_2, 'https://streamable.com/moo', 'https://streamable.com/e/moo', 'streamable'),
        (v_evidence_4, 'https://www.youtube.com/watch?v=jNQXAC9IVRw', 'https://www.youtube.com/embed/jNQXAC9IVRw', 'youtube')
    ON CONFLICT (evidence_id) DO NOTHING;

    -- iRacing Replay Reference
    INSERT INTO evidence_replay_refs (
        evidence_id, event_id, subsession_id, lap, corner,
        timecode_hint, offset_seconds_before, offset_seconds_after, camera_hint
    ) VALUES (
        v_evidence_3,
        '12345678',
        '98765432',
        15,
        'Turn 1',
        '0:45:23',
        10,
        5,
        'TV1 Wide'
    ) ON CONFLICT (evidence_id) DO NOTHING;

    RAISE NOTICE 'Evidence demo data seeded successfully!';
    RAISE NOTICE 'Created 4 evidence records in Demo Racing League';
END $$;

-- Verify the data
SELECT 
    id::text,
    title,
    type::text,
    source::text,
    visibility::text
FROM evidence_assets
ORDER BY created_at DESC
LIMIT 10;
