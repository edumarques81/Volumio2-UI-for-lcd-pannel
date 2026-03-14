/**
 * Album art colour extractor
 *
 * Loads an image onto an offscreen canvas, samples the pixels, and returns
 * the most "vibrant" colour — high saturation, mid-tone, not too dark or light.
 * Used to seed the MD3 dynamic tonal palette for the current track.
 */

const DEFAULT_SEED = '#B5264C'; // Rose fallback when extraction fails
const SAMPLE_SIZE = 64;         // Downscale before sampling (perf vs accuracy)

/** Main entry — returns a hex seed colour from the given image URL. */
export async function extractSeedColor(imageUrl: string): Promise<string> {
  if (!imageUrl || typeof document === 'undefined') return DEFAULT_SEED;
  // Skip data URIs — usually too small/encoded for meaningful extraction
  if (imageUrl.startsWith('data:')) return DEFAULT_SEED;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(DEFAULT_SEED); return; }

        ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

        let bestR = 181, bestG = 38, bestB = 76, bestScore = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue; // ignore transparent

          const { h, s, l } = rgbToHsl(r, g, b);
          void h; // hue not needed for scoring

          // Filter extremes — we want vibrant mid-tones
          if (l < 0.12 || l > 0.88) continue;
          if (s < 0.18) continue; // too grey/neutral

          // Score: maximise saturation, prefer lightness near 0.45
          const score = s * (1 - Math.abs(l - 0.45) * 1.2);
          if (score > bestScore) {
            bestScore = score;
            bestR = r; bestG = g; bestB = b;
          }
        }

        resolve(rgbToHex(bestR, bestG, bestB));
      } catch {
        // Canvas security error (CORS) or any other issue
        resolve(DEFAULT_SEED);
      }
    };

    img.onerror = () => resolve(DEFAULT_SEED);

    // Append cache-bust only for localhost URLs (Pi album art)
    const url = imageUrl.startsWith('http://localhost') || imageUrl.startsWith('http://127.')
      ? imageUrl
      : imageUrl;
    img.src = url;
  });
}

// ─── Colour math helpers ──────────────────────────────────────────────────────

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn)      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else                 h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * Math.max(0, Math.min(1, color)));
  };
  return rgbToHex(f(0), f(8), f(4));
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return rgbToHsl(r, g, b);
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
    .join('');
}
