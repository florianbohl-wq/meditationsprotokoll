import { db } from '../db';
import type { Posture, Session } from '../types';
import { uuid } from './id';

export interface BackupFile {
  app: 'meditationsprotokoll';
  format: 1;
  exportedAt: string;
  sessions: Session[];
  postures: Posture[];
}

export class BackupError extends Error {}

export async function createBackup(now: Date = new Date()): Promise<BackupFile> {
  const [sessions, postures] = await Promise.all([db.sessions.toArray(), db.postures.orderBy('order').toArray()]);
  return { app: 'meditationsprotokoll', format: 1, exportedAt: now.toISOString(), sessions, postures };
}

export function backupFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `meditationsprotokoll_backup_${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

const isStr = (v: unknown): v is string => typeof v === 'string';

function validSession(v: unknown): v is Session {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    isStr(s.id) &&
    isStr(s.date) &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.date) &&
    typeof s.durationMinutes === 'number' &&
    typeof s.durationSeconds === 'number' &&
    isStr(s.anchor) &&
    isStr(s.observation)
  );
}

function validPosture(v: unknown): v is Posture {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return isStr(p.id) && isStr(p.name) && p.name.trim() !== '';
}

export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('Die Datei ist kein gültiges JSON.');
  }
  const d = data as Partial<BackupFile> | null;
  if (!d || d.app !== 'meditationsprotokoll' || !Array.isArray(d.sessions)) {
    throw new BackupError('Das ist keine Backup-Datei des Meditationsprotokolls.');
  }
  const invalid = d.sessions.filter((s) => !validSession(s)).length;
  if (invalid) throw new BackupError(`${invalid} Eintrag/Einträge in der Datei sind unvollständig.`);
  const postures = Array.isArray(d.postures) ? d.postures.filter(validPosture) : [];
  return {
    app: 'meditationsprotokoll',
    format: 1,
    exportedAt: isStr(d.exportedAt) ? d.exportedAt : '',
    sessions: d.sessions as Session[],
    postures,
  };
}

export interface ImportPreview {
  total: number;
  newSessions: Session[];
  duplicates: number;
  newPostureNames: string[];
}

const norm = (s: string) => s.trim().toLocaleLowerCase('de');

/** Postures, die nach dem Import fehlen würden (aus Haltungsliste und aus Einträgen). */
function missingPostures(backup: BackupFile, existing: Posture[], sessionsToAdd: Session[]): { name: string; src?: Posture }[] {
  const known = new Set(existing.map((p) => norm(p.name)));
  const out: { name: string; src?: Posture }[] = [];
  const push = (name: string, src?: Posture) => {
    if (!name.trim() || known.has(norm(name))) return;
    known.add(norm(name));
    out.push({ name: name.trim(), src });
  };
  for (const p of [...backup.postures].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) push(p.name, p);
  for (const s of sessionsToAdd) if (s.posture) push(s.posture);
  return out;
}

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
  const existing = await db.postures.toArray();
  return {
    total: backup.sessions.length,
    newSessions,
    duplicates,
    newPostureNames: missingPostures(backup, existing, newSessions).map((p) => p.name),
  };
}

/** Übernimmt neue Einträge (Duplikate nach id werden übersprungen) und fehlende Haltungen. */
export async function applyImport(backup: BackupFile): Promise<{ added: number; duplicates: number; posturesAdded: number }> {
  return db.transaction('rw', db.sessions, db.postures, async () => {
    const preview = await previewImport(backup);
    const existing = await db.postures.toArray();
    const missing = missingPostures(backup, existing, preview.newSessions);
    const existingIds = new Set(existing.map((p) => p.id));
    let order = existing.reduce((m, p) => Math.max(m, p.order), -1);
    await db.postures.bulkAdd(
      missing.map(({ name, src }) => ({
        id: src && !existingIds.has(src.id) ? src.id : uuid(),
        name,
        order: ++order,
        archived: src ? !!src.archived : false,
      })),
    );
    await db.sessions.bulkAdd(preview.newSessions);
    return { added: preview.newSessions.length, duplicates: preview.duplicates, posturesAdded: missing.length };
  });
}
