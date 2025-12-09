// =====================================================================
// App Initializer
// Component that initializes all stores and WebSocket listeners on mount
// =====================================================================

import { useEffect, useRef } from 'react';
import { useSessionStore } from '../stores/session.store';
import { useIncidentStore } from '../stores/incident.store';

interface AppInitializerProps {
    children: React.ReactNode;
}

/**
 * Initializes all application stores and WebSocket listeners.
 * This should wrap the main app content to ensure stores are ready
 * before the app renders.
 */
export function AppInitializer({ children }: AppInitializerProps) {
    const initialized = useRef(false);

    // Get store initializers
    const initializeSessionListeners = useSessionStore(state => state.initializeListeners);
    const initializeIncidentListeners = useIncidentStore(state => state.initializeListeners);

    useEffect(() => {
        // Only initialize once
        if (initialized.current) return;
        initialized.current = true;

        console.log('[AppInitializer] Initializing store listeners...');

        // Initialize all store WebSocket listeners
        initializeSessionListeners();
        initializeIncidentListeners();

        console.log('[AppInitializer] Store listeners initialized');
    }, [initializeSessionListeners, initializeIncidentListeners]);

    return <>{children}</>;
}
