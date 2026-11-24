// Is this the live site? True on Vercel (always), or when NODE_ENV is set to
// "production". Local development (start-all.bat) is not production.
export const IS_PRODUCTION = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
