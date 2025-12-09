// =====================================================================
// Auth Store
// Authentication state management with JWT tokens
// =====================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface User {
    id: string;
    email: string;
    displayName: string;
    isSuperAdmin: boolean;
    isActive: boolean;
}

interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: number | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    refreshAccessToken: () => Promise<boolean>;
    checkAuth: () => boolean;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            isLoading: false,
            error: null,

            login: async (email: string, password: string): Promise<boolean> => {
                set({ isLoading: true, error: null });

                try {
                    const response = await fetch(`${API_BASE}/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });

                    const data = await response.json();

                    if (!response.ok || !data.success) {
                        set({
                            isLoading: false,
                            error: data.error?.message || 'Login failed'
                        });
                        return false;
                    }

                    const { user, accessToken, refreshToken, expiresAt } = data.data;

                    set({
                        user,
                        accessToken,
                        refreshToken,
                        expiresAt,
                        isLoading: false,
                        error: null
                    });

                    console.log(`✅ Logged in as ${user.email}`);
                    return true;
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Network error';
                    set({ isLoading: false, error: message });
                    return false;
                }
            },

            logout: async (): Promise<void> => {
                const { refreshToken } = get();

                try {
                    if (refreshToken) {
                        await fetch(`${API_BASE}/api/auth/logout`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ refreshToken })
                        });
                    }
                } catch (err) {
                    console.error('Logout error:', err);
                }

                set({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    expiresAt: null,
                    error: null
                });

                console.log('👋 Logged out');
            },

            refreshAccessToken: async (): Promise<boolean> => {
                const { refreshToken } = get();

                if (!refreshToken) {
                    return false;
                }

                try {
                    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refreshToken })
                    });

                    const data = await response.json();

                    if (!response.ok || !data.success) {
                        // Refresh token expired, logout
                        get().logout();
                        return false;
                    }

                    set({
                        accessToken: data.data.accessToken,
                        expiresAt: data.data.expiresAt
                    });

                    return true;
                } catch {
                    return false;
                }
            },

            checkAuth: (): boolean => {
                const { accessToken, expiresAt } = get();

                if (!accessToken || !expiresAt) {
                    return false;
                }

                // Check if token is expired (with 5 min buffer)
                const now = Math.floor(Date.now() / 1000);
                if (expiresAt < now + 300) {
                    // Token expired or expiring soon
                    get().refreshAccessToken();
                }

                return true;
            },

            clearError: () => set({ error: null })
        }),
        {
            name: 'controlbox-auth',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                expiresAt: state.expiresAt
            })
        }
    )
);

// Helper to get auth header for API calls
export function getAuthHeader(): Record<string, string> {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
        return { Authorization: `Bearer ${accessToken}` };
    }
    return {};
}
