import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Stündlich nach Updates schauen, solange die App offen ist
      if (reg) setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-moss-900 px-4 py-2 text-sm text-white"
    >
      <span>Neue Version verfügbar</span>
      <button
        type="button"
        className="min-h-9 rounded-lg bg-white/15 px-3 font-medium hover:bg-white/25"
        onClick={() => void updateServiceWorker(true)}
      >
        Neu laden
      </button>
      <button
        type="button"
        className="min-h-9 rounded-lg px-2 text-white/70 hover:text-white"
        onClick={() => setNeedRefresh(false)}
        aria-label="Hinweis ausblenden"
      >
        ×
      </button>
    </div>
  );
}
