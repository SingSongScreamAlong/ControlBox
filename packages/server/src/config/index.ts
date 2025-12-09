// =====================================================================
// Server Configuration
// =====================================================================

export const config = {
    // Server
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || 'localhost',

    // Database
    databaseUrl: process.env.DATABASE_URL || 'postgresql://controlbox:controlbox_dev@localhost:5432/controlbox',
    databasePoolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),

    // Redis
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    // JWT
    jwtSecret: process.env.JWT_SECRET || 'controlbox_dev_secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',

    // CORS
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(','),

    // AI
    aiInferenceUrl: process.env.AI_INFERENCE_URL || 'http://localhost:8000',
    aiModelId: process.env.AI_MODEL_ID || 'default',

    // iRacing Relay
    iracingRelayHost: process.env.IRACING_RELAY_HOST || 'localhost',
    iracingRelayPort: parseInt(process.env.IRACING_RELAY_PORT || '3002', 10),

    // Logging
    logLevel: process.env.LOG_LEVEL || 'debug',
    logFormat: process.env.LOG_FORMAT || 'dev',
} as const;

// Validate required production configs
if (config.nodeEnv === 'production') {
    if (config.jwtSecret === 'controlbox_dev_secret') {
        throw new Error('JWT_SECRET must be set in production');
    }
}
