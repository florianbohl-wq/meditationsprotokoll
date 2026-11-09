import { db } from '../db';
import type { Session, SessionDraft } from '../types';
import { uuid } from './id';
import { deriveTimeOfDay, floorMinutes, todayISO } from './time';

export type DraftErrors = Partial<Record<'date' | 'startTime' | 'durationMinutes' | 'anchor' | 'observation', string>>;

export function emptyDraft(now: Date = new Date()): SessionDraft {
  return {
    date: todayISO(now),
    startTime: '',
    durationMinutes: '',
    anchor: '',
    observation: '',
    posture: '',
    location: '',
    background: '',
  };
}

export function draftFromSession(s: Session): SessionDraft {
  return {
    id: s.id,
    date: s.date,
    startTime: s.startTime ?? '',
    durationMinutes: String(s.durationMinutes),
    durationSeconds: s.durationSeconds,
    anchor: s.anchor,
    observation: s.observation,
    posture: s.posture ?? '',
    location: s.location ?? '',
    background: s.background ?? '',
  };
}

export function validateDraft(d: SessionDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) e.date = 'Bitte ein Datum angeben.';
  if (d.startTime && !/^\d{1,2}:\d{2}$/.test(d.startTime)) e.startTime = 'Uhrzeit im Format HH:MM.';
  const min = d.durationMinutes.trim();
  if (!min) e.durationMinutes = 'Bitte die Dauer in Minuten angeben.';
  else if (!/^\d+$/.test(min)) e.durationMinutes = 'Nur ganze Minuten eingeben.';
  else if (Number(min) < 1) e.durationMinutes = 'Die Dauer muss mindestens 1 Minute betragen.';
  if (!d.anchor.trim()) e.anchor = 'Bitte den verwendeten Anker notieren.';
  if (!d.observation.trim()) e.observation = 'Bitte mindestens eine Beobachtung notieren.';
  return e;
}

/**
 * Exakte Sekunden behalten, solange die Minuten zur gemessenen Dauer passen.
 * Wurden die Minuten manuell geändert, gilt die neue Minutenzahl.
 */
export function resolveDuration(minutesInput: string, measuredSeconds?: number): { durationMinutes: number; durationSeconds: number } {
  const minutes = Math.max(0, Math.floor(Number(minutesInput)));
  if (measuredSeconds !== undefined && floorMinutes(measuredSeconds) === minutes) {
    return { durationMinutes: minutes, durationSeconds: measuredSeconds };
  }
  return { durationMinutes: minutes, durationSeconds: minutes * 60 };
}

const opt = (s: string) => {
  const t = s.trim();
  return t ? t : undefined;
};

export function sessionFromDraft(d: SessionDraft, existing?: Session, now: Date = new Date()): Session {
  const ts = now.toISOString();
  const startTime = opt(d.startTime);
  return {
    id: existing?.id ?? d.id ?? uuid(),
    date: d.date,
    startTime,
    timeOfDay: deriveTimeOfDay(startTime),
    ...resolveDuration(d.durationMinutes, d.durationSeconds),
    anchor: d.anchor.trim(),
    observation: d.observation.trim(),
    posture: opt(d.posture),
    location: opt(d.location),
    background: opt(d.background),
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
    ...(existing?.sample ? { sample: true } : {}),
  };
}

export async function saveDraft(d: SessionDraft): Promise<Session> {
  const existing = d.id ? await db.sessions.get(d.id) : undefined;
  const s = sessionFromDraft(d, existing);
  await db.sessions.put(s);
  return s;
}

export async function deleteSession(id: string): Promise<void> {
  await db.sessions.delete(id);
}

/** Neueste zuerst: nach Datum, dann Startzeit, dann Erstellzeit. */
export function sortNewestFirst(list: Session[]): Session[] {
  return [...list].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.startTime ?? '').localeCompare(a.startTime ?? '') ||
      b.createdAt.localeCompare(a.createdAt),
  );
}
