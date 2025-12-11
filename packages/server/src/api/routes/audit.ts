// =====================================================================
// Audit Log API Routes
// Comprehensive audit logging viewer
// =====================================================================

import { Router, Request, Response } from 'express';
import { pool } from '../../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import type { AuditLogQuery, CreateAuditLogRequest } from '@controlbox/common';

const router = Router();

// ========================
// Audit Log Service
// ========================

export async function logAuditEvent(event: CreateAuditLogRequest & { userAgent?: string }): Promise<void> {
    try {
        await pool.query(`
            INSERT INTO audit_log (
                actor_id, actor_email, actor_ip,
                action, entity_type, entity_id,
                description, old_value, new_value,
                user_agent, league_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            event.actorId || null,
            event.actorEmail || null,
            event.actorIp || null,
            event.action,
            event.entityType,
            event.entityId || null,
            event.description || null,
            event.oldValue ? JSON.stringify(event.oldValue) : null,
            event.newValue ? JSON.stringify(event.newValue) : null,
            event.userAgent || null,
            event.leagueId || null
        ]);
    } catch (error) {
        console.error('Failed to log audit event:', error);
        // Don't throw - audit logging should not break the main flow
    }
}

// ========================
// Routes
// ========================

// List audit logs
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const {
            leagueId, actorId, entityType, entityId,
            action, startDate, endDate,
            limit = 100, offset = 0
        } = req.query as AuditLogQuery & { limit?: number; offset?: number };

        let query = `
            SELECT al.*, au.display_name as actor_name
            FROM audit_log al
            LEFT JOIN admin_users au ON al.actor_id = au.id
            WHERE 1=1
        `;
        const params: unknown[] = [];
        let paramCount = 0;

        if (leagueId) {
            paramCount++;
            query += ` AND al.league_id = $${paramCount}`;
            params.push(leagueId);
        }

        if (actorId) {
            paramCount++;
            query += ` AND al.actor_id = $${paramCount}`;
            params.push(actorId);
        }

        if (entityType) {
            paramCount++;
            query += ` AND al.entity_type = $${paramCount}`;
            params.push(entityType);
        }

        if (entityId) {
            paramCount++;
            query += ` AND al.entity_id = $${paramCount}`;
            params.push(entityId);
        }

        if (action) {
            paramCount++;
            query += ` AND al.action = $${paramCount}`;
            params.push(action);
        }

        if (startDate) {
            paramCount++;
            query += ` AND al.created_at >= $${paramCount}`;
            params.push(startDate);
        }

        if (endDate) {
            paramCount++;
            query += ` AND al.created_at <= $${paramCount}`;
            params.push(endDate);
        }

        query += ` ORDER BY al.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                actorId: row.actor_id,
                actorName: row.actor_name,
                actorEmail: row.actor_email,
                actorIp: row.actor_ip,
                action: row.action,
                entityType: row.entity_type,
                entityId: row.entity_id,
                description: row.description,
                oldValue: row.old_value,
                newValue: row.new_value,
                leagueId: row.league_id,
                createdAt: row.created_at
            }))
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch audit logs' } });
    }
});

// Get audit log for specific entity
router.get('/entity/:type/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { type, id } = req.params;

        const result = await pool.query(`
            SELECT al.*, au.display_name as actor_name
            FROM audit_log al
            LEFT JOIN admin_users au ON al.actor_id = au.id
            WHERE al.entity_type = $1 AND al.entity_id = $2
            ORDER BY al.created_at DESC
            LIMIT 50
        `, [type, id]);

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                actorId: row.actor_id,
                actorName: row.actor_name,
                action: row.action,
                description: row.description,
                oldValue: row.old_value,
                newValue: row.new_value,
                createdAt: row.created_at
            }))
        });
    } catch (error) {
        console.error('Error fetching entity audit log:', error);
        res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch audit log' } });
    }
});

// Get audit stats
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
    try {
        const { leagueId, days = 7 } = req.query;

        let query = `
            SELECT 
                action,
                COUNT(*) as count,
                DATE(created_at) as date
            FROM audit_log
            WHERE created_at >= NOW() - INTERVAL '${parseInt(days as string)} days'
        `;
        const params: unknown[] = [];

        if (leagueId) {
            query += ` AND league_id = $1`;
            params.push(leagueId);
        }

        query += ` GROUP BY action, DATE(created_at) ORDER BY date, action`;

        const result = await pool.query(query, params);

        // Aggregate by action
        const byAction: Record<string, number> = {};
        const byDate: Record<string, number> = {};

        for (const row of result.rows) {
            byAction[row.action] = (byAction[row.action] || 0) + parseInt(row.count);
            byDate[row.date] = (byDate[row.date] || 0) + parseInt(row.count);
        }

        res.json({
            success: true,
            data: {
                byAction,
                byDate,
                totalEvents: Object.values(byAction).reduce((a, b) => a + b, 0)
            }
        });
    } catch (error) {
        console.error('Error fetching audit stats:', error);
        res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch audit stats' } });
    }
});

export default router;
