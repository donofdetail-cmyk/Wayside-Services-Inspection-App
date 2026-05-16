import { useEffect, useRef, useState, useCallback } from 'react';

export function useTimer(seedSeconds = 0) {
  const [seconds, setSeconds] = useState(seedSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(true);

  const start = useCallback(() => {
    if (intervalRef.current) return;
    runningRef.current = true;
    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  }, []);

  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    runningRef.current = false;
  }, []);

  const resume = useCallback(() => {
    if (!runningRef.current) start();
  }, [start]);

  // Auto-start on mount
  useEffect(() => {
    start();
    return () => pause();
  }, [start, pause]);

  // Pause when tab is hidden, resume when visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        pause();
      } else {
        resume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pause, resume]);

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const formatted = [
    hours > 0 ? String(hours).padStart(2, '0') : null,
    String(mins).padStart(2, '0'),
    String(secs).padStart(2, '0'),
  ]
    .filter(Boolean)
    .join(':');

  return { seconds, formatted, pause, resume };
}
