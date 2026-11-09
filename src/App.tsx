import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteMeta, getMeta, META, setMeta } from './db';
import type { SessionDraft, TimerState } from './types';
import { applyFilters, DEFAULT_FILTERS, type Filters } from './lib/filters';
import { emptyDraft, saveDraft } from './lib/sessions';
import { elapsedMs, finishTimer, pauseTimer, resumeTimer, startTimer } from './lib/timer';
import { floorMinutes, msToSeconds, toHHMM, toISODate } from './lib/time';
import { useToast } from './components/ui';
import { TabBar, type Tab } from './components/TabBar';
import { UpdatePrompt } from './components/UpdatePrompt';
import { EntryForm } from './components/EntryForm';
import { EntryDetail } from './components/EntryDetail';
import { SitScreen } from './screens/SitScreen';
import { LogScreen } from './screens/LogScreen';
// Statistik (mit Recharts) erst laden, wenn der Tab geöffnet wird
const StatsScreen = lazy(() => import('./screens/StatsScreen').then((m) => ({ default: m.StatsScreen })));
import { SettingsScreen } from './screens/SettingsScreen';

const TABS: Tab[] = ['sitzen', 'protokoll', 'statistik', 'einstellungen'];

function initialTab(): Tab {
  const h = window.location.hash.replace('#', '') as Tab;
  return TABS.includes(h) ? h : 'sitzen';
}

function draftFromTimer(t: TimerState): SessionDraft {
  const seconds = msToSeconds(elapsedMs(t));
  const start = new Date(t.sessionStart);
  return {
    date: toISODate(start),
    startTime: toHHMM(start),
    durationMinutes: String(floorMinutes(seconds)),
    durationSeconds: seconds,
    anchor: '',
    observation: '',
    posture: '',
    location: '',
    background: '',
    fromTimer: true,
  };
}

export default function App() {
  const [tab, setTabState] = useState<Tab>(initialTab);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [form, setForm] = useState<SessionDraft | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toastEl, toast] = useToast();

  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const postures = useLiveQuery(() => db.postures.orderBy('order').toArray(), []) ?? [];
  const lastBackup = useLiveQuery(() => getMeta<string>(META.lastBackup), []);

  // ---------- Stoppuhr (Zustand in IndexedDB gesichert) ----------
  const [timer, setTimerState] = useState<TimerState | undefined>();
  const [timerLoaded, setTimerLoaded] = useState(false);
  useEffect(() => {
    getMeta<TimerState>(META.timer).then((t) => {
      setTimerState(t);
      setTimerLoaded(true);
    });
  }, []);
  const updateTimer = useCallback((t?: TimerState) => {
    setTimerState(t);
    void (t ? setMeta(META.timer, t) : deleteMeta(META.timer));
  }, []);

  // Beendete, aber noch nicht gespeicherte Sitzung (z. B. nach Neuladen) → Formular wieder öffnen
  useEffect(() => {
    if (timerLoaded && timer?.status === 'finished' && !form) setForm(draftFromTimer(timer));
  }, [timerLoaded, timer, form]);

  const setTab = (t: Tab) => {
    setTabState(t);
    history.replaceState(null, '', `#${t}`);
    window.scrollTo({ top: 0 });
  };

  const today = toISODate(new Date());
  const filtered = useMemo(() => applyFilters(sessions ?? [], filters, today), [sessions, filters, today]);

  const handleSave = async (d: SessionDraft) => {
    await saveDraft(d);
    if (d.fromTimer) updateTimer(undefined);
    setForm(null);
    toast(d.id ? 'Änderungen gespeichert' : 'Eintrag gespeichert');
  };

  const handleCancelForm = (d: SessionDraft) => {
    if (d.fromTimer) updateTimer(undefined);
    setForm(null);
  };

  const detail = detailId ? sessions?.find((s) => s.id === detailId) : undefined;

  return (
    <div className="min-h-dvh">
      <UpdatePrompt />
      <main className="mx-auto w-full max-w-xl px-4 pt-4 pb-28 md:max-w-5xl md:px-8 md:pt-8">
        {sessions === undefined ? (
          <p className="py-20 text-center text-stone-500">Lade …</p>
        ) : (
          <>
            {tab === 'sitzen' && (
              <SitScreen
                sessions={sessions}
                timer={timer}
                lastBackup={lastBackup}
                onStart={() => updateTimer(startTimer())}
                onPause={() => timer && updateTimer(pauseTimer(timer))}
                onResume={() => timer && updateTimer(resumeTimer(timer))}
                onFinish={() => timer && updateTimer(finishTimer(timer))}
                onManual={() => setForm(emptyDraft())}
                onGoToSettings={() => setTab('einstellungen')}
              />
            )}
            {tab === 'protokoll' && (
              <LogScreen
                total={sessions.length}
                filtered={filtered}
                filters={filters}
                setFilters={setFilters}
                postures={postures}
                sessions={sessions}
                onOpen={setDetailId}
                onNew={() => setForm(emptyDraft())}
              />
            )}
            {tab === 'statistik' && (
              <Suspense fallback={<p className="py-20 text-center text-stone-500">Lade …</p>}>
                <StatsScreen
                  total={sessions.length}
                  sessions={sessions}
                  filtered={filtered}
                  filters={filters}
                  setFilters={setFilters}
                  postures={postures}
                />
              </Suspense>
            )}
            {tab === 'einstellungen' && (
              <SettingsScreen
                sessions={sessions}
                filtered={filtered}
                filters={filters}
                postures={postures}
                lastBackup={lastBackup}
                toast={toast}
              />
            )}
          </>
        )}
      </main>

      <TabBar tab={tab} onChange={setTab} />

      {detail && (
        <EntryDetail
          session={detail}
          onClose={() => setDetailId(null)}
          onEdit={(d) => setForm(d)}
          onDeleted={() => {
            setDetailId(null);
            toast('Eintrag gelöscht');
          }}
        />
      )}

      {form && (
        <EntryForm
          key={form.id ?? (form.fromTimer ? 'timer' : 'new')}
          initial={form}
          postures={postures}
          onSave={handleSave}
          onCancel={handleCancelForm}
        />
      )}
      {toastEl}
    </div>
  );
}
