import { isAndroid } from './hooks';

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Auf Android über das Teilen-Menü (z. B. an Drive oder Mail), sonst als Download. */
export async function shareOrDownload(blob: Blob, filename: string, mime: string): Promise<ShareResult> {
  if (isAndroid() && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
        // z. B. NotAllowedError → Download als Rückfallebene
      }
    }
  }
  download(blob, filename);
  return 'downloaded';
}
