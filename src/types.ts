export const TIMES_OF_DAY = ['Morgen', 'Mittag', 'Nachmittag', 'Abend', 'Nacht'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

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
  anchor: string;
  observation: string;
  posture?: string;
  location?: string;
  background?: string;
  createdAt: string;
  updatedAt: string;
  /** nur für Beispiel-Einträge aus dem Entwicklungsbereich */
  sample?: boolean;
}

export interface Posture {
  id: string;
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
  background: string;
  fromTimer?: boolean;
}
