import * as React from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { SidebarContent } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { SYNC_RANGE_FUTURE_DAYS, SYNC_RANGE_PAST_DAYS } from "../config";
import { useGoogleCalendarStore } from "../store/googleCalendarStore";
import { getEventDateKey } from "../utils/dates";
import { CalendarDayWithEventDot } from "./CalendarDayWithEventDot";

const formatEventTime = (start?: string, end?: string, isAllDay?: boolean) => {
  if (isAllDay) return "All day";
  if (!start) return "Unknown time";
  const startDate = parseISO(start);
  if (!end) return format(startDate, "HH:mm");
  const endDate = parseISO(end);
  return `${format(startDate, "HH:mm")}-${format(endDate, "HH:mm")}`;
};

const statusLabelMap = {
  disconnected: "Disconnected",
  connecting: "Connecting",
  connected: "Connected",
  error: "Error",
} as const;

const statusVariantMap: Record<
  keyof typeof statusLabelMap,
  "secondary" | "outline" | "destructive"
> = {
  disconnected: "outline",
  connecting: "outline",
  connected: "secondary",
  error: "destructive",
};

export function GoogleCalendarPanel() {
  const status = useGoogleCalendarStore((state) => state.status);
  const error = useGoogleCalendarStore((state) => state.error);
  const events = useGoogleCalendarStore((state) => state.events);
  const selectedEvents = useGoogleCalendarStore((state) => state.selectedEvents);
  const selectedDate = useGoogleCalendarStore((state) => state.selectedDate);
  const lastSyncAt = useGoogleCalendarStore((state) => state.lastSyncAt);
  const isSyncing = useGoogleCalendarStore((state) => state.isSyncing);
  const isDayLoading = useGoogleCalendarStore((state) => state.isDayLoading);
  const hasTokens = useGoogleCalendarStore(
    (state) => Boolean(state.tokens?.accessToken)
  );
  const connect = useGoogleCalendarStore((state) => state.connect);
  const disconnect = useGoogleCalendarStore((state) => state.disconnect);
  const syncNow = useGoogleCalendarStore((state) => state.syncNow);
  const selectDate = useGoogleCalendarStore((state) => state.selectDate);

  const showConnect = !hasTokens;
  const statusLabel = isSyncing ? "Syncing" : statusLabelMap[status];
  const statusVariant = isSyncing ? "outline" : statusVariantMap[status];

  const eventDates = React.useMemo(() => {
    const set = new Set<string>();
    for (const event of events) {
      const key = getEventDateKey(event);
      if (key) set.add(key);
    }
    return set;
  }, [events]);

  React.useEffect(() => {
    if (!selectedDate) {
      selectDate(new Date());
    }
  }, [selectedDate, selectDate]);

  const selectedDateLabel = selectedDate
    ? format(selectedDate, "MMM d, yyyy")
    : "Select a date";

  return (
    <SidebarContent>
      <div className="space-y-2 px-3 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold">Google Calendar</div>
            <div className="text-xs text-muted-foreground">
              Past {SYNC_RANGE_PAST_DAYS} days / Next {SYNC_RANGE_FUTURE_DAYS} days
            </div>
          </div>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showConnect ? (
            <Button
              size="sm"
              onClick={() => connect()}
              disabled={status === "connecting"}
            >
              Connect
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncNow()}
                disabled={isSyncing}
              >
                <RefreshCw className={cn("size-3", isSyncing && "animate-spin")} />
                Sync
              </Button>
              <Button size="sm" variant="destructive" onClick={() => disconnect()}>
                Disconnect
              </Button>
            </>
          )}
        </div>
        {lastSyncAt && (
          <div className="text-xs text-muted-foreground">
            Last synced: {new Date(lastSyncAt).toLocaleTimeString()}
          </div>
        )}
        {error && <div className="text-xs text-destructive">{error}</div>}
      </div>

      <Calendar
        mode="single"
        selected={selectedDate ?? new Date()}
        onSelect={selectDate}
        disabled={status === "connecting"}
        className="w-full bg-sidebar"
        components={{
          DayButton: (props) => (
            <CalendarDayWithEventDot {...props} eventDates={eventDates} />
          ),
        }}
      />

      <Separator />

      <div className="space-y-3 px-3 pb-4">
        <div className="text-sm font-medium">{selectedDateLabel}</div>

        {showConnect ? (
          <Empty className="border-none p-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarDays className="size-4" />
              </EmptyMedia>
              <EmptyTitle>Connect Google Calendar</EmptyTitle>
              <EmptyDescription>
                Sign in to sync events into the app.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent />
          </Empty>
        ) : isDayLoading ? (
          <div className="text-xs text-muted-foreground">Loading events...</div>
        ) : selectedEvents.length === 0 ? (
          <Empty className="border-none p-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarDays className="size-4" />
              </EmptyMedia>
              <EmptyTitle>No events</EmptyTitle>
              <EmptyDescription>No events for this day.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent />
          </Empty>
        ) : (
          <div className="space-y-2">
            {selectedEvents.map((event) => {
              const start = event.start?.dateTime ?? event.start?.date;
              const end = event.end?.dateTime ?? event.end?.date;
              const isAllDay = Boolean(
                event.start?.date && !event.start?.dateTime
              );
              return (
                <div
                  key={event.id}
                  className="rounded-lg border bg-card px-3 py-2 text-sm shadow-xs"
                >
                  <div className="font-medium">
                    {event.summary?.trim() || "Untitled event"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatEventTime(start, end, isAllDay)}
                  </div>
                  {event.location && (
                    <div className="text-xs text-muted-foreground">
                      Location: {event.location}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SidebarContent>
  );
}
