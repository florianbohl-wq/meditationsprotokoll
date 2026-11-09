import { useEffect, useRef } from 'react';
import type { Session, TimerState } from '../types';
import { elapsedMs } from '../lib/timer';
import { useLocalState, useNow } from '../lib/hooks';
import { todayAndWeek } from '../lib/stats';
import { formatClock, formatMinutes, toHHMM } from '../lib/time';
import { Card } from '../components/ui';

interface Props {
  sessions: Session[];
  timer?: TimerState;
  lastBackup?: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onManual: () => void;
  onGoToSettings: () => void;
}

const DAY = 86_400_000;

export function SitScreen(p: Props) {
  const [keepAwake, setKeepAwake] = useLocalState('keepAwake', false);
  const active = p.timer && p.timer.status !== 'finished';
  const summary = todayAndWeek(p.sessions);
  const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  // Erinnerung, wenn seit über 30 Tagen kein Export erfolgte
  const firstCreated = p.sessions.reduce<string | undefined>(
    (m, s) => (!m || s.createdAt < m ? s.createdAt : m),
    undefined,
  );
  const reference = p.lastBackup ?? firstCreated;
  const remindBackup = p.sessions.length > 0 && !!reference && Date.now() - new Date(reference).getTime() > 30 * DAY;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Sitzen</h1>
      </header>

      {remindBackup && (
        <button
          type="button"
          onClick={p.onGoToSettings}
          className="rounded-xl bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900"
        >
          Seit über 30 Tagen kein Export. Ein Backup schützt deine Einträge – <span className="underline">jetzt sichern</span>.
        </button>
      )}

      <div className="flex flex-col items-center gap-6 py-6 md:py-10">
        <button
          type="button"
          onClick={p.onStart}
          disabled={!!active}
          className="flex aspect-square w-60 max-w-[70vw] items-center justify-center rounded-full bg-moss-900 text-2xl font-medium text-moss-50 shadow-lg ring-8 ring-moss-100 transition-transform hover:scale-[1.02] active:scale-95 dark:bg-moss-800 dark:ring-moss-950"
        >
          Sitzung starten
        </button>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base">
          <input
            type="checkbox"
            className="h-5 w-5 accent-moss-700"
            checked={keepAwake}
            onChange={(e) => setKeepAwake(e.target.checked)}
            disabled={!wakeLockSupported}
          />
          <span>
            Bildschirm anlassen
            {!wakeLockSupported && (
              <span className="block text-sm text-stone-500">In diesem Browser nicht verfügbar</span>
            )}
          </span>
        </label>

        <button
          type="button"
          onClick={p.onManual}
          className="min-h-11 text-base text-moss-800 underline underline-offset-4 dark:text-moss-300"
        >
          Eintrag ohne Timer erfassen
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-sm text-stone-500 dark:text-stone-400">Heute</p>
          <p className="mt-1 text-2xl font-semibold tabular">{formatMinutes(summary.today.minutes)}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {summary.today.count} {summary.today.count === 1 ? 'Sitzung' : 'Sitzungen'}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500 dark:text-stone-400">Diese Woche</p>
          <p className="mt-1 text-2xl font-semibold tabular">{formatMinutes(summary.week.minutes)}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {summary.week.count} {summary.week.count === 1 ? 'Sitzung' : 'Sitzungen'}
          </p>
        </Card>
      </div>

      {active && p.timer && (
        <TimerOverlay
          timer={p.timer}
          keepAwake={keepAwake && wakeLockSupported}
          onPause={p.onPause}
          onResume={p.onResume}
          onFinish={p.onFinish}
        />
      )}
    </div>
  );
}

function TimerOverlay({
  timer,
  keepAwake,
  onPause,
  onResume,
  onFinish,
}: {
  timer: TimerState;
  keepAwake: boolean;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
}) {
  const running = timer.status === 'running';
  const now = useNow(500, true);
  const seconds = Math.floor(elapsedMs(timer, now) / 1000);
  const lockRef = useRef<WakeLockSentinel | null>(null);

  // Screen Wake Lock: nur während die Uhr läuft und der Schalter an ist
  useEffect(() => {
    if (!keepAwake || !running) return;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState === 'visible' && !lockRef.current) {
          const l = await navigator.wakeLock.request('screen');
          if (cancelled) return void l.release();
          lockRef.current = l;
          l.addEventListener('release', () => {
            if (lockRef.current === l) lockRef.current = null;
          });
        }
      } catch {
        /* z. B. Akkusparmodus – ohne Wake Lock weiter */
      }
    };
    void acquire();
    const onVis = () => void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void lockRef.current?.release();
      lockRef.current = null;
    };
  }, [keepAwake, running]);

  // Theme-Farbe der Statusleiste abdunkeln
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute('content');
    meta?.setAttribute('content', '#000000');
    return () => {
      if (prev) meta?.setAttribute('content', prev);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black px-6 py-12 text-stone-400 select-none">
      <p className="text-sm tracking-wide text-stone-500">
        Beginn {toHHMM(new Date(timer.sessionStart))} Uhr
      </p>
      <div className="flex flex-col items-center gap-3" aria-live="off">
        <p className="text-7xl font-extralight tabular text-stone-300 md:text-8xl" role="timer" aria-label="Verstrichene Zeit">
          {formatClock(seconds)}
        </p>
        <p className="text-sm text-stone-500">{running ? 'läuft' : 'pausiert'}</p>
      </div>
      <div className="safe-bottom flex w-full max-w-sm gap-4">
        <button
          type="button"
          className="min-h-14 flex-1 rounded-xl text-base font-medium text-stone-400 ring-1 ring-stone-800 hover:bg-stone-900"
          onClick={running ? onPause : onResume}
        >
          {running ? 'Pause' : 'Weiter'}
        </button>
        <button
          type="button"
          className="min-h-14 flex-1 rounded-xl bg-stone-900 text-base font-medium text-stone-300 hover:bg-stone-800"
          onClick={onFinish}
        >
          Beenden
        </button>
      </div>
    </div>
  );
}
