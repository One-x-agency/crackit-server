import dotenv from 'dotenv';
import path from 'path';
import z from 'zod';

dotenv.config({
    path: path.join(process.cwd(), '.env'),
    override: true,
});

const logLevel = z.enum(['false', 'error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']);

const envSchema = z.object({
    ENV: z.enum(['development', 'production', 'stage']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3007),
    SERVICE_NAME: z.string().min(1).max(255).default('rrb-prep'),

    // Authentication (anonymous learner token, no login)
    JWT_SECRET: z.string().min(5).max(255),

    // Logging
    CONSOLE_LOG_LEVEL: logLevel.default('info'),
    FILE_LOG_LEVEL: logLevel.default('info'),

    // Database
    DATABASE_URL: z.url(),
});

const { data: env, error } = envSchema.safeParse(process.env);

if (error) throw new Error(`Invalid ENV options: ${error.message}`);

export default env;
