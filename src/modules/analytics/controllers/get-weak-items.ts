import type { NextFunction, Request, Response } from 'express';
import z from 'zod';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import { getItemStats } from '../analytics.service.js';

export const ValidationSchema = {
    query: z.object({
        quizId: z.string().trim().min(1).max(50).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        // mistakes = every question you have ever got wrong (weak, ok or recovered)
        status: z.enum(['mistakes', 'weak', 'ok', 'recovered']).default('mistakes'),
    }),
};

/** "You answered 23² wrong 4 of 6 times; you usually said 509". Ranked by most mistakes first. */
export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
    const { quizId, limit, status } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;
    const learnerId = req.user!.id;

    const items = (await getItemStats(db, learnerId, quizId ?? null))
        .filter((i) => (status === 'mistakes' ? i.wrong > 0 : i.status === status))
        .sort((a, b) => b.wrong - a.wrong || b.error_rate - a.error_rate || b.avg_time_ms - a.avg_time_ms)
        .slice(0, limit);

    const wrongRows = items.length
        ? await db.queryAll<{ quiz_id: string; item_key: string; given_answer: number; times: number }>(
              `SELECT quiz_id, item_key, given_answer::float8 AS given_answer, count(*)::int AS times
               FROM answers
               WHERE learner_id = $1 AND NOT is_correct
                 AND quiz_id = ANY($2::text[]) AND item_key = ANY($3::text[])
               GROUP BY 1, 2, 3 ORDER BY times DESC`,
              [learnerId, [...new Set(items.map((i) => i.quiz_id))], [...new Set(items.map((i) => i.item_key))]],
          )
        : [];

    return res.status(STATUS_CODES.OK).json({
        status,
        items: items.map((i) => ({
            quizId: i.quiz_id,
            itemKey: i.item_key,
            prompt: i.prompt,
            status: i.status,
            correctAnswer: i.correct_answer,
            attempts: i.attempts,
            wrong: i.wrong,
            errorRate: i.error_rate,
            avgTimeMs: i.avg_time_ms,
            lastWrongAt: i.last_wrong_at,
            commonWrongAnswers: wrongRows
                .filter((w) => w.quiz_id === i.quiz_id && w.item_key === i.item_key)
                .slice(0, 3)
                .map((w) => ({ answer: w.given_answer, times: w.times })),
        })),
    });
}
