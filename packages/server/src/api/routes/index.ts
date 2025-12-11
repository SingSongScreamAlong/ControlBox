// =====================================================================
// API Routes Index
// =====================================================================

import { Router } from 'express';
import { sessionsRouter } from './sessions.js';
import { incidentsRouter } from './incidents.js';
import { penaltiesRouter } from './penalties.js';
import { rulebooksRouter } from './rulebooks.js';
import { reportsRouter } from './reports.js';
import { healthRouter } from './health.js';
import profilesRouter from './profiles.js';
import recommendationsRouter from './recommendations.js';
import authRouter from './auth.js';
import adminRouter from './admin.js';
import leaguesRouter from './leagues.js';
import eventsRouter from './events.js';
import artifactsRouter from './artifacts.js';
import eventReportsRouter from './event-reports.js';
import discordRouter from './discord.js';
import scoringRouter from './scoring.js';

export const apiRouter = Router();

// Health check (no auth required)
apiRouter.use('/health', healthRouter);

// Auth routes (login/logout, no auth required)
apiRouter.use('/auth', authRouter);

// Admin routes (super admin only)
apiRouter.use('/admin', adminRouter);

// League/series/season routes
apiRouter.use('/leagues', leaguesRouter);

// Core routes (require auth + license for protected operations)
apiRouter.use('/sessions', sessionsRouter);
apiRouter.use('/incidents', incidentsRouter);
apiRouter.use('/penalties', penaltiesRouter);
apiRouter.use('/rulebooks', rulebooksRouter);

// Discipline profiles
apiRouter.use('/profiles', profilesRouter);

// Recommendations
apiRouter.use('/recommendations', recommendationsRouter);

// Reports (nested under sessions - legacy)
apiRouter.use('/sessions', reportsRouter);

// Events and artifacts (post-race uploads)
apiRouter.use('/events', eventsRouter);
apiRouter.use('/artifacts', artifactsRouter);
apiRouter.use('/events', eventReportsRouter);

// Discord integration
apiRouter.use('/discord', discordRouter);
apiRouter.use('/', discordRouter);

// Scoring engine
apiRouter.use('/', scoringRouter);

// Public widgets (no auth)  
import widgetsRouter from './widgets.js';
apiRouter.use('/widgets', widgetsRouter);

// Broadcast overlays (no auth)
import overlayRouter from './overlay.js';
apiRouter.use('/overlay', overlayRouter);

// AI Commentary (no auth)
import commentaryRouter from './commentary.js';
apiRouter.use('/commentary', commentaryRouter);

// Paint/Livery Management
import paintsRouter from './paints.js';
apiRouter.use('/', paintsRouter);
apiRouter.use('/paints', paintsRouter);

// AI / GPT-5 Analysis
import aiRouter from './ai.js';
apiRouter.use('/ai', aiRouter);

// Rulebook AI Interpretation
import rulebookAiRouter from './rulebook-ai.js';
apiRouter.use('/rulebooks', rulebookAiRouter);

// Protests & Appeals (P0 Core)
import protestsRouter from './protests.js';
apiRouter.use('/protests', protestsRouter);

// Steward Voting Panels (P0 Core)
import panelsRouter from './panels.js';
apiRouter.use('/panels', panelsRouter);

// Teams (minimal scaffolding)
import teamsRouter from './teams.js';
apiRouter.use('/teams', teamsRouter);

// Audit Log (P0 Core)
import auditRouter from './audit.js';
apiRouter.use('/audit', auditRouter);


