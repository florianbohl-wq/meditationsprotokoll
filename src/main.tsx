import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { getMeta, META, setMeta } from './db';

// Beim ersten Start dauerhaften Speicher anfordern, damit Chrome die Daten nicht bei Speichermangel löscht.
(async () => {
  try {
    if (!(await getMeta<boolean>(META.persistAsked)) && navigator.storage?.persist) {
      await navigator.storage.persist();
      await setMeta(META.persistAsked, true);
    }
  } catch {
    /* nicht kritisch */
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
