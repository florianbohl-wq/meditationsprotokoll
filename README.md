# Meditationsprotokoll

Schlanke, deutschsprachige Web-App (PWA) als tägliches Übungsprotokoll für Meditation:
Sitzung mit Stoppuhr messen, Eintrag erfassen, alle Einträge als Liste oder Tabelle ansehen,
filtern, Statistiken anzeigen und als Excel exportieren.

**Alle Daten bleiben ausschließlich lokal auf dem Gerät** (IndexedDB). Kein Backend, kein Login, kein Tracking.

Technik: Vite, React, TypeScript, Tailwind CSS, vite-plugin-pwa, Dexie.js, ExcelJS, Recharts.

## Voraussetzungen

- [Node.js](https://nodejs.org/) ab Version 20 (getestet mit 24)
- Einmalig im Projektordner: `npm install`

## Am Laptop testen

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsmodus mit Live-Aktualisierung: <http://localhost:5173/meditationsprotokoll/> |
| `npm run test:laptop` | Baut die App und öffnet die fertige Version inkl. Service Worker und Offline-Funktion: <http://localhost:4173/meditationsprotokoll/> |
| `npm run test:handy` | Wie oben, aber im WLAN erreichbar. Die angezeigte „Network“-Adresse auf dem Handy öffnen (ohne Installation/Offline, dafür ist https nötig). |
| `npm test` | Unit-Tests |
| `npm run build` | Build für die Veröffentlichung (ohne Entwicklungsbereich) |

Beenden eines laufenden Servers: im Terminal `Strg + C`.

Der Bereich **Einstellungen → Entwicklung** (30 Beispiel-Einträge erzeugen / löschen) ist in
`npm run dev`, `npm run test:laptop` und `npm run test:handy` sichtbar, im veröffentlichten Build nicht.

**Hinweis:** Jede Adresse (Port 5173, Port 4173, später GitHub Pages) hat ihre eigenen, getrennten Daten.

### Handy-Darstellung und Offline prüfen

1. In Chrome oder Edge `F12` drücken (Entwicklertools).
2. Mit `Strg + Umschalt + M` die Geräteansicht (Device Toolbar) einschalten und oben z. B. „Pixel 7“ wählen.
3. Im Reiter **Network** (Netzwerk) von „No throttling“ auf **Offline** umstellen und die Seite neu laden –
   die App muss trotzdem starten (nur mit `npm run test:laptop`, nicht im Dev-Modus).
4. Dunkelmodus testen: in den Entwicklertools `Strg + Umschalt + P` → „Rendering“ → *Emulate CSS prefers-color-scheme: dark*.

### Am Laptop installieren

Mit `npm run test:laptop` gestartet erscheint in Chrome/Edge rechts in der Adressleiste ein
Installieren-Symbol (Bildschirm mit Pfeil). Damit läuft die App als eigenes Fenster.

### Test-Checkliste vor der Veröffentlichung

- [ ] Beispiel-Einträge erzeugen; Protokoll, Filter, Suche und Statistik prüfen.
- [ ] Stoppuhr starten, Tab wechseln, nach einigen Minuten zurückkehren: Zeit stimmt. Seite neu laden: laufende Sitzung bleibt erhalten.
- [ ] Eintrag ohne Pflichtfelder speichern: Fehlermeldungen erscheinen.
- [ ] Neue Haltung im Formular anlegen, in den Einstellungen umbenennen, archivieren.
- [ ] Excel exportieren und in Excel öffnen: Spalten, Datumsformat, Autofilter korrekt.
- [ ] JSON-Backup exportieren, alle Daten löschen, Backup importieren: alles wieder da.
- [ ] Handy-Ansicht in den Entwicklertools und breite Ansicht im normalen Fenster prüfen; Hell- und Dunkelmodus.
- [ ] Offline-Modus simulieren, Seite neu laden: App startet.
- [ ] App am Laptop installieren und als eigenes Fenster öffnen.

## Installation auf dem Handy

(Ausführliche Anleitung in `GitHub-Anleitung.docx`.)

1. Repository `meditationsprotokoll` auf GitHub anlegen und den Code pushen. GitHub Actions
   (`.github/workflows/deploy.yml`) testet, baut und veröffentlicht automatisch bei jedem Push auf `main`.
2. Auf GitHub unter **Settings → Pages** als Quelle **„GitHub Actions“** wählen.
3. Die Pages-Adresse `https://<dein-benutzername>.github.io/meditationsprotokoll/` in Chrome auf dem
   Android-Handy öffnen → Menü (⋮) → **„App installieren“** bzw. „Zum Startbildschirm hinzufügen“.
4. Hinweis: Beim kostenlosen GitHub-Plan muss das Repository für Pages öffentlich sein.
   Öffentlich ist dann nur der Code, nicht deine Einträge.

Heißt das Repository anders, muss `REPO_NAME` in `vite.config.ts` angepasst werden – sonst bleibt die Seite weiß.

### Manuelle Checkliste auf dem Handy

- [ ] Installation
- [ ] Neue Haltung im Formular anlegen und umbenennen
- [ ] Offline-Start im Flugmodus
- [ ] Timer bei gesperrtem Bildschirm über 10 Minuten
- [ ] Excel-Export teilen an Google Drive
- [ ] Backup-Import auf frischer Installation

## Datensicherheit

- Beim ersten Start fordert die App dauerhaften Speicher an (`navigator.storage.persist()`).
- Werden die Website-Daten in Chrome gelöscht oder die App deinstalliert, sind die Einträge weg.
  Regelmäßiger Excel- oder JSON-Export dient als Backup; die App erinnert nach 30 Tagen ohne Export.

## Icons neu erzeugen

`npm run icons` (schreibt PNG-Icons und Favicon nach `public/`).
