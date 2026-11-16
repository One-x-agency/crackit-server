import z from 'zod';

/** IANA timezone such as "Asia/Kolkata"; bad values fall back to the default instead of hitting Postgres. */
export const timezoneSchema = z
    .string()
    .default('Asia/Kolkata')
    .transform((tz) => {
        try {
            new Intl.DateTimeFormat('en', { timeZone: tz });
            return tz;
        } catch {
            return 'Asia/Kolkata';
        }
    });
