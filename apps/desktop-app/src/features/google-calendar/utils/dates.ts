import { endOfDay, format, parseISO, startOfDay } from "date-fns";
import type { GoogleCalendarEvent } from "@enttokk/api-types";

export const getDateKey = (date: Date): string => format(date, "yyyy-MM-dd");

export const getEventDateKey = (
  event: GoogleCalendarEvent
): string | null => {
  if (event.start?.date) return event.start.date;
  if (event.start?.dateTime) {
    return format(parseISO(event.start.dateTime), "yyyy-MM-dd");
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
  const timeMin = startOfDay(date);
  const timeMax = endOfDay(date);
  return {
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
  };
};
