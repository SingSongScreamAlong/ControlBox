// =====================================================================
// Rulebook Interpretation Service
// AI-powered natural-language rulebook parsing using GPT-5
// =====================================================================

import { v4 as uuid } from 'uuid';
import { pool } from '../../db/client.js';
import { chatCompletion, isLLMConfigured } from '../ai/llm-service.js';
import type {
    InterpretedRule,
    InterpretationSession,
    InterpretRulebookRequest,
    InterpretRulebookResponse
} from '@controlbox/common';
import type { Rule, RuleCondition, PenaltyDefinition } from '@controlbox/common';

// Available fields for conditions
const CONDITION_FIELDS = [
    'incident.type',
    'incident.contactType',
    'incident.severity',
    'incident.severityScore',
    'incident.lapNumber',
    'incident.trackPosition',
    'driver.incidentCount',
    'driver.warningCount',
    'driver.previousPenalties',
    'session.type',
    'session.flagState',
    'context.isUnderCaution',
    'context.isInPitLane',
    'context.positionBattle'
];

const INCIDENT_TYPES = [
    'contact', 'spin', 'off_track', 'unsafe_rejoin', 'pit_violation',
    'blocking', 'yellow_flag_violation', 'track_limits', 'loss_of_control'
];

const PENALTY_TYPES = [
    'warning', 'reprimand', 'time_penalty', 'position_penalty',
    'drive_through', 'stop_go', 'disqualification', 'grid_penalty',
    'points_deduction', 'race_ban'
];

export class RulebookInterpretationService {
    /**
     * Interpret raw rulebook text into structured rules
     * Uses LLM when available, falls back to deterministic parsing
     */
    async interpretRulebook(
        rulebookId: string,
        request: InterpretRulebookRequest,
        userId: string
    ): Promise<InterpretRulebookResponse> {
        const startTime = Date.now();
        const useLLM = isLLMConfigured();

        // Create session
        const sessionId = uuid();
        let allRules: InterpretedRule[] = [];
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;
        const sectionsFound: string[] = [];

        if (useLLM) {
            // LLM-based parsing
            const chunks = this.splitIntoChunks(request.rawText, 3000);

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const result = await this.parseChunk(chunk, request.discipline || 'general', i + 1);

                if (result.rules) {
                    allRules.push(...result.rules);
                }
                if (result.sections) {
                    sectionsFound.push(...result.sections);
                }
                if (result.tokens) {
                    totalPromptTokens += result.tokens.prompt;
                    totalCompletionTokens += result.tokens.completion;
                }
            }
        } else {
            // Deterministic fallback parsing
            const { deterministicParser } = await import('./deterministic-parser.js');
            allRules = deterministicParser.parseText(request.rawText, request.discipline);
            sectionsFound.push('deterministic-parse');
        }

