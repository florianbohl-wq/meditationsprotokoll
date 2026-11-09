import type { Session } from '../types';
import { deriveTimeOfDay } from '../lib/time';

let n = 0;
export function makeSession(p: Partial<Session> = {}): Session {
  n++;
  const startTime = 'startTime' in p ? p.startTime : '07:00';
  const durationMinutes = p.durationMinutes ?? 20;
  return {
    id: p.id ?? `id-${n}`,
    date: p.date ?? '2026-11-01',
    startTime,
    timeOfDay: deriveTimeOfDay(startTime),
    durationSeconds: p.durationSeconds ?? durationMinutes * 60,
    durationMinutes,
    anchor: p.anchor ?? 'Atem',
    observation: p.observation ?? 'Ruhig',
    posture: p.posture,
    location: p.location,
    background: p.background,
    createdAt: p.createdAt ?? '2026-11-01T07:30:00.000Z',
    updatedAt: p.updatedAt ?? '2026-11-01T07:30:00.000Z',
    ...(p.sample ? { sample: true } : {}),
  };
}
