// =====================================================================
// Incident Code Constants
// Standardized incident classification codes
// =====================================================================

/**
 * Incident type codes with descriptions
 */
export const INCIDENT_TYPES = {
    CONTACT: 'contact',
    OFF_TRACK: 'off_track',
    SPIN: 'spin',
    LOSS_OF_CONTROL: 'loss_of_control',
    UNSAFE_REJOIN: 'unsafe_rejoin',
    BLOCKING: 'blocking',
    CUTTING: 'cutting',
    PIT_LANE_VIOLATION: 'pit_lane_violation',
} as const;

/**
 * Contact type codes with descriptions
 */
export const CONTACT_TYPES = {
    REAR_END: 'rear_end',
    SIDE_TO_SIDE: 'side_to_side',
    DIVEBOMB: 'divebomb',
    T_BONE: 't_bone',
    SQUEEZE: 'squeeze',
    PUNT: 'punt',
    BRAKE_CHECK: 'brake_check',
    NETCODE_LIKELY: 'netcode_likely',
    RACING_INCIDENT: 'racing_incident',
    NO_CONTACT: 'no_contact',
} as const;

/**
 * Human-readable labels for incident types
 */
export const INCIDENT_TYPE_LABELS: Record<string, string> = {
    [INCIDENT_TYPES.CONTACT]: 'Contact',
    [INCIDENT_TYPES.OFF_TRACK]: 'Off Track',
    [INCIDENT_TYPES.SPIN]: 'Spin',
    [INCIDENT_TYPES.LOSS_OF_CONTROL]: 'Loss of Control',
    [INCIDENT_TYPES.UNSAFE_REJOIN]: 'Unsafe Rejoin',
    [INCIDENT_TYPES.BLOCKING]: 'Blocking',
    [INCIDENT_TYPES.CUTTING]: 'Cutting',
    [INCIDENT_TYPES.PIT_LANE_VIOLATION]: 'Pit Lane Violation',
};

/**
 * Human-readable labels for contact types
 */
export const CONTACT_TYPE_LABELS: Record<string, string> = {
    [CONTACT_TYPES.REAR_END]: 'Rear End Collision',
    [CONTACT_TYPES.SIDE_TO_SIDE]: 'Side to Side Contact',
    [CONTACT_TYPES.DIVEBOMB]: 'Divebomb',
    [CONTACT_TYPES.T_BONE]: 'T-Bone Collision',
    [CONTACT_TYPES.SQUEEZE]: 'Squeeze',
    [CONTACT_TYPES.PUNT]: 'Punt',
    [CONTACT_TYPES.BRAKE_CHECK]: 'Brake Check',
    [CONTACT_TYPES.NETCODE_LIKELY]: 'Netcode (Likely)',
    [CONTACT_TYPES.RACING_INCIDENT]: 'Racing Incident',
    [CONTACT_TYPES.NO_CONTACT]: 'No Contact',
};

/**
 * Incident status codes
 */
export const INCIDENT_STATUS = {
    PENDING: 'pending',
    UNDER_REVIEW: 'under_review',
    REVIEWED: 'reviewed',
    DISMISSED: 'dismissed',
    ESCALATED: 'escalated',
} as const;

/**
 * Driver roles in an incident
 */
export const DRIVER_ROLES = {
    AGGRESSOR: 'aggressor',
    VICTIM: 'victim',
    INVOLVED: 'involved',
    UNKNOWN: 'unknown',
    WITNESS: 'witness',
} as const;
