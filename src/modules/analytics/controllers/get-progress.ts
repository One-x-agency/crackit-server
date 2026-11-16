import type { NextFunction, Request, Response } from 'express';
import z from 'zod';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import { accuracy } from '../analytics.service.js';
import { timezoneSchema } from '../analytics.schema.js';

export const ValidationSchema = {
    query: z.object({
        days: z.coerce.number().int().min(7).max(365).default(30),
        quizId: z.string().trim().min(1).max(50).optional(),
        tz: timezoneSchema,
    }),
};

type Bucket = { answered: number; correct: number; avg_time_ms: number | null };

const summarize = (b: Bucket) => ({
    answered: b.answered,
    accuracy: accuracy(b.correct, b.answered),
    avgTimeMs: b.avg_time_ms,
});

/** Daily series plus "this week vs last week" so you can see whether you are really improving. */
export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
    const { days, quizId, tz } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;
    const learnerId = req.user!.id;

    const daily = await db.queryAll(
        `SELECT to_char((answered_at AT TIME ZONE $4)::date, 'YYYY-MM-DD') AS day,
                count(*)::int AS answered,
                count(*) FILTER (WHERE is_correct)::int AS correct,
                round(avg(time_ms))::int AS avg_time_ms
         FROM answers
         WHERE learner_id = $1 AND answered_at >= now() - make_interval(days => $2)
           AND ($3::text IS NULL OR quiz_id = $3)
         GROUP BY 1 ORDER BY 1`,
        [learnerId, days, quizId ?? null, tz],
    );

    const windows = await db.queryAll<Bucket & { period: 'current' | 'previous' }>(
        `SELECT CASE WHEN answered_at >= now() - interval '7 days' THEN 'current' ELSE 'previous' END AS period,
                count(*)::int AS answered,
                count(*) FILTER (WHERE is_correct)::int AS correct,
                round(avg(time_ms))::int AS avg_time_ms
         FROM answers
         WHERE learner_id = $1 AND answered_at >= now() - interval '14 days'
           AND ($2::text IS NULL OR quiz_id = $2)
         GROUP BY 1`,
        [learnerId, quizId ?? null],
    );
    const empty: Bucket = { answered: 0, correct: 0, avg_time_ms: null };
    const cur = windows.find((w) => w.period === 'current') ?? empty;
    const prev = windows.find((w) => w.period === 'previous') ?? empty;

    const curAcc = accuracy(cur.correct, cur.answered);
    const prevAcc = accuracy(prev.correct, prev.answered);
    const trend = {
        current: summarize(cur),
        previous: summarize(prev),
        // percentage points; positive = more accurate than last week
        accuracyDelta: curAcc !== null && prevAcc !== null ? Math.round((curAcc - prevAcc) * 10) / 10 : null,
        // percent; negative = faster than last week
        speedChangePct:
            cur.avg_time_ms && prev.avg_time_ms
                ? Math.round(((cur.avg_time_ms - prev.avg_time_ms) / prev.avg_time_ms) * 1000) / 10
                : null,
        volumeDelta: cur.answered - prev.answered,
    };

    return res.status(STATUS_CODES.OK).json({
        days,
        quizId: quizId ?? null,
        daily: daily.map((d) => ({
            day: d.day,
            answered: d.answered,
            correct: d.correct,
            accuracy: accuracy(d.correct, d.answered),
            avgTimeMs: d.avg_time_ms,
        })),
        trend,
    });
}
