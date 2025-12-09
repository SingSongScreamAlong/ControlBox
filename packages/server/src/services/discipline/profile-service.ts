// =====================================================================
// Discipline Profile Service
// Business logic for discipline profile management
// =====================================================================

import { EventEmitter } from 'events';
import type {
    DisciplineProfile,
    DisciplineCategory,
    CreateProfileRequest,
    UpdateProfileRequest
} from '@controlbox/common';
import { DisciplineProfileRepository } from '../../db/repositories/profile.repo.js';

export interface ProfileServiceEvents {
    'profile:loaded': (profile: DisciplineProfile) => void;
    'profile:created': (profile: DisciplineProfile) => void;
    'profile:updated': (profile: DisciplineProfile) => void;
    'profile:deleted': (profileId: string) => void;
}

export class DisciplineProfileService extends EventEmitter {
    private repository: DisciplineProfileRepository;
    private cache: Map<string, DisciplineProfile> = new Map();
    private categoryDefaults: Map<DisciplineCategory, DisciplineProfile> = new Map();

    constructor() {
        super();
        this.repository = new DisciplineProfileRepository();
    }

    /**
     * Initialize the service and load default profiles
     */
    async initialize(): Promise<void> {
        console.log('🔧 Initializing DisciplineProfileService...');

        // Load all category defaults into cache
        const categories: DisciplineCategory[] = [
            'oval', 'road', 'dirtOval', 'dirtRoad', 'endurance', 'openWheel'
        ];

        for (const category of categories) {
            const defaultProfile = await this.repository.findDefault(category);
            if (defaultProfile) {
                this.categoryDefaults.set(category, defaultProfile);
                this.cache.set(defaultProfile.id, defaultProfile);
                console.log(`   ✓ Loaded default for ${category}: ${defaultProfile.name}`);
            } else {
                console.warn(`   ⚠ No default profile for ${category}`);
            }
        }

        console.log('✅ DisciplineProfileService initialized');
    }

    /**
     * Get profile by ID (with caching)
     */
    async getById(id: string): Promise<DisciplineProfile | null> {
        // Check cache first
        if (this.cache.has(id)) {
            return this.cache.get(id)!;
        }

        const profile = await this.repository.findById(id);
        if (profile) {
            this.cache.set(id, profile);
        }
        return profile;
    }

    /**
     * Get all profiles
     */
    async getAll(): Promise<DisciplineProfile[]> {
        return this.repository.findAll();
    }

    /**
     * Get profiles by category
     */
    async getByCategory(category: DisciplineCategory): Promise<DisciplineProfile[]> {
        return this.repository.findByCategory(category);
    }

    /**
     * Get the default profile for a category
     * Used when loading a session's rulebook
     */
    async getDefault(category: DisciplineCategory): Promise<DisciplineProfile | null> {
        // Check cached defaults first
        if (this.categoryDefaults.has(category)) {
            return this.categoryDefaults.get(category)!;
        }

        const profile = await this.repository.findDefault(category);
        if (profile) {
            this.categoryDefaults.set(category, profile);
            this.cache.set(profile.id, profile);
        }
        return profile;
    }

    /**
     * Get all built-in profiles
     */
    async getBuiltIn(): Promise<DisciplineProfile[]> {
        return this.repository.findBuiltIn();
    }

    /**
     * Create a new profile
     */
    async create(request: CreateProfileRequest): Promise<DisciplineProfile> {
        const profile = await this.repository.create(request);

        this.cache.set(profile.id, profile);
        if (profile.isDefault) {
            this.categoryDefaults.set(profile.category, profile);
        }

        this.emit('profile:created', profile);
        console.log(`📝 Created profile: ${profile.name} [${profile.category}]`);

        return profile;
    }

    /**
     * Update an existing profile
     */
    async update(id: string, updates: UpdateProfileRequest): Promise<DisciplineProfile | null> {
        const profile = await this.repository.update(id, updates);

        if (profile) {
            this.cache.set(id, profile);
            if (profile.isDefault) {
                this.categoryDefaults.set(profile.category, profile);
            }
            this.emit('profile:updated', profile);
            console.log(`📝 Updated profile: ${profile.name}`);
        }

        return profile;
    }

    /**
     * Delete a profile (built-in profiles cannot be deleted)
     */
    async delete(id: string): Promise<boolean> {
        const existing = await this.getById(id);
        if (!existing) return false;

        // Check if it's built-in
        if (existing.metadata?.isBuiltin) {
            console.warn(`Cannot delete built-in profile: ${existing.name}`);
            return false;
        }

        const deleted = await this.repository.delete(id);

        if (deleted) {
            this.cache.delete(id);
            if (this.categoryDefaults.get(existing.category)?.id === id) {
                this.categoryDefaults.delete(existing.category);
            }
            this.emit('profile:deleted', id);
            console.log(`🗑️ Deleted profile: ${existing.name}`);
        }

        return deleted;
    }

    /**
     * Set a profile as the default for its category
     */
    async setAsDefault(id: string): Promise<DisciplineProfile | null> {
        const profile = await this.repository.setAsDefault(id);

        if (profile) {
            this.cache.set(id, profile);
            this.categoryDefaults.set(profile.category, profile);
            console.log(`⭐ Set default for ${profile.category}: ${profile.name}`);
        }

        return profile;
    }

    /**
     * Duplicate an existing profile
     */
    async duplicate(id: string, newName: string): Promise<DisciplineProfile | null> {
        const profile = await this.repository.duplicate(id, newName);

        if (profile) {
            this.cache.set(profile.id, profile);
            this.emit('profile:created', profile);
            console.log(`📋 Duplicated profile as: ${profile.name}`);
        }

        return profile;
    }

    /**
     * Load the appropriate profile for a session based on metadata
     * This is the main entry point for the rulebook engine
     */
    async loadProfileForSession(
        category: DisciplineCategory,
        _leagueId?: string,
        overrideProfileId?: string
    ): Promise<DisciplineProfile | null> {
        // Priority: 1. Override, 2. League default, 3. Category default

        // 1. Check for explicit override
        if (overrideProfileId) {
            const override = await this.getById(overrideProfileId);
            if (override) {
                this.emit('profile:loaded', override);
                console.log(`📖 Loaded override profile: ${override.name}`);
                return override;
            }
        }

        // 2. TODO: Check league profile overrides (future enhancement)
        // if (leagueId) { ... }

        // 3. Fall back to category default
        const defaultProfile = await this.getDefault(category);
        if (defaultProfile) {
            this.emit('profile:loaded', defaultProfile);
            console.log(`📖 Loaded default profile for ${category}: ${defaultProfile.name}`);
            return defaultProfile;
        }

        console.warn(`⚠ No profile found for category: ${category}`);
        return null;
    }

    /**
     * Clear the cache (useful for testing)
     */
    clearCache(): void {
        this.cache.clear();
        this.categoryDefaults.clear();
    }
}

// Singleton instance
let serviceInstance: DisciplineProfileService | null = null;

export function getProfileService(): DisciplineProfileService {
    if (!serviceInstance) {
        serviceInstance = new DisciplineProfileService();
    }
    return serviceInstance;
}
