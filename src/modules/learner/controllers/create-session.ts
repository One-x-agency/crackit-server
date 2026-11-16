import type { NextFunction, Request, Response } from 'express';
import z from 'zod';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import { createJWTToken } from '@/shared/utilities/token.js';
import { TOKEN_TYPES } from '../learner.constant.js';

export const ValidationSchema = {
    body: z.object({
        deviceId: z.uuid(),
    }),
};

/** No login: the browser keeps a random deviceId; we map it to a learner row and hand back a token. */
export async function Controller(
    req: Request,
    res: Response,
    next: NextFunction,
    db: DatabaseClient,
) {
    const { deviceId } = req.body as z.infer<typeof ValidationSchema.body>;

    const learner = await db.queryOne<{ id: string; created_at: string }>(
        `INSERT INTO learners (device_id) VALUES ($1)
         ON CONFLICT (device_id) DO UPDATE SET last_seen_at = now()
         RETURNING id, created_at`,
        [deviceId],
    );

    const token = await createJWTToken(
        { type: TOKEN_TYPES.LEARNER_ACCESS_TOKEN, learner_id: learner!.id },
        '180d',
    );

    return res.status(STATUS_CODES.OK).json({ token, learner: { id: learner!.id } });
}
