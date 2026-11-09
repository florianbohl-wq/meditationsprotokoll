import type { Session, SessionDraft } from '../types';
import { deleteSession, draftFromSession } from '../lib/sessions';
import { formatClock, formatDateDE, formatMinutes, formatTimestampDE, weekdayShort } from '../lib/time';
import { Button, Modal, useConfirm } from './ui';

export function EntryDetail({
  session: s,
  onClose,
  onEdit,
  onDeleted,
}: {
  session: Session;
  onClose: () => void;
  onEdit: (d: SessionDraft) => void;
  onDeleted: () => void;
}) {
  const [confirmEl, confirm] = useConfirm();

  const remove = async () => {
    const ok = await confirm({
      title: 'Eintrag löschen?',
      message: `Der Eintrag vom ${formatDateDE(s.date)} wird endgültig gelöscht.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    await deleteSession(s.id);
    onDeleted();
  };

  const rows: [string, string | undefined][] = [
    ['Startzeit', s.startTime ? `${s.startTime} Uhr` : undefined],
    ['Tageszeit', s.timeOfDay],
    ['Dauer', `${formatMinutes(s.durationMinutes)}${s.durationSeconds % 60 ? ` (gemessen ${formatClock(s.durationSeconds)})` : ''}`],
    ['Haltung', s.posture],
    ['Ort', s.location],
    ['Hintergrund', s.background],
  ];

  return (
    <Modal
      open
      title={`${weekdayShort(s.date)}, ${formatDateDE(s.date)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" onClick={() => void remove()} className="mr-auto">
            Löschen
          </Button>
          <Button variant="primary" onClick={() => onEdit(draftFromSession(s))}>
            Bearbeiten
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section>
          <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400">Anker</h3>
          <p className="mt-1 text-base">{s.anchor}</p>
        </section>
        <section>
          <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400">Beobachtung</h3>
          <p className="mt-1 text-base leading-relaxed whitespace-pre-wrap">{s.observation}</p>
        </section>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-stone-200 pt-4 text-base dark:border-stone-800">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-stone-500 dark:text-stone-400">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Erstellt {formatTimestampDE(s.createdAt)}
          {s.updatedAt !== s.createdAt && <> · geändert {formatTimestampDE(s.updatedAt)}</>}
          {s.sample && <> · Beispiel-Eintrag</>}
        </p>
      </div>
      {confirmEl}
    </Modal>
  );
}
