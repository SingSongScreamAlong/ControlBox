// =====================================================================
// Express Application Setup
// =====================================================================

import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/index.js';
import { apiRouter } from './api/routes/index.js';
import { errorHandler } from './api/middleware/error-handler.js';

export const app: Express = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
}));

// Request logging
if (config.nodeEnv !== 'test') {
    app.use(morgan(config.logFormat));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', apiRouter);

// Error handling
app.use(errorHandler);
