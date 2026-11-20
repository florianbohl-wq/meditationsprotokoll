import { db } from '../db';
import { OPTION_KINDS, type Option, type OptionKind, type Session } from '../types';
import { uuid } from './id';
import { migrateLegacySession } from './legacy';
import { withFocusSuggestion } from './focus';
import { FIELD } from './options';

export interface BackupFile {
  app: 'meditationsprotokoll';
  /** 1 = Version 1.0 (Haltungen, Hintergrund), 2 = 1.1 (Auswahllisten), 3 = 1.2 (Fokus) */
  format: 1 | 2 | 3;
  exportedAt: string;
  sessions: Session[];
  options: Option[];
}

export class BackupError extends Error {}

export async function createBackup(now: Date = new Date()): Promise<BackupFile> {
  const [sessions, options] = await Promise.all([db.sessions.toArray(), db.options.toArray()]);
  options.sort((a, b) => a.kind.localeCompare(b.kind) || a.order - b.order);
  return { app: 'meditationsprotokoll', format: 3, exportedAt: now.toISOString(), sessions, options };
}

export function backupFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `meditationsprotokoll_backup_${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

const isStr = (v: unknown): v is string => typeof v === 'string';

function validSession(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    isStr(s.id) &&
    isStr(s.date) &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.date) &&
    typeof s.durationMinutes === 'number' &&
    typeof s.durationSeconds === 'number' &&
    isStr(s.anchor) &&
    (s.observation === undefined || isStr(s.observation))
  );
}

function toOption(v: unknown, fallbackKind?: OptionKind): Option | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const p = v as Record<string, unknown>;
  const kind = (OPTION_KINDS as readonly string[]).includes(p.kind as string) ? (p.kind as OptionKind) : fallbackKind;
  if (!kind || !isStr(p.id) || !isStr(p.name) || !p.name.trim()) return undefined;
  return { id: p.id, kind, name: p.name, order: typeof p.order === 'number' ? p.order : 0, archived: !!p.archived };
}

/** Liest neue und alte Backups (format 1 mit „postures“ und „background“). */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('Die Datei ist kein gültiges JSON.');
  }
  const d = data as Record<string, unknown> | null;
  if (!d || d.app !== 'meditationsprotokoll' || !Array.isArray(d.sessions)) {
    throw new BackupError('Das ist keine Backup-Datei des Meditationsprotokolls.');
  }
  const invalid = d.sessions.filter((s) => !validSession(s)).length;
  if (invalid) throw new BackupError(`${invalid} Eintrag/Einträge in der Datei sind unvollständig.`);

  const options: Option[] = [];
  if (Array.isArray(d.options)) for (const o of d.options) { const x = toOption(o); if (x) options.push(x); }
  if (Array.isArray(d.postures)) for (const o of d.postures) { const x = toOption(o, 'posture'); if (x) options.push(x); }

  return {
    app: 'meditationsprotokoll',
    format: d.format === 3 ? 3 : d.format === 2 ? 2 : 1,
    exportedAt: isStr(d.exportedAt) ? d.exportedAt : '',
    // alte Backups: Hintergrund umstellen, Fokus-Vorschlag für Einträge ohne Fokus
    sessions: (d.sessions as Record<string, unknown>[]).map((x) => withFocusSuggestion(migrateLegacySession(x))),
    options,
  };
}

export interface ImportPreview {
  total: number;
  newSessions: Session[];
  duplicates: number;
  newOptionNames: string[];
}

const norm = (s: string) => s.trim().toLocaleLowerCase('de');

/**
 * Optionen, die nach dem Import fehlen würden. Aus der Optionsliste des Backups werden alle
 * übernommen; aus den Einträgen selbst nur Haltungen (alte Anker/Orte-Freitexte werden nicht
 * automatisch zu Optionen, sondern landen im Zuordnungs-Assistenten).
 */
function missingOptions(backup: BackupFile, existing: Option[], sessionsToAdd: Session[]): { kind: OptionKind; name: string; src?: Option }[] {
  const known = new Set(existing.map((p) => `${p.kind}|${norm(p.name)}`));
  const out: { kind: OptionKind; name: string; src?: Option }[] = [];
  const push = (kind: OptionKind, name: string, src?: Option) => {
    const key = `${kind}|${norm(name)}`;
    if (!name.trim() || known.has(key)) return;
    known.add(key);
    out.push({ kind, name: name.trim(), src });
  };
  for (const kind of OPTION_KINDS) {
    for (const p of backup.options.filter((o) => o.kind === kind).sort((a, b) => a.order - b.order)) push(kind, p.name, p);
  }
  for (const s of sessionsToAdd) if (s[FIELD.posture]) push('posture', s.posture!);
  return out;
}

const label = (o: { kind: OptionKind; name: string }) =>
  `${o.name} (${o.kind === 'posture' ? 'Haltung' : o.kind === 'anchor' ? 'Anker' : 'Ort'})`;

export async function previewImport(backup: BackupFile): Promise<ImportPreview> {
  const ids = new Set(await db.sessions.toCollection().primaryKeys());
  const seen = new Set<string>();
  const newSessions: Session[] = [];
  let duplicates = 0;
  for (const s of backup.sessions) {
    if (ids.has(s.id) || seen.has(s.id)) duplicates++;
    else {
      seen.add(s.id);
      newSessions.push(s);
    }
  }
  const existing = await db.options.toArray();
  return {
    total: backup.sessions.length,
    newSessions,
    duplicates,
    newOptionNames: missingOptions(backup, existing, newSessions).map(label),
  };
}

/** Übernimmt neue Einträge (Duplikate nach id werden übersprungen) und fehlende Optionen. */
export async function applyImport(backup: BackupFile): Promise<{ added: number; duplicates: number; optionsAdded: number }> {
  return db.transaction('rw', db.sessions, db.options, async () => {
    const preview = await previewImport(backup);
    const existing = await db.options.toArray();
    const missing = missingOptions(backup, existing, preview.newSessions);
    const existingIds = new Set(existing.map((p) => p.id));
    const nextOrder: Record<OptionKind, number> = { posture: -1, anchor: -1, location: -1 };
    for (const o of existing) nextOrder[o.kind] = Math.max(nextOrder[o.kind], o.order);
    await db.options.bulkAdd(
      missing.map(({ kind, name, src }) => ({
        id: src && !existingIds.has(src.id) ? src.id : uuid(),
        kind,
        name,
        order: ++nextOrder[kind],
        archived: src ? src.archived : false,
      })),
    );
    await db.sessions.bulkAdd(preview.newSessions);
    return { added: preview.newSessions.length, duplicates: preview.duplicates, optionsAdded: missing.length };
  });
}
