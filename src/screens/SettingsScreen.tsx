import { useEffect, useRef, useState } from 'react';
import { db, DEFAULT_POSTURES, META, setMeta } from '../db';
import type { Posture, Session } from '../types';
import { activeFilterChips, type Filters } from '../lib/filters';
import { computeKeyFigures } from '../lib/stats';
import { buildWorkbook, excelFileName, XLSX_MIME } from '../lib/excel';
import { applyImport, backupFileName, BackupError, createBackup, parseBackup, previewImport, type BackupFile, type ImportPreview } from '../lib/backup';
import { addSampleSessions, deleteSampleSessions } from '../lib/sample';
import { shareOrDownload } from '../lib/share';
import { devToolsEnabled, isAndroid } from '../lib/hooks';
import { uuid } from '../lib/id';
import { formatTimestampDE } from '../lib/time';
import { PostureManager } from '../components/PostureManager';
import { Button, Card, Modal, SectionTitle, useConfirm } from '../components/ui';

interface Props {
  sessions: Session[];
  filtered: Session[];
  filters: Filters;
  postures: Posture[];
  lastBackup?: string;
  toast: (msg: string) => void;
}

export function SettingsScreen({ sessions, filtered, filters, postures, lastBackup, toast }: Props) {
  const [scope, setScope] = useState<'all' | 'filtered'>('all');
  const [busy, setBusy] = useState(false);
  const [importState, setImportState] = useState<{ backup: BackupFile; preview: ImportPreview } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmEl, confirm] = useConfirm();
  const hasFilter = activeFilterChips(filters).length > 0;
  const sampleCount = sessions.filter((s) => s.sample).length;

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const markBackup = () => setMeta(META.lastBackup, new Date().toISOString());

  const exportExcel = async () => {
    setBusy(true);
    try {
      const list = scope === 'filtered' ? filtered : sessions;
      const k = computeKeyFigures(list, scope === 'filtered' ? filters : { ...filters, range: 'all' });
      const label = scope === 'filtered' ? 'Gefilterte Einträge' : 'Alle Einträge';
      const wb = await buildWorkbook(list, k, label);
      const buf = await wb.xlsx.writeBuffer();
      const res = await shareOrDownload(new Blob([buf], { type: XLSX_MIME }), excelFileName(), XLSX_MIME);
      if (res !== 'cancelled') {
        await markBackup();
        toast(res === 'shared' ? 'Excel-Datei geteilt' : 'Excel-Datei heruntergeladen');
      }
    } catch (e) {
      console.error(e);
      toast('Export fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  const exportJson = async () => {
    setBusy(true);
    try {
      const backup = await createBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const res = await shareOrDownload(blob, backupFileName(), 'application/json');
      if (res !== 'cancelled') {
        await markBackup();
        toast(res === 'shared' ? 'Backup geteilt' : 'Backup heruntergeladen');
      }
    } finally {
      setBusy(false);
    }
  };

  const pickImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      setImportState({ backup, preview: await previewImport(backup) });
    } catch (e) {
      toast(e instanceof BackupError ? e.message : 'Datei konnte nicht gelesen werden.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doImport = async () => {
    if (!importState) return;
    const r = await applyImport(importState.backup);
    setImportState(null);
    toast(`${r.added} ${r.added === 1 ? 'Eintrag' : 'Einträge'} importiert${r.duplicates ? `, ${r.duplicates} übersprungen` : ''}`);
  };

  const deleteAll = async () => {
    const first = await confirm({
      title: 'Alle Daten löschen?',
      message: `Alle ${sessions.length} Einträge und die Haltungsliste werden von diesem Gerät gelöscht.`,
      confirmLabel: 'Weiter',
      danger: true,
    });
    if (!first) return;
    const second = await confirm({
      title: 'Wirklich endgültig löschen?',
      message: 'Das lässt sich nicht rückgängig machen. Hast du vorher ein Backup exportiert?',
      confirmLabel: 'Endgültig löschen',
      danger: true,
    });
    if (!second) return;
    await db.transaction('rw', db.sessions, db.postures, db.meta, async () => {
      await db.sessions.clear();
      await db.postures.clear();
      await db.postures.bulkAdd(DEFAULT_POSTURES.map((name, i) => ({ id: uuid(), name, order: i, archived: false })));
      await db.meta.where('key').anyOf([META.lastBackup, META.timer]).delete();
    });
    toast('Alle Daten gelöscht');
  };

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
      </header>

      <section>
        <SectionTitle>Deine Daten</SectionTitle>
        <Card className="flex flex-col gap-2 text-base leading-relaxed">
          <p>
            Alle Einträge liegen <strong>nur auf diesem Gerät</strong> – kein Server, kein Konto, kein Tracking. Werden die
            Website-Daten im Browser gelöscht oder die App deinstalliert, sind die Einträge weg. Exportiere deshalb
            regelmäßig ein Backup (Excel oder JSON).
          </p>
          <p>
            Laptop und Handy haben jeweils <strong>eigene, getrennte Daten</strong>. Um Einträge zu übertragen, exportiere
            auf dem einen Gerät ein JSON-Backup und importiere es auf dem anderen.
          </p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Dauerhafter Speicher:{' '}
            {persisted === null ? 'unbekannt' : persisted ? 'aktiv (Browser löscht die Daten nicht automatisch)' : 'nicht gewährt'}
            {' · '}
            Letztes Backup: {lastBackup ? formatTimestampDE(lastBackup) : 'noch keins'}
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle>Haltungen verwalten</SectionTitle>
        <PostureManager postures={postures} sessions={sessions} />
      </section>

      <section>
        <SectionTitle>Excel exportieren</SectionTitle>
        <Card className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Umfang</legend>
            <label className="flex min-h-11 items-center gap-3">
              <input type="radio" name="scope" className="h-5 w-5 accent-moss-700" checked={scope === 'all'} onChange={() => setScope('all')} />
              Alle Einträge ({sessions.length})
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name="scope"
                className="h-5 w-5 accent-moss-700"
                checked={scope === 'filtered'}
                onChange={() => setScope('filtered')}
              />
              <span>
                Aktuell gefilterte Einträge ({filtered.length})
                {!hasFilter && <span className="block text-sm text-stone-500 dark:text-stone-400">Im Protokoll ist gerade kein Filter aktiv.</span>}
              </span>
            </label>
          </fieldset>
          <Button variant="primary" onClick={() => void exportExcel()} disabled={busy || sessions.length === 0}>
            {isAndroid() ? 'Excel exportieren & teilen' : 'Excel herunterladen'}
          </Button>
        </Card>
      </section>

      <section>
        <SectionTitle>Backup (JSON)</SectionTitle>
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Vollständige Sicherung aller Einträge und Haltungen. Beim Import werden bereits vorhandene Einträge übersprungen.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void exportJson()} disabled={busy}>
              Backup exportieren
            </Button>
            <Button onClick={() => fileRef.current?.click()}>Backup importieren …</Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => void pickImport(e.target.files?.[0])}
            />
          </div>
        </Card>
      </section>

      {devToolsEnabled && (
        <section>
          <SectionTitle>Entwicklung</SectionTitle>
          <Card className="flex flex-col gap-3 border-2 border-dashed border-amber-300 dark:border-amber-800">
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Nur im lokalen Test sichtbar, nicht in der veröffentlichten App. Beispiel-Einträge sind markiert und werden
              getrennt gelöscht. Aktuell: {sampleCount} Beispiel-Einträge.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  const n = await addSampleSessions(30);
                  toast(`${n} Beispiel-Einträge erzeugt`);
                }}
              >
                30 Beispiel-Einträge erzeugen
              </Button>
              <Button
                disabled={sampleCount === 0}
                onClick={async () => {
                  const n = await deleteSampleSessions();
                  toast(`${n} Beispiel-Einträge gelöscht`);
                }}
              >
                Beispiel-Einträge löschen
              </Button>
            </div>
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>Gefahrenzone</SectionTitle>
        <Button variant="danger" onClick={() => void deleteAll()}>
          Alle Daten löschen
        </Button>
      </section>

      <p className="text-center text-sm text-stone-400 dark:text-stone-500">Meditationsprotokoll · Version {__APP_VERSION__}</p>

      {importState && (
        <Modal
          open
          size="sm"
          title="Backup importieren"
          onClose={() => setImportState(null)}
          footer={
            <>
              <Button onClick={() => setImportState(null)}>Abbrechen</Button>
              <Button variant="primary" onClick={() => void doImport()} disabled={importState.preview.newSessions.length === 0 && importState.preview.newPostureNames.length === 0}>
                Importieren
              </Button>
            </>
          }
        >
          <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-base">
            {importState.backup.exportedAt && (
              <>
                <dt className="text-stone-500">Erstellt am</dt>
                <dd>{formatTimestampDE(importState.backup.exportedAt)}</dd>
              </>
            )}
            <dt className="text-stone-500">Einträge in der Datei</dt>
            <dd className="text-right tabular">{importState.preview.total}</dd>
            <dt className="text-stone-500">Neu</dt>
            <dd className="text-right font-semibold tabular">{importState.preview.newSessions.length}</dd>
            <dt className="text-stone-500">Schon vorhanden (werden übersprungen)</dt>
            <dd className="text-right tabular">{importState.preview.duplicates}</dd>
          </dl>
          {importState.preview.newPostureNames.length > 0 && (
            <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">
              Neue Haltungen: {importState.preview.newPostureNames.join(', ')}
            </p>
          )}
        </Modal>
      )}
      {confirmEl}
    </div>
  );
}
