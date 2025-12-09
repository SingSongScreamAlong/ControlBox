// =====================================================================
// Database Client
// =====================================================================

import { Pool } from 'pg';
import { config } from '../config/index.js';

export const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.databasePoolSize,
});

export async function initializeDatabase(): Promise<void> {
    // Test the connection
    const client = await pool.connect();
    try {
        await client.query('SELECT NOW()');
    } finally {
        client.release();
    }
}

export async function query<T = unknown>(
    text: string,
    params?: unknown[]
): Promise<T[]> {
    const result = await pool.query(text, params);
    return result.rows as T[];
}

export async function queryOne<T = unknown>(
    text: string,
    params?: unknown[]
): Promise<T | null> {
    const rows = await query<T>(text, params);
    return rows[0] || null;
}

// Graceful shutdown
process.on('SIGTERM', () => pool.end());
process.on('SIGINT', () => pool.end());
