import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-moss-800 text-white hover:bg-moss-700 dark:bg-moss-600 dark:hover:bg-moss-500',
  secondary:
    'bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-100 dark:bg-stone-900 dark:text-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800',
  ghost: 'text-moss-800 hover:bg-moss-50 dark:text-moss-300 dark:hover:bg-stone-800',
  danger: 'bg-red-700 text-white hover:bg-red-600 dark:bg-red-800 dark:hover:bg-red-700',
};

export function Button({
  variant = 'secondary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-base font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function Chip({
  selected,
  onClick,
  children,
  title,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={title}
      className={cx(
        'min-h-11 rounded-full px-4 py-2 text-base transition-colors',
        selected
          ? 'bg-moss-800 text-white dark:bg-moss-600'
          : 'bg-stone-100 text-stone-700 ring-1 ring-stone-200 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-700 dark:hover:bg-stone-700',
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
        {required && <span className="text-moss-700 dark:text-moss-400"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="text-sm text-stone-500 dark:text-stone-400">{hint}</p>}
      {error && (
        <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass = (error?: string) =>
  cx(
    'w-full rounded-xl bg-white px-3 py-2.5 text-base text-stone-900 ring-1 placeholder:text-stone-400 focus:outline-none focus:ring-2 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500',
    error
      ? 'ring-red-500 focus:ring-red-500'
      : 'ring-stone-300 focus:ring-moss-500 dark:ring-stone-700 dark:focus:ring-moss-500',
  );

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-2xl bg-white p-4 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800', className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-lg font-semibold text-stone-900 dark:text-stone-100">{children}</h2>;
}

/* ---------- Modal mit Esc-Unterstützung (nur das oberste Modal reagiert) ---------- */

const modalStack: string[] = [];

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    modalStack.push(id);
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === id) {
        e.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // Fokus in den Dialog setzen, sofern kein Element dort selbst Autofokus hat
    requestAnimationFrame(() => {
      if (panelRef.current && !panelRef.current.contains(document.activeElement)) panelRef.current.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = modalStack.indexOf(id);
      if (i >= 0) modalStack.splice(i, 1);
      if (modalStack.length === 0) document.body.style.overflow = '';
      prevFocus?.focus?.();
    };
  }, [open, id]);

  if (!open) return null;
  const width = size === 'sm' ? 'md:max-w-md' : size === 'lg' ? 'md:max-w-3xl' : 'md:max-w-xl';
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center md:p-6" role="presentation">
      <div className="absolute inset-0 bg-black/50" onClick={() => closeRef.current()} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-stone-50 shadow-xl focus:outline-none md:rounded-3xl dark:bg-stone-950 dark:ring-1 dark:ring-stone-800',
          width,
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-5 py-3 dark:border-stone-800">
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => closeRef.current()}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-2xl text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="safe-bottom flex flex-wrap justify-end gap-2 border-t border-stone-200 px-5 py-3 dark:border-stone-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Bestätigungsdialog als Promise ---------- */

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function useConfirm(): [ReactNode, (o: ConfirmOptions) => Promise<boolean>] {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const ask = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })),
    [],
  );
  const done = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };

  const el = state ? (
    <Modal
      open
      size="sm"
      title={state.title}
      onClose={() => done(false)}
      footer={
        <>
          <Button onClick={() => done(false)}>{state.cancelLabel ?? 'Abbrechen'}</Button>
          <Button autoFocus variant={state.danger ? 'danger' : 'primary'} onClick={() => done(true)}>
            {state.confirmLabel ?? 'OK'}
          </Button>
        </>
      }
    >
      <div className="text-base text-stone-700 dark:text-stone-300">{state.message}</div>
    </Modal>
  ) : null;

  return [el, ask];
}

/* ---------- Kurze Rückmeldung ---------- */

export function useToast(): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 3500);
  }, []);
  const el = msg ? (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-xl bg-stone-900 px-4 py-3 text-center text-white shadow-lg dark:bg-stone-100 dark:text-stone-900"
    >
      {msg}
    </div>
  ) : null;
  return [el, show];
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 px-6 py-10 text-center dark:border-stone-700">
      <svg viewBox="0 0 64 64" className="h-12 w-12 text-moss-400" aria-hidden="true">
        <path d="M44.5 17.5A19 19 0 1 0 51 32" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <p className="text-lg font-medium">{title}</p>
      {children}
    </div>
  );
}
