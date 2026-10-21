export function gridDivisions(interval:number){const step=[15,20,30].includes(interval)?interval:30;return Array.from({length:60/step-1},(_,i)=>(i+1)*step);}
export function calendarHourGridBackground(pixelsPerHour: number, interval=30) {
  const hour = Math.max(1, pixelsPerHour);
  return [
    `repeating-linear-gradient(to bottom, var(--anfeta-hour-line,#496278) 0px, var(--anfeta-hour-line,#496278) 1px, transparent 1px, transparent ${hour}px)`,
    `repeating-linear-gradient(to bottom, var(--anfeta-half-line,#293e52) 0px, var(--anfeta-half-line,#293e52) 1px, transparent 1px, transparent var(--anfeta-grid-step, ${hour * ([15,20,30].includes(interval)?interval:30) / 60}px))`,
    `repeating-linear-gradient(to bottom, rgba(56,189,248,0.055) 0px, rgba(56,189,248,0.055) ${hour}px, transparent ${hour}px, transparent ${hour * 2}px)`
  ].join(',');
}

export function CalendarHourGrid({ pixelsPerHour, interval = 30, className }: { pixelsPerHour: number; interval?: number; className?: string }) {
  return (
    <div
      aria-hidden={true}
      className={`absolute inset-0 pointer-events-none ${className || ''}`}
      style={{ backgroundImage: calendarHourGridBackground(pixelsPerHour, interval) }}
    />
  );
}
