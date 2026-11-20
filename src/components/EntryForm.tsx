import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Option, SessionDraft } from '../types';
import { validateDraft, type DraftErrors } from '../lib/sessions';
import { floorMinutes, formatClock } from '../lib/time';
import { useLocalState } from '../lib/hooks';
import { ChipSelect } from './ChipSelect';
import { FocusPicker } from './FocusPicker';
import { Button, Field, inputClass, Modal, useConfirm } from './ui';

interface Props {
  initial: SessionDraft;
  options: Option[];
  onSave: (d: SessionDraft) => Promise<void>;
  onCancel: (d: SessionDraft) => void;
}

const OBSERVATION_HINT =
  'Beschreiben statt bewerten: Was tat der Geist, was fühlte der Körper, was war leicht oder schwierig?';

export function EntryForm({ initial, options, onSave, onCancel }: Props) {
  const [d, setD] = useState<SessionDraft>(initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [detailsPref, setDetailsPref] = useLocalState('formDetailsOpen', false);
  const hasOptional = !!(initial.posture || initial.location || initial.observation.trim());
  const [showDetails, setShowDetails] = useState(detailsPref || hasOptional);
  const [confirmEl, confirm] = useConfirm();
  const formRef = useRef<HTMLFormElement>(null);

  const isEdit = !!initial.id;
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const set = <K extends keyof SessionDraft>(k: K, v: SessionDraft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    if (errors[k as keyof DraftErrors]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const errs = validateDraft(d);
    setErrors(errs);
    const first = (['date', 'startTime', 'durationMinutes', 'anchor', 'focus'] as const).find((k) => errs[k]);
    if (first) {
      document.getElementById(first === 'anchor' ? 'f-anchor-chips' : `f-${first}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSave(d);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (d.fromTimer) {
      const ok = await confirm({
        title: 'Sitzung verwerfen?',
        message: `Die gemessene Dauer (${formatClock(d.durationSeconds ?? 0)}) geht verloren, wenn du ohne Speichern schließt.`,
        confirmLabel: 'Verwerfen',
        cancelLabel: 'Weiter bearbeiten',
        danger: true,
      });
      if (!ok) return;
    } else if (dirty) {
      const ok = await confirm({
        title: 'Änderungen verwerfen?',
        message: 'Deine Eingaben werden nicht gespeichert.',
        confirmLabel: 'Verwerfen',
        cancelLabel: 'Weiter bearbeiten',
        danger: true,
      });
      if (!ok) return;
    }
    onCancel(d);
  };

  const onTextareaKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const toggleDetails = () => {
    setShowDetails(!showDetails);
    setDetailsPref(!showDetails);
  };

  const measured = d.fromTimer && d.durationSeconds !== undefined;

  return (
    <Modal
      open
      title={isEdit ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
      onClose={() => void cancel()}
      footer={
        <>
          <Button onClick={() => void cancel()}>Abbrechen</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={saving} className="min-w-32">
            Speichern
          </Button>
        </>
      }
    >
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-5">
        {Object.values(errors).some(Boolean) && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300" role="alert">
            Bitte die markierten Pflichtfelder ausfüllen.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Datum" htmlFor="f-date" required error={errors.date}>
            <input
              id="f-date"
              type="date"
              className={inputClass(errors.date)}
              value={d.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </Field>
          <Field label="Startzeit" htmlFor="f-startTime" error={errors.startTime}>
            <input
              id="f-startTime"
              type="time"
              className={inputClass(errors.startTime)}
              value={d.startTime}
              onChange={(e) => set('startTime', e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Dauer (Minuten)"
          htmlFor="f-durationMinutes"
          required
          error={errors.durationMinutes}
          hint={
            measured
              ? Number(d.durationMinutes) === floorMinutes(d.durationSeconds!)
                ? `Gemessen: ${formatClock(d.durationSeconds!)} (mm:ss), abgerundet auf ganze Minuten.`
                : `Gemessen: ${formatClock(d.durationSeconds!)} (mm:ss) – Dauer manuell geändert.`
              : undefined
          }
        >
          <input
            id="f-durationMinutes"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            className={inputClass(errors.durationMinutes)}
            value={d.durationMinutes}
            onChange={(e) => set('durationMinutes', e.target.value)}
          />
        </Field>

        <Field label="Anker" required error={errors.anchor} hint="Bei Wechsel den überwiegenden Anker wählen und den Wechsel in der Beobachtung notieren.">
          <ChipSelect kind="anchor" idPrefix="f-anchor" options={options} value={d.anchor} onChange={(v) => set('anchor', v)} />
        </Field>

        <Field
          label="Fokus"
          required
          error={errors.focus}
          hint={d.focusIsSuggestion ? 'Automatischer Vorschlag aus deiner Beobachtung – bitte prüfen. Beim Speichern gilt er als bestätigt.' : undefined}
        >
          <FocusPicker
            id="f-focus"
            value={d.focus}
            suggestion={d.focusIsSuggestion}
            onChange={(v) => {
              setD((x) => ({ ...x, focus: v, focusIsSuggestion: false }));
              if (errors.focus) setErrors((e) => ({ ...e, focus: undefined }));
            }}
          />
        </Field>

        <div className="border-t border-stone-200 pt-3 dark:border-stone-800">
          <button
            type="button"
            onClick={toggleDetails}
            aria-expanded={showDetails}
            className="flex min-h-11 w-full items-center justify-between text-base font-medium text-moss-800 dark:text-moss-300"
          >
            Mehr Details
            <span aria-hidden="true" className={showDetails ? 'rotate-180 transition-transform' : 'transition-transform'}>
              ▾
            </span>
          </button>

          {showDetails && (
            <div className="mt-3 flex flex-col gap-5">
              <Field label="Haltung">
                <ChipSelect kind="posture" idPrefix="f-posture" options={options} value={d.posture} onChange={(v) => set('posture', v)} />
              </Field>
              <Field label="Ort">
                <ChipSelect kind="location" idPrefix="f-location" options={options} value={d.location} onChange={(v) => set('location', v)} />
              </Field>
              <Field label="Beobachtung" htmlFor="f-observation" hint={OBSERVATION_HINT}>
                <textarea
                  id="f-observation"
                  rows={5}
                  className={inputClass() + ' resize-y leading-relaxed'}
                  value={d.observation}
                  onChange={(e) => set('observation', e.target.value)}
                  onKeyDown={onTextareaKey}
                />
              </Field>
            </div>
          )}
        </div>
        {/* Unsichtbarer Submit-Button, damit Enter in Eingabefeldern speichert */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
      {confirmEl}
    </Modal>
  );
}
