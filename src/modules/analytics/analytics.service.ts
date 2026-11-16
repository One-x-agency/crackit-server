import type { DatabaseClient } from '@/shared/helpers/database.helper.js';

export type ItemStatus = 'weak' | 'ok' | 'recovered' | 'solid';

export type ItemStat = {
    quiz_id: string;
    item_key: string;
    prompt: string;
    correct_answer: number;
    attempts: number;
    wrong: number;
    error_rate: number;
    avg_time_ms: number;
    last_wrong_at: string | null;
    status: ItemStatus;
};

/**
 * Per question ("squares / 23") stats across all history.
 *  - weak:      error rate >= 40%, and not just fixed
 *  - recovered: was wrong before, but the last 2+ answers were all correct
 *  - solid:     never wrong
 *  - ok:        some mistakes, below the weak threshold
 */
export async function getItemStats(db: DatabaseClient, learnerId: string, quizId: string | null) {
    return db.queryAll<ItemStat>(
        `WITH ranked AS (
             SELECT quiz_id, item_key, prompt, correct_answer, is_correct, time_ms, answered_at,
                    row_number() OVER (PARTITION BY quiz_id, item_key ORDER BY answered_at DESC) AS rn
             FROM answers
             WHERE learner_id = $1 AND ($2::text IS NULL OR quiz_id = $2)
         ), items AS (
             SELECT quiz_id, item_key,
                    max(prompt) AS prompt,
                    max(correct_answer)::float8 AS correct_answer,
                    count(*)::int AS attempts,
                    count(*) FILTER (WHERE NOT is_correct)::int AS wrong,
                    round(avg(time_ms))::int AS avg_time_ms,
                    max(answered_at) FILTER (WHERE NOT is_correct) AS last_wrong_at,
                    count(*) FILTER (WHERE rn <= 2)::int AS recent_n,
                    count(*) FILTER (WHERE rn <= 2 AND NOT is_correct)::int AS recent_wrong
             FROM ranked GROUP BY quiz_id, item_key
         )
         SELECT quiz_id, item_key, prompt, correct_answer, attempts, wrong,
                round(wrong::numeric / attempts, 3)::float8 AS error_rate,
                avg_time_ms, last_wrong_at,
                CASE
                    WHEN wrong = 0 THEN 'solid'
                    WHEN recent_n >= 2 AND recent_wrong = 0 THEN 'recovered'
                    WHEN wrong::numeric / attempts >= 0.4 THEN 'weak'
                    ELSE 'ok'
                END AS status
         FROM items`,
        [learnerId, quizId],
    );
}

export function accuracy(correct: number, total: number) {
    return total ? Math.round((correct / total) * 1000) / 10 : null; // one decimal, e.g. 87.5
}
