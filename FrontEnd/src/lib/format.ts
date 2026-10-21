const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
const shortDayFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const relativeFormat = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

/** "2026-10-20" (jour renvoyé par /stats) → "20 oct." */
export const formatShortDay = (day: string) => shortDayFormat.format(new Date(`${day}T12:00:00Z`));

export function formatRelative(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
  }
  return "à l'instant";
}

export function ageInDays(iso: string, now = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / (24 * 3600 * 1000));
}
