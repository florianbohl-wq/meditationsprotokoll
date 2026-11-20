import { db, DEFAULT_OPTIONS } from '../db';
import type { Session } from '../types';
import { uuid } from './id';
import { addOption } from './options';
import { addDays, deriveTimeOfDay, todayISO } from './time';
import { suggestFocus } from './focus';

const OBSERVATIONS = [
  'Anfangs viel Planen, nach etwa zehn Minuten ruhiger. Der Atem wurde feiner.',
  'Müdigkeit, mehrmals kurz weggedämmert. Rücken leicht verspannt.',
  'Unruhe in den Beinen, Impuls aufzustehen. Beobachtet, wie er kam und ging.',
  'Gedanken an die Arbeit, immer wieder zurückgekehrt. Kurze Momente von Weite.',
  'Sehr klar und wach. Geräusche von draußen wirkten nicht störend.',
  'Traurigkeit im Brustraum gespürt, ohne Geschichte dazu. Weich geworden.',
  'Wechsel zwischen Konzentration und Abschweifen, etwa alle paar Atemzüge.',
  'Kribbeln in den Händen, Wärme im Gesicht. Freundliche Grundstimmung.',
];
/** Freitexte wie in der alten Version – zum Testen des Zuordnungs-Assistenten */
const LEGACY_ANCHORS = ['Atem an den Nasenlöchern', 'Youtube-Meditation', 'Geführt von Anna', 'Spirio Bodyscan'];
const LEGACY_LOCATIONS = ['Wohnzimmer', 'Schlafzimmer oben', 'Hotel Lissabon', 'Bei den Eltern'];
const TIMES = ['06:15', '07:00', '07:30', '12:10', '12:45', '15:20', '17:00', '19:30', '21:00', '22:40'];
const SAMPLE_POSTURES = [...DEFAULT_OPTIONS.posture, 'Kniebank'];

/** Einfacher deterministischer Zufallsgenerator, damit Beispieldaten reproduzierbar sind. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function generateSampleSessions(n = 30, today: string = todayISO(), seed = Date.now()): Session[] {
  const r = rng(seed);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const out: Session[] = [];
  const nowIso = new Date().toISOString();
  for (let i = 0; i < n; i++) {
    const date = addDays(today, -Math.floor(r() * 75));
    const startTime = r() < 0.9 ? pick(TIMES) : undefined;
    const durationSeconds = Math.floor((5 + r() * 40) * 60 + r() * 59);
    // etwa jeder fünfte Eintrag stammt „aus alter Zeit“: Freitexte und unbestätigter Fokus-Vorschlag
    const legacy = r() < 0.2;
    const observation = r() < 0.85 ? pick(OBSERVATIONS) : '';
    out.push({
      id: uuid(),
      date,
      startTime,
      timeOfDay: deriveTimeOfDay(startTime),
      durationSeconds,
      durationMinutes: Math.floor(durationSeconds / 60),
      anchor: legacy ? pick(LEGACY_ANCHORS) : pick(DEFAULT_OPTIONS.anchor),
      observation,
      ...(legacy ? { focusSuggestion: suggestFocus(observation) } : { focus: 2 + Math.floor(r() * 8) }),
      posture: r() < 0.9 ? pick(SAMPLE_POSTURES) : undefined,
      location: r() < 0.8 ? (legacy ? pick(LEGACY_LOCATIONS) : pick(DEFAULT_OPTIONS.location)) : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
      sample: true,
    });
  }
  return out;
}

export async function addSampleSessions(n = 30): Promise<number> {
  for (const p of SAMPLE_POSTURES) await addOption('posture', p);
  const list = generateSampleSessions(n);
  await db.sessions.bulkAdd(list);
  return list.length;
}

export async function deleteSampleSessions(): Promise<number> {
  return db.sessions.filter((s) => s.sample === true).delete();
}
