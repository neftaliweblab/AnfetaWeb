export function calendarHourGridBackground(pixelsPerHour: number) {
  const hour = Math.max(1, pixelsPerHour);
  return [
    `repeating-linear-gradient(to bottom, #496278 0px, #496278 2px, transparent 2px, transparent ${hour}px)`,
    `repeating-linear-gradient(to bottom, #293e52 0px, #293e52 1px, transparent 1px, transparent ${hour / 2}px)`,
    `repeating-linear-gradient(to bottom, #182637 0px, #182637 1px, transparent 1px, transparent ${hour / 4}px)`,
    `repeating-linear-gradient(to bottom, rgba(56,189,248,0.055) 0px, rgba(56,189,248,0.055) ${hour}px, transparent ${hour}px, transparent ${hour * 2}px)`
  ].join(',');
}

export function CalendarHourGrid({ pixelsPerHour, className }: { pixelsPerHour: number; className?: string }) {
  return (
    <div
      aria-hidden={true}
      className={`absolute inset-0 pointer-events-none ${className || ''}`}
      style={{ backgroundImage: calendarHourGridBackground(pixelsPerHour) }}
    />
  );
}
