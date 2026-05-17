interface TimerBadgeProps {
  formatted: string;
}

export function TimerBadge({ formatted }: TimerBadgeProps) {
  return (
    <div className="flex flex-col items-center bg-deep-forest/40 border border-white/10 px-4 py-1 rounded-xl">
      <span className="text-[10px] uppercase font-bold text-white/60 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-pathway-green animate-pulse inline-block" />
        Time
      </span>
      <span className="text-base font-bold leading-none text-white tabular-nums tracking-wide">
        {formatted}
      </span>
    </div>
  );
}
