import { parseISO } from "date-fns";
import {
  endOfKstDay,
  formatInKst,
  getKstDateKey,
  KST_TIMEZONE,
  parseDateKeyInTimeZone,
  startOfKstDay,
} from "@/lib/shared";
import type { GoogleCalendarEvent } from "@/types/api";

export const getDateKey = (date: Date): string => getKstDateKey(date);

export const getEventDateKey = (event: GoogleCalendarEvent): string | null => {
  if (event.start?.date) {
    const timeZone = event.start.timeZone ?? KST_TIMEZONE;
    const parsed = parseDateKeyInTimeZone(event.start.date, timeZone);
    return parsed ? getKstDateKey(parsed) : event.start.date;
  }
  if (event.start?.dateTime) {
    return formatInKst(parseISO(event.start.dateTime), "yyyy-MM-dd");
  }
  return null;
};

export const filterEventsForDate = (
  events: GoogleCalendarEvent[],
  date: Date
) => {
  const targetKey = getDateKey(date);
  return events.filter((event) => getEventDateKey(event) === targetKey);
};

export const buildDayRange = (date: Date) => {
  const timeMin = startOfKstDay(date);
  const timeMax = endOfKstDay(date);
  return {
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
  };
};
