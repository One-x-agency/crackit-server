import type { NextFunction, Request, Response } from 'express';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import { decodeJWTToken } from '@/shared/utilities/token.js';
import { TOKEN_TYPES } from '../learner.constant.js';

type LearnerToken = { type: string; learner_id: string };

export default async function authenticate(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = token ? await decodeJWTToken<LearnerToken>(token) : null;

    if (!payload || payload.type !== TOKEN_TYPES.LEARNER_ACCESS_TOKEN || !payload.learner_id)
        return res.status(STATUS_CODES.UNAUTHORIZED).json({ code: 'unauthorized', message: 'Invalid or expired token' });

    req.user = { id: payload.learner_id };
    next();
}