        // Save session to database
        await this.saveSession({
            id: sessionId,
            rulebookId,
            fileName: request.fileName || 'upload.txt',
            fileType: this.detectFileType(request.fileName),
            sourceCharCount: request.rawText.length,
            extractedText: request.rawText,
            interpretedRules: allRules,
            status: 'ready',
            stats: {
                totalRulesFound: allRules.length,
                approved: 0,
                rejected: 0,
                pending: allRules.length,
                byConfidence: {
                    LOW: allRules.filter(r => r.confidence === 'LOW').length,
                    MEDIUM: allRules.filter(r => r.confidence === 'MEDIUM').length,
                    HIGH: allRules.filter(r => r.confidence === 'HIGH').length
                },
                byCategory: {
                    INCIDENT: allRules.filter(r => r.category === 'INCIDENT').length,
                    PENALTY: allRules.filter(r => r.category === 'PENALTY').length,
                    START_PROC: allRules.filter(r => r.category === 'START_PROC').length,
                    RACE_CONTROL: allRules.filter(r => r.category === 'RACE_CONTROL').length,
                    CONDUCT: allRules.filter(r => r.category === 'CONDUCT').length,
                    OTHER: allRules.filter(r => r.category === 'OTHER').length
                }
            },
            createdBy: userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return {
            sessionId,
            rules: allRules,
            metadata: {
                processingTimeMs: Date.now() - startTime,
                sectionsFound
            }
        };
    }

    /**
     * Parse a single chunk of text
     */
    private async parseChunk(
        text: string,
        discipline: string,
        chunkIndex: number
    ): Promise<{
        rules: InterpretedRule[];
        sections: string[];
        tokens?: { prompt: number; completion: number };
    }> {
        const systemPrompt = `You are an expert motorsport rulebook parser. Your task is to extract racing rules from natural language text and convert them into structured rule definitions.

For each rule you identify, extract:
1. The rule title/name
2. A reference number if present (e.g., "3.2.1", "Article 5")
3. The conditions that trigger the rule (what incident types, severity levels, etc.)
4. The penalty or action specified
5. Any exceptions or special cases

Output your response as a JSON array of rules.

Available incident types: ${INCIDENT_TYPES.join(', ')}
Available penalty types: ${PENALTY_TYPES.join(', ')}
Available condition fields: ${CONDITION_FIELDS.join(', ')}

Racing discipline context: ${discipline}`;

        const userPrompt = `Parse the following rulebook text (chunk ${chunkIndex}) and extract all rules:

---
${text}
---

Return a JSON object with this structure:
{
  "sections": ["Section names found"],
  "rules": [
    {
      "reference": "Rule number/reference",
      "title": "Rule title",
      "description": "Full rule text",
      "summary": "Brief summary",
      "conditions": [
        {
          "field": "incident.type",
          "operator": "eq",
          "value": "contact"
        }
      ],
      "penalty": {
        "type": "warning|time_penalty|etc",
        "value": "5 seconds",
        "points": 2
      },
      "priority": 50,
      "stewardNotes": "Additional context"
    }
  ]
}`;

        const result = await chatCompletion([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], {
            temperature: 0.2,
            maxTokens: 4000
        });

        if (!result.success || !result.content) {
            console.error('Failed to parse chunk:', result.error);
            return { rules: [], sections: [] };
        }

        try {
            // Extract JSON from response
            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { rules: [], sections: [] };
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // Convert to InterpretedRule format
            const interpretedRules: InterpretedRule[] = (parsed.rules || []).map((r: Partial<Rule> & { description?: string }) => ({
                id: uuid(),
                originalText: r.description || '',
                aiSummary: r.summary || r.title || '',
                confidence: 0.8, // Base confidence
                structuredRule: {
                    id: uuid(),
                    reference: r.reference || '',
                    title: r.title || 'Untitled Rule',
                    description: r.description || '',
                    summary: r.summary,
                    conditions: this.normalizeConditions(r.conditions || []),
                    penalty: this.normalizePenalty(r.penalty),
                    priority: r.priority || 50,
                    isActive: true,
                    stewardNotes: r.stewardNotes
                },
                status: 'pending' as const,
                interpretedAt: new Date()
            }));

            return {
                rules: interpretedRules,
                sections: parsed.sections || [],
                tokens: result.tokens
            };
        } catch (e) {
            console.error('Failed to parse JSON response:', e);
            return { rules: [], sections: [] };
        }
    }

    /**
     * Normalize conditions from AI response
     */
    private normalizeConditions(conditions: Partial<RuleCondition>[]): RuleCondition[] {
        return conditions.map(c => ({
            field: c.field || 'incident.type',
            operator: c.operator || 'eq',
            value: c.value ?? '',
            and: c.and ? this.normalizeConditions(c.and) : undefined,
            or: c.or ? this.normalizeConditions(c.or) : undefined
        }));
    }

    /**
     * Normalize penalty from AI response
     */
    private normalizePenalty(penalty?: Partial<PenaltyDefinition>): PenaltyDefinition {
        return {
            type: penalty?.type || 'warning',
            value: penalty?.value,
            points: penalty?.points,
            durationSeconds: penalty?.durationSeconds,
            positionPenalty: penalty?.positionPenalty,
            notes: penalty?.notes
        };
    }

    /**
     * Split text into manageable chunks
     */
    private splitIntoChunks(text: string, maxLength: number): string[] {
        const chunks: string[] = [];
        const paragraphs = text.split(/\n\n+/);

        let currentChunk = '';

        for (const para of paragraphs) {
            if (currentChunk.length + para.length > maxLength && currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = para;
            } else {
                currentChunk += '\n\n' + para;
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks.length > 0 ? chunks : [text];
    }

    /**
     * Detect file type from filename
     */
    private detectFileType(fileName?: string): 'txt' | 'md' | 'pdf' {
        if (!fileName) return 'txt';
        if (fileName.endsWith('.md')) return 'md';
        if (fileName.endsWith('.pdf')) return 'pdf';
        return 'txt';
    }

    /**
     * Save session to database
     */
    private async saveSession(session: InterpretationSession): Promise<void> {
        await pool.query(
            `INSERT INTO rulebook_interpretation_sessions 
                (id, rulebook_id, file_name, file_type, source_char_count, extracted_text, 
                 interpreted_rules, status, stats, created_by, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                session.id,
                session.rulebookId,
                session.fileName,
                session.fileType,
                session.sourceCharCount,
                session.extractedText,
                JSON.stringify(session.interpretedRules),
                session.status,
                JSON.stringify(session.stats),
                session.createdBy,
                session.createdAt,
                session.updatedAt
            ]
        );
    }

    /**
     * Get session by ID
     */
    async getSession(sessionId: string): Promise<InterpretationSession | null> {
        const result = await pool.query(
            `SELECT * FROM rulebook_interpretation_sessions WHERE id = $1`,
            [sessionId]
        );

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            id: row.id,
            rulebookId: row.rulebook_id,
            fileName: row.file_name,
            fileType: row.file_type,
            sourceCharCount: row.source_char_count,
            extractedText: row.extracted_text,
            interpretedRules: row.interpreted_rules,
            status: row.status,
            stats: row.stats,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    /**
     * Update rule status (approve/reject)
     */
    async updateRuleStatus(
        sessionId: string,
        ruleId: string,
        status: 'approved' | 'rejected',
        notes?: string
    ): Promise<void> {
        const session = await this.getSession(sessionId);
        if (!session) throw new Error('Session not found');

        const rule = session.interpretedRules.find(r => r.id === ruleId);
        if (!rule) throw new Error('Rule not found');

        rule.status = status;
        if (notes) rule.adminNotes = notes;

        // Update stats
        session.stats.pending = session.interpretedRules.filter(r => r.status === 'pending').length;
        session.stats.approved = session.interpretedRules.filter(r => r.status === 'approved').length;
        session.stats.rejected = session.interpretedRules.filter(r => r.status === 'rejected').length;

        await pool.query(
            `UPDATE rulebook_interpretation_sessions 
             SET interpreted_rules = $2, stats = $3, updated_at = NOW()
             WHERE id = $1`,
            [sessionId, JSON.stringify(session.interpretedRules), JSON.stringify(session.stats)]
        );
    }

    /**
     * Bulk update rule statuses
     */
    async bulkUpdateStatus(
        sessionId: string,
        ruleIds: string[],
        status: 'approved' | 'rejected'
    ): Promise<void> {
        for (const ruleId of ruleIds) {
            await this.updateRuleStatus(sessionId, ruleId, status);
        }
    }

    /**
     * Commit approved rules to rulebook
     */
    async commitRules(
        sessionId: string,
        ruleIds: string[]
    ): Promise<{ committedCount: number; committedRuleIds: string[] }> {
        const session = await this.getSession(sessionId);
        if (!session) throw new Error('Session not found');

        const rulesToCommit = session.interpretedRules.filter(
            r => ruleIds.includes(r.id) && r.status === 'approved'
        );

        if (rulesToCommit.length === 0) {
            return { committedCount: 0, committedRuleIds: [] };
        }

        // Get existing rulebook
        const rulebookResult = await pool.query(
            `SELECT rules FROM rulebooks WHERE id = $1`,
            [session.rulebookId]
        );

        if (rulebookResult.rows.length === 0) {
            throw new Error('Rulebook not found');
        }

        const existingRules = rulebookResult.rows[0].rules || [];
        const newRules = rulesToCommit.map(r => r.structuredRule);

        // Append new rules
        const updatedRules = [...existingRules, ...newRules];

        await pool.query(
            `UPDATE rulebooks SET rules = $2, updated_at = NOW() WHERE id = $1`,
            [session.rulebookId, JSON.stringify(updatedRules)]
        );

        // Update session status
        await pool.query(
            `UPDATE rulebook_interpretation_sessions SET status = 'committed', updated_at = NOW() WHERE id = $1`,
            [sessionId]
        );

        return {
            committedCount: rulesToCommit.length,
            committedRuleIds: rulesToCommit.map(r => r.structuredRule.id)
        };
    }
}

// Singleton
let interpretationService: RulebookInterpretationService | null = null;

export function getRulebookInterpretationService(): RulebookInterpretationService {
    if (!interpretationService) {
        interpretationService = new RulebookInterpretationService();
    }
    return interpretationService;
}
