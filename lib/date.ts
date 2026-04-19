export type DateFormat = "short" | "long" | "medium";

const FORMATTERS: Record<DateFormat, Intl.DateTimeFormat> = {
  short: new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }),
  medium: new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }),
  long: new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }),
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatDateUTC(value: string, format: DateFormat = "short"): string {
  const normalized = DATE_ONLY.test(value) ? `${value}T00:00:00Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return FORMATTERS[format].format(date);
}
