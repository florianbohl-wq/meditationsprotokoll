export const TIMES_OF_DAY = ['Morgen', 'Mittag', 'Nachmittag', 'Abend', 'Nacht'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

/** Auswahllisten mit fester, erweiterbarer Liste */
export const OPTION_KINDS = ['posture', 'anchor', 'location'] as const;
export type OptionKind = (typeof OPTION_KINDS)[number];

export const OPTION_LABELS: Record<OptionKind, { singular: string; plural: string; example: string }> = {
  posture: { singular: 'Haltung', plural: 'Haltungen', example: 'z. B. Kniebank' },
  anchor: { singular: 'Anker', plural: 'Anker', example: 'z. B. Musik' },
  location: { singular: 'Ort', plural: 'Orte', example: 'z. B. Park' },
};

export interface Session {
  id: string;
  /** Kalenderdatum YYYY-MM-DD */
  date: string;
  /** HH:MM, optional */
  startTime?: string;
  /** aus startTime abgeleitet */
  timeOfDay?: TimeOfDay;
  durationSeconds: number;
  /** immer abgerundet (floor) */
  durationMinutes: number;
  /** Name einer Anker-Option (bei alten Einträgen evtl. noch freier Text) */
  anchor: string;
  observation: string;
  posture?: string;
  /** Name einer Ort-Option (bei alten Einträgen evtl. noch freier Text) */
  location?: string;
  /** ursprünglicher Freitext, falls ein alter Anker einer Option zugeordnet wurde */
  anchorOriginal?: string;
  /** ursprünglicher Freitext, falls ein alter Ort einer Option zugeordnet wurde */
  locationOriginal?: string;
  createdAt: string;
  updatedAt: string;
  /** nur für Beispiel-Einträge aus dem Entwicklungsbereich */
  sample?: boolean;
}

export interface Option {
  id: string;
  kind: OptionKind;
  name: string;
  order: number;
  archived: boolean;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export interface TimerState {
  status: 'running' | 'paused' | 'finished';
  /** Epoch-ms des allerersten Starts (für Datum und Startzeit) */
  sessionStart: number;
  /** Epoch-ms, seit dem das aktuelle laufende Segment läuft */
  segmentStart: number;
  /** bereits abgeschlossene Laufzeit in ms */
  accumulatedMs: number;
}

/** Werte, die das Formular verwendet (alles als Strings für die Eingabefelder) */
export interface SessionDraft {
  id?: string;
  date: string;
  startTime: string;
  durationMinutes: string;
  durationSeconds?: number;
  anchor: string;
  observation: string;
  posture: string;
  location: string;
  fromTimer?: boolean;
}
