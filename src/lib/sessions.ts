import { db } from '../db';
import type { Session, SessionDraft } from '../types';
import { uuid } from './id';
import { deriveTimeOfDay, floorMinutes, todayISO } from './time';
import { FOCUS_MAX, FOCUS_MIN, isValidFocus } from './focus';

export type DraftErrors = Partial<Record<'date' | 'startTime' | 'durationMinutes' | 'anchor' | 'focus', string>>;

export function emptyDraft(now: Date = new Date()): SessionDraft {
  return {
    date: todayISO(now),
    startTime: '',
    durationMinutes: '',
    anchor: '',
    focus: '',
    observation: '',
    posture: '',
    location: '',
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
    ...(isValidFocus(s.focus)
      ? { focus: String(s.focus) }
      : { focus: s.focusSuggestion ? String(s.focusSuggestion) : '', focusIsSuggestion: !!s.focusSuggestion }),
    observation: s.observation,
    posture: s.posture ?? '',
    location: s.location ?? '',
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
  if (!d.anchor.trim()) e.anchor = 'Bitte den verwendeten Anker auswählen.';
  const f = Number(d.focus);
  if (!d.focus.trim()) e.focus = 'Bitte den Fokus von 1 bis 10 wählen.';
  else if (!Number.isInteger(f) || f < FOCUS_MIN || f > FOCUS_MAX) e.focus = 'Der Fokus muss zwischen 1 und 10 liegen.';
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
    // gespeicherter Fokus gilt als bestätigt; ein evtl. vorhandener Vorschlag entfällt
    focus: Number(d.focus),
    observation: d.observation.trim(),
    posture: opt(d.posture),
    location: opt(d.location),
    // ursprüngliche Freitexte aus der Zeit vor den Auswahllisten bleiben immer erhalten
    ...(existing?.anchorOriginal ? { anchorOriginal: existing.anchorOriginal } : {}),
    ...(existing?.locationOriginal ? { locationOriginal: existing.locationOriginal } : {}),
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

/** Fokus-Vorschläge bestätigen bzw. mit geändertem Wert übernehmen (in einer Transaktion). */
export async function confirmFocus(entries: { id: string; focus: number }[]): Promise<number> {
  if (entries.some((e) => !isValidFocus(e.focus))) throw new Error('Fokus muss zwischen 1 und 10 liegen.');
  const now = new Date().toISOString();
  return db.transaction('rw', db.sessions, async () => {
    let n = 0;
    for (const e of entries) {
      n += await db.sessions
        .where('id')
        .equals(e.id)
        .modify((s: Session) => {
          s.focus = e.focus;
          delete s.focusSuggestion;
          s.updatedAt = now;
        });
    }
    return n;
  });
}
