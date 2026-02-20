import * as React from "react";
import { type DayButton, getDefaultClassNames } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { getDateKey } from "../utils/dates";

interface CalendarDayWithEventDotProps
  extends React.ComponentProps<typeof DayButton> {
  eventDates: Set<string>;
}

export function CalendarDayWithEventDot({
  className,
  day,
  modifiers,
  eventDates,
  ...props
}: CalendarDayWithEventDotProps) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const hasEvent = eventDates.has(getDateKey(day.date));

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={getDateKey(day.date)}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 dark:hover:text-accent-foreground flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md [&>span]:text-xs [&>span]:opacity-70",
        "relative",
        defaultClassNames.day,
        className
      )}
      {...props}
    >
      {props.children}
      {hasEvent && (
        <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary data-[selected-single=true]:bg-primary-foreground" />
      )}
    </Button>
  );
}
