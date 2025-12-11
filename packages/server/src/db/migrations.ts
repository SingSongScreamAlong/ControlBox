// =====================================================================
// Database Migrations Runner
// Runs SQL migrations on startup - designed to be resilient to errors
// =====================================================================

import { pool } from './client.js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

// Try multiple possible paths for migrations (works in both local dev and Docker)
const POSSIBLE_PATHS = [
    '/app/packages/server/src/db/migrations',           // Docker container path
    join(process.cwd(), 'packages/server/src/db/migrations'),  // npm workspace root
    join(process.cwd(), 'src/db/migrations'),           // Direct in server package
];

// Find the first existing migrations directory
function findMigrationsDir(): string | null {
    for (const path of POSSIBLE_PATHS) {
        if (existsSync(path)) {
            console.log(`   📁 Found migrations at: ${path}`);
            return path;
        }
    }
    console.log(`   ℹ️  Checked paths: ${POSSIBLE_PATHS.join(', ')}`);
    return null;
}

/**
 * Run all pending migrations
 * Note: This is designed to be resilient - errors are logged but don't crash the server
 */
export async function runMigrations(): Promise<void> {
    let client;

    try {
        client = await pool.connect();

        // Create migrations tracking table if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS _migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Find migrations directory
        const MIGRATIONS_DIR = findMigrationsDir();
        if (!MIGRATIONS_DIR) {
            console.log('   ⚠️  No migrations directory found, skipping');
            return;
        }

        let files: string[];
        try {
            files = readdirSync(MIGRATIONS_DIR)
                .filter(f => f.endsWith('.sql'))
                .sort();
        } catch (error) {
            console.log('   ⚠️  Could not read migrations directory, skipping');
            return;
        }

        if (files.length === 0) {
            console.log('   ℹ️  No migrations to run');
            return;
        }

        for (const file of files) {
            // Check if already applied
            const result = await client.query(
                'SELECT id FROM _migrations WHERE name = $1',
                [file]
            );

            if (result.rows.length > 0) {
                continue; // Already applied
            }

            // Run migration
            console.log(`   🔄 Running ${file}...`);
            const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query(
                    'INSERT INTO _migrations (name) VALUES ($1)',
                    [file]
                );
                await client.query('COMMIT');
                console.log(`   ✅ ${file} applied`);
            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`   ❌ ${file} failed:`, error);
                throw error;
            }
        }
    } catch (error) {
        // Log the error but don't crash - allow server to start
        console.warn('   ⚠️  Migration error (server will continue):', (error as Error).message);
        console.warn('   ⚠️  You may need to run migrations manually or check database permissions');
    } finally {
        if (client) {
            client.release();
        }
    }
}

/**
 * Seed default admin user if none exists
 * Note: This is designed to be resilient - errors are logged but don't crash the server
 */
export async function seedAdminUser(): Promise<void> {
    try {
        const { hash } = await import('bcrypt');

        // Check if admin_users table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'admin_users'
            )
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('   ⚠️  admin_users table not found, skipping user seed');
            return;
        }

        // Check if any admin users exist
        const result = await pool.query('SELECT id FROM admin_users LIMIT 1');

        if (result.rows.length > 0) {
            return; // Admin already exists
        }

        // Create default admin
        const email = 'admin@okboxbox.com';
        const password = 'ControlBox2024!';
        const displayName = 'Admin User';
        const passwordHash = await hash(password, 12);

        await pool.query(`
            INSERT INTO admin_users (email, password_hash, display_name, is_super_admin, is_active, email_verified)
            VALUES ($1, $2, $3, true, true, true)
            ON CONFLICT (email) DO NOTHING
        `, [email.toLowerCase(), passwordHash, displayName]);

        console.log('   👤 Default admin created: admin@okboxbox.com');
    } catch (error) {
        // Log the error but don't crash - allow server to start
        console.warn('   ⚠️  Admin seeding error (server will continue):', (error as Error).message);
    }
}
