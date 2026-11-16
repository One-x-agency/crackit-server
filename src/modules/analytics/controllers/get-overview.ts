import type { NextFunction, Request, Response } from 'express';
import z from 'zod';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import { accuracy, getItemStats } from '../analytics.service.js';
import { timezoneSchema } from '../analytics.schema.js';

export const ValidationSchema = {
    query: z.object({
        days: z.coerce.number().int().min(1).max(365).default(30),
        tz: timezoneSchema,
    }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
    const { days, tz } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;
    const learnerId = req.user!.id;

    const totals = await db.queryOne(
        `SELECT (SELECT count(*) FROM attempts WHERE learner_id = $1 AND started_at >= now() - make_interval(days => $2))::int AS attempts,
                count(*)::int AS answered,
                count(*) FILTER (WHERE is_correct)::int AS correct,
                round(avg(time_ms))::int AS avg_time_ms
         FROM answers WHERE learner_id = $1 AND answered_at >= now() - make_interval(days => $2)`,
        [learnerId, days],
    );

    const perQuiz = await db.queryAll(
        `SELECT quiz_id, count(*)::int AS answered, count(*) FILTER (WHERE is_correct)::int AS correct,
                round(avg(time_ms))::int AS avg_time_ms
         FROM answers WHERE learner_id = $1 AND answered_at >= now() - make_interval(days => $2)
         GROUP BY quiz_id ORDER BY quiz_id`,
        [learnerId, days],
    );

    // Streak counts consecutive practice days up to today (or yesterday) in the learner's timezone.
    const dayRows = await db.queryAll<{ d: string }>(
        `SELECT DISTINCT to_char((answered_at AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS d
         FROM answers WHERE learner_id = $1 ORDER BY d DESC LIMIT 400`,
        [learnerId, tz],
    );
    const today = await db.queryOne<{ d: string }>(`SELECT to_char((now() AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS d`, [tz]);
    let streak = 0;
    let cursor = new Date(`${today!.d}T00:00:00Z`);
    const have = new Set(dayRows.map((r) => r.d));
    if (!have.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
    while (have.has(cursor.toISOString().slice(0, 10))) {
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    // Mastery picture comes from all-time per-item stats.
    const items = await getItemStats(db, learnerId, null);
    const mastery: Record<string, { items: number; weak: number; recovered: number; solid: number }> = {};
    for (const it of items) {
        const m = (mastery[it.quiz_id] ??= { items: 0, weak: 0, recovered: 0, solid: 0 });
        m.items++;
        if (it.status === 'weak') m.weak++;
        else if (it.status === 'recovered') m.recovered++;
        else if (it.status === 'solid') m.solid++;
    }

    return res.status(STATUS_CODES.OK).json({
        days,
        totals: {
            attempts: totals!.attempts,
            answered: totals!.answered,
            correct: totals!.correct,
            accuracy: accuracy(totals!.correct, totals!.answered),
            avgTimeMs: totals!.avg_time_ms,
            activeDays: dayRows.length,
            streakDays: streak,
        },
        quizzes: perQuiz.map((q) => ({
            quizId: q.quiz_id,
            answered: q.answered,
            correct: q.correct,
            accuracy: accuracy(q.correct, q.answered),
            avgTimeMs: q.avg_time_ms,
            mastery: mastery[q.quiz_id] ?? { items: 0, weak: 0, recovered: 0, solid: 0 },
        })),
    });
}
