import { useEffect, useRef } from "react";

import {
  GOOGLE_CALENDAR_POLL_INTERVAL,
  useGoogleCalendarStore,
} from "../store/googleCalendarStore";

export function GoogleCalendarSync() {
  const loadFromStore = useGoogleCalendarStore((state) => state.loadFromStore);
  const status = useGoogleCalendarStore((state) => state.status);
  const syncNow = useGoogleCalendarStore((state) => state.syncNow);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    loadFromStore();
  }, [loadFromStore]);

  useEffect(() => {
    if (status !== "connected") return;
    syncNow();
    const id = window.setInterval(() => {
      syncNow();
    }, GOOGLE_CALENDAR_POLL_INTERVAL);
    return () => window.clearInterval(id);
  }, [status, syncNow]);

  return null;
}
