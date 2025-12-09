// =====================================================================
// Health Check Routes
// =====================================================================

import { Router, type Request, type Response } from 'express';
import type { HealthCheckResponse } from '@controlbox/common';
import { pool } from '../../db/client.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
    const startTime = process.uptime();

    // Check database
    let dbStatus: 'ok' | 'error' = 'error';
    try {
        await pool.query('SELECT 1');
        dbStatus = 'ok';
    } catch {
        dbStatus = 'error';
    }

    // TODO: Check Redis when implemented
    const redisStatus: 'ok' | 'error' = 'ok';

    // AI is optional
    const aiStatus: 'ok' | 'error' | 'disabled' = 'disabled';

    const isHealthy = dbStatus === 'ok';

    const response: HealthCheckResponse = {
        status: isHealthy ? 'healthy' : 'degraded',
        version: '0.1.0-alpha',
        uptime: startTime,
        checks: {
            database: dbStatus,
            redis: redisStatus,
            ai: aiStatus,
        },
        timestamp: new Date().toISOString(),
    };

    res.status(isHealthy ? 200 : 503).json({
        success: true,
        data: response,
    });
});

healthRouter.get('/ready', async (_req: Request, res: Response) => {
    // Readiness check - is the server ready to accept traffic
    try {
        await pool.query('SELECT 1');
        res.json({ ready: true });
    } catch {
        res.status(503).json({ ready: false });
    }
});
