/**
 * Fokus: 1 = sehr abgelenkt … 10 = sehr fokussiert.
 *
 * Für Einträge aus der Zeit vor dem Fokus-Feld schlägt die App anhand der Beobachtung einen Wert vor.
 * Das ist nur eine grobe Stichwort-Auswertung; jeder Vorschlag wird vom Nutzer bestätigt oder geändert.
 */
import type { Session } from '../types';

export const FOCUS_MIN = 1;
export const FOCUS_MAX = 10;
/** Höchster Wert, der für alte Einträge vorgeschlagen wird */
export const SUGGESTION_MAX = 6;
/** Vorschlag, wenn der Text keine Hinweise enthält */
export const SUGGESTION_NEUTRAL = 4;

export const FOCUS_LABELS: Record<number, string> = {
  1: 'sehr abgelenkt',
  10: 'sehr fokussiert',
};

const POSITIVE = [
  'ruhig', 'ruhiger', 'ruhe', 'klar', 'klarheit', 'wach', 'konzentriert', 'konzentration', 'fokussiert', 'fokus',
  'präsent', 'präsenz', 'stabil', 'weite', 'weit', 'still', 'stille', 'tief', 'gesammelt', 'angenehm', 'leicht',
  'entspannt', 'friedlich', 'gelassen', 'zentriert', 'gut', 'schön', 'dabei geblieben', 'bei der sache', 'achtsam',
  'feiner', 'freundlich', 'weich',
];

const NEGATIVE = [
  'unruhig', 'unruhe', 'abgelenkt', 'ablenkung', 'abgeschweift', 'abschweifen', 'abschweifend', 'gedanken',
  'grübeln', 'gegrübelt', 'planen', 'geplant', 'müde', 'müdigkeit', 'eingeschlafen', 'weggedämmert', 'eingenickt',
  'schläfrig', 'dösig', 'schwierig', 'schwer', 'unkonzentriert', 'zerstreut', 'gestört', 'störung', 'laut',
  'schmerz', 'schmerzen', 'verspannt', 'nervös', 'gereizt', 'ungeduld', 'ungeduldig', 'kreisen', 'kreisten',
  'hektisch', 'gestresst', 'stress', 'impuls aufzustehen', 'anstrengend',
];

const NEGATIONS = /^(nicht|kaum|wenig|kein|keine|nie)$/;

/** Zeilen wie „Hintergrund: …“ (aus Version 1.1) betreffen nicht den Fokus. */
function relevantText(observation: string): string {
  return observation
    .split('\n')
    .filter((l) => !/^\s*hintergrund\s*:/i.test(l))
    .join(' ')
    .toLocaleLowerCase('de');
}

function words(text: string): string[] {
  return text.split(/[^a-zäöüß]+/i).filter(Boolean);
}

/** Zählt Treffer; ein „nicht/kaum/…“ direkt davor (bis zu 2 Wörter) kehrt die Bedeutung um. */
function score(text: string): number {
  const w = words(text);
  let s = 0;
  const check = (list: string[], sign: 1 | -1) => {
    for (const term of list) {
      const parts = term.split(' ');
      for (let i = 0; i + parts.length <= w.length; i++) {
        if (parts.every((p, k) => w[i + k] === p)) {
          const negated = [w[i - 1], w[i - 2]].some((x) => x !== undefined && NEGATIONS.test(x));
          s += negated ? -sign : sign;
        }
      }
    }
  };
  check(POSITIVE, 1);
  check(NEGATIVE, -1);
  return s;
}

/** Vorschlag 1 … 6 aus dem Beobachtungstext (ohne Hinweise: 4). */
export function suggestFocus(observation: string | undefined): number {
  const text = relevantText(observation ?? '');
  if (!text.trim()) return SUGGESTION_NEUTRAL;
  const s = score(text);
  return Math.max(FOCUS_MIN, Math.min(SUGGESTION_MAX, SUGGESTION_NEUTRAL + s));
}

export function isValidFocus(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= FOCUS_MIN && n <= FOCUS_MAX;
}

/** Einträge ohne bestätigten Fokus bekommen einen Vorschlag (für Datenbank-Umstellung und alte Backups). */
export function withFocusSuggestion(s: Session): Session {
  if (isValidFocus(s.focus)) {
    const { focusSuggestion: _ignored, ...rest } = s;
    return rest as Session;
  }
  const { focus: _f, ...rest } = s;
  return { ...(rest as Session), focusSuggestion: isValidFocus(s.focusSuggestion) ? s.focusSuggestion : suggestFocus(s.observation) };
}

/** Eintrag braucht noch eine Bestätigung des Fokus */
export const needsFocusConfirmation = (s: Session) => !isValidFocus(s.focus);
