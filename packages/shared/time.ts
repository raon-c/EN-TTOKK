import { TZDate, tz } from "@date-fns/tz";
import { endOfDay, format, isValid, startOfDay } from "date-fns";

export const KST_TIMEZONE = "Asia/Seoul" as const;
export const KST_LOCALE = "ko-KR" as const;
const kstContext = tz(KST_TIMEZONE);

const kstDateFormatter = new Intl.DateTimeFormat(KST_LOCALE, {
  timeZone: KST_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const kstTimeFormatter = new Intl.DateTimeFormat(KST_LOCALE, {
  timeZone: KST_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const kstDateTimeFormatter = new Intl.DateTimeFormat(KST_LOCALE, {
  timeZone: KST_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export const formatKstDate = (date: Date) => kstDateFormatter.format(date);

export const formatKstTime = (date: Date) => kstTimeFormatter.format(date);

export const formatKstDateTime = (date: Date) =>
  kstDateTimeFormatter.format(date);

export const formatInKst = (date: Date, formatString: string) =>
  format(date, formatString, { in: kstContext });

export const getKstDateKey = (date: Date) =>
  format(date, "yyyy-MM-dd", { in: kstContext });

export const parseDateKeyInTimeZone = (value: string, timeZone: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new TZDate(year, month - 1, day, timeZone);
  if (!isValid(parsed)) return null;
  return parsed;
};

export const parseKstDateKey = (value: string) =>
  parseDateKeyInTimeZone(value, KST_TIMEZONE);

export const startOfKstDay = (date: Date) => {
  return startOfDay(date, { in: kstContext });
};

export const endOfKstDay = (date: Date) => {
  return endOfDay(date, { in: kstContext });
};
