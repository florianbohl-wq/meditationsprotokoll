import type { TimerState } from '../types';

/**
 * Die Stoppuhr rechnet ausschließlich mit Zeitstempeln. Dadurch bleibt die Zeit korrekt,
 * auch wenn der Bildschirm aus ist, der Tab im Hintergrund liegt oder die App neu geladen wird.
 */
export function elapsedMs(t: TimerState | undefined, now: number = Date.now()): number {
  if (!t) return 0;
  const running = t.status === 'running' ? Math.max(0, now - t.segmentStart) : 0;
  return t.accumulatedMs + running;
}

export function startTimer(now: number = Date.now()): TimerState {
  return { status: 'running', sessionStart: now, segmentStart: now, accumulatedMs: 0 };
}

export function pauseTimer(t: TimerState, now: number = Date.now()): TimerState {
  if (t.status !== 'running') return t;
  return { ...t, status: 'paused', accumulatedMs: elapsedMs(t, now) };
}

export function resumeTimer(t: TimerState, now: number = Date.now()): TimerState {
  if (t.status !== 'paused') return t;
  return { ...t, status: 'running', segmentStart: now };
}

export function finishTimer(t: TimerState, now: number = Date.now()): TimerState {
  return { ...t, status: 'finished', accumulatedMs: elapsedMs(t, now), segmentStart: now };
}
