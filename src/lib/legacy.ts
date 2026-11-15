/**
 * Umstellung alter Einträge (Datenbank-Version 1 bzw. alte Backups) auf die neue Logik.
 * Grundsatz: Es geht kein Text verloren.
 */
import type { Session } from '../types';

/** Altes Feld „Hintergrund“ wird als letzte Zeile an die Beobachtung angehängt. */
export function migrateLegacySession(raw: Record<string, unknown>): Session {
  const s = { ...raw } as Record<string, unknown>;
  const bg = typeof s.background === 'string' ? s.background.trim() : '';
  delete s.background;
  if (bg) {
    const obs = typeof s.observation === 'string' ? s.observation.trimEnd() : '';
    s.observation = obs ? `${obs}\n\nHintergrund: ${bg}` : `Hintergrund: ${bg}`;
  }
  return s as unknown as Session;
}

const norm = (s: string) => s.trim().toLocaleLowerCase('de');

/** Gleicher Text wie eine Option (Groß/Klein egal) → Schreibweise der Option übernehmen. */
export function matchOptionName(value: string | undefined, names: string[]): string | undefined {
  if (!value) return undefined;
  const n = norm(value);
  return names.find((x) => norm(x) === n);
}

const RULES: Record<'anchor' | 'location', [RegExp, string][]> = {
  anchor: [
    [/podcast|youtube|you tube|video|stream/i, 'Podcast/Youtube'],
    [/spirio|\bapp\b|handy|smartphone|insight|headspace|calm|7mind/i, 'Spirio/App'],
    [/person|lehrer|lehrerin|anleitung durch|gruppe|sangha|kurs/i, 'Person'],
    [/atem|atmung|keiner|keine|ohne|stille|nasenl|bauch|k[öo]rper|scan|ger[äa]usch|f[üu][ßs]e|h[äa]nde/i, 'Keiner/Atem'],
  ],
  location: [
    [/oben|dachgeschoss|schlafzimmer/i, 'Zu Hause oben'],
    [/unten|erdgeschoss|wohnzimmer|keller/i, 'Zu Hause unten'],
    [/event|retreat|seminar|kurs|workshop|zentrum|kloster|tempel/i, 'Event'],
    [/familie|eltern|mutter|vater|mama|papa|oma|opa|freund|bekannt|schwester|bruder|tante|onkel|schwieger/i, 'Bekannte/Familie'],
    [/reise|urlaub|hotel|zug|bahn|flug|ferien|unterwegs|camping/i, 'Reise'],
  ],
};

/**
 * Vorschlag für die Zuordnung eines alten Freitexts zu einer Option.
 * Nur ein Vorschlag – der Nutzer bestätigt ihn im Zuordnungs-Assistenten.
 */
export function suggestOption(kind: 'anchor' | 'location', value: string, names: string[]): string | undefined {
  for (const [re, target] of RULES[kind]) {
    if (re.test(value)) {
      const m = matchOptionName(target, names);
      if (m) return m;
    }
  }
  return undefined;
}
