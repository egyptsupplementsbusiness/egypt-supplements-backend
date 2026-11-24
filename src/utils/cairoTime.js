// The shop runs on Cairo time. The server (Vercel) runs on UTC, so "this
// month" and month-by-month reports are worked out in Cairo time here.
export const SHOP_TIMEZONE = "Africa/Cairo";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TIMEZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

const cairoParts = (date) =>
  Object.fromEntries(
    partsFormatter
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );

// How far ahead of UTC Cairo is at that moment (2 or 3 hours)
const offsetMs = (date) => {
  const p = cairoParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

/** Today's year and month (1-12) in Cairo. */
export const cairoToday = () => {
  const p = cairoParts(new Date());
  return { year: p.year, month: p.month };
};

/** The moment a Cairo calendar day starts. Month may over/underflow (e.g. 0 or 13). */
export const cairoStartOf = (year, month = 1, day = 1) => {
  const guess = Date.UTC(year, month - 1, day);
  const first = new Date(guess - offsetMs(new Date(guess)));
  // Re-check the offset at the real moment (around daylight-saving changes)
  return new Date(guess - offsetMs(first));
};
