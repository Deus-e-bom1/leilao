import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const format = (total: number) => {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
};

export function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const id = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [seconds]);
  return left;
}

export function Countdown({
  seconds,
  className = "",
}: {
  seconds: number;
  className?: string;
}) {
  const left = useCountdown(seconds);
  return (
    <span
      className={`inline-flex w-full max-w-full items-center gap-1 overflow-hidden whitespace-nowrap rounded-md bg-warning-muted px-1.5 py-1.5 text-[10px] font-semibold text-warning-foreground sm:gap-2 sm:px-3 sm:text-sm ${className}`}
    >
      <Clock className="size-3 shrink-0 sm:size-4" />
      <span className="font-medium">Encerra em</span>
      <span className="font-mono tabular-nums">{format(left)}</span>
    </span>
  );
}
