#!/usr/bin/env node
/**
 * ControlBox - Database Setup & Seed Script
 * 
 * This script:
 * 1. Runs database migrations
 * 2. Creates an initial admin user
 * 
 * Usage:
 *   node scripts/setup-db.js [email] [password]
 *   
 * Example:
 *   node scripts/setup-db.js admin@okboxbox.com MySecurePassword123
 */

import { Pool } from 'pg';
import { hash } from 'bcrypt';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://controlbox:controlbox_dev@localhost:5432/controlbox';
const BCRYPT_ROUNDS = 12;

// Default admin credentials (override with args)
const DEFAULT_EMAIL = 'admin@okboxbox.com';
const DEFAULT_PASSWORD = 'ControlBox2024!';
const DEFAULT_NAME = 'Admin User';

async function main() {
    const email = process.argv[2] || DEFAULT_EMAIL;
    const password = process.argv[3] || DEFAULT_PASSWORD;
    const displayName = process.argv[4] || DEFAULT_NAME;

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         ControlBox - Database Setup                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log();

    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
    });

    try {
        // Test connection
        console.log('🔌 Connecting to database...');
        await pool.query('SELECT NOW()');
        console.log('✅ Connected!');
        console.log();

        // Run migrations
        console.log('📦 Running migrations...');
        await runMigrations(pool);
        console.log('✅ Migrations complete!');
        console.log();

        // Create admin user
        console.log('👤 Creating admin user...');
        await createAdminUser(pool, email, password, displayName);
        console.log('✅ Admin user created!');
        console.log();

        console.log('═══════════════════════════════════════════════════════════');
        console.log();
        console.log('🎉 Setup complete! You can now log in with:');
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        console.log();
        console.log('═══════════════════════════════════════════════════════════');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

async function runMigrations(pool) {
    const migrationsDir = join(__dirname, '../packages/server/src/db/migrations');
    const files = readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    // Create migrations tracking table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMP DEFAULT NOW()
        )
    `);

    for (const file of files) {
        // Check if already applied
        const result = await pool.query(
            'SELECT id FROM _migrations WHERE name = $1',
            [file]
        );

        if (result.rows.length > 0) {
            console.log(`   ⏭️  ${file} (already applied)`);
            continue;
        }

        // Apply migration
        console.log(`   🔄 ${file}`);
        const sql = readFileSync(join(migrationsDir, file), 'utf8');

        try {
            await pool.query(sql);
            await pool.query(
                'INSERT INTO _migrations (name) VALUES ($1)',
                [file]
            );
        } catch (error) {
            console.error(`   ❌ Error in ${file}:`, error.message);
            throw error;
        }
    }
}

async function createAdminUser(pool, email, password, displayName) {
    // Check if user already exists
    const existing = await pool.query(
        'SELECT id FROM admin_users WHERE email = $1',
        [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
        console.log(`   ⏭️  User ${email} already exists`);
        return;
    }

    // Hash password
    const passwordHash = await hash(password, BCRYPT_ROUNDS);

    // Create user
    await pool.query(`
        INSERT INTO admin_users (email, password_hash, display_name, is_super_admin, is_active, email_verified)
        VALUES ($1, $2, $3, true, true, true)
    `, [email.toLowerCase(), passwordHash, displayName]);

    console.log(`   ✅ Created: ${email} (Super Admin)`);
}

main().catch(console.error);
