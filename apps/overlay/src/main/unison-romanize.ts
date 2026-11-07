/**
 * Better Lyrics Unison translate endpoint — same romaji path their extension
 * uses (google-lyrics-translate). LRCLIB has no romaji field; this fills it.
 */
export const UNISON_TRANSLATE_URL = 'https://unison.betterlyrics.org/translate';
export const UNISON_TIMEOUT_MS = 4000;
export const UNISON_MAX_LINES = 200;

export interface UnisonLineResult {
  translation?: string | null;
  romanization?: string | null;
  needsTranslation?: boolean;
}

export interface UnisonTranslateResponse {
  lines?: UnisonLineResult[];
  detectedLang?: string;
  provider?: string;
}

export type UnisonFetch = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Detect Unison `from` for a batch: ja if any kana, else ko if hangul, else zh if Han. */
export function detectUnisonFrom(lines: readonly string[]): string | null {
  let hasKana = false;
  let hasHangul = false;
  let hasHan = false;
  for (const line of lines) {
    if (/[\u3040-\u30ff]/.test(line)) hasKana = true;
    if (/[\uac00-\ud7a3]/.test(line)) hasHangul = true;
    if (/[\u3400-\u9fff]/.test(line)) hasHan = true;
  }
  if (hasKana) return 'ja';
  if (hasHangul) return 'ko';
  if (hasHan) return 'zh';
  return null;
}

export function needsUnisonRomanize(text: string): boolean {
  return /[\u3040-\u30ff\uac00-\ud7a3\u3400-\u9fff]/.test(text);
}

/**
 * POST /translate; returns one romanization (or '') per input line, same length.
 * Blank / already-Latin lines come back as ''.
 */
export async function fetchUnisonRomanizations(
  lines: readonly string[],
  opts: {
    fetchFn: UnisonFetch;
    baseUrl?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  },
): Promise<string[] | null> {
  if (lines.length === 0) return [];
  if (lines.length > UNISON_MAX_LINES) return null;
  const from = detectUnisonFrom(lines);
  if (!from) return lines.map(() => '');

  const base = (opts.baseUrl ?? UNISON_TRANSLATE_URL).replace(/\/$/, '');
  const timeoutMs = opts.timeoutMs ?? UNISON_TIMEOUT_MS;
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  const kill = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await opts.fetchFn(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ lines: [...lines], to: 'en', from }),
      signal: ac.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as UnisonTranslateResponse;
    if (!Array.isArray(body.lines) || body.lines.length !== lines.length) return null;
    return body.lines.map((row) => {
      const roma = typeof row?.romanization === 'string' ? row.romanization.trim() : '';
      return roma;
    });
  } catch {
    return null;
  } finally {
    clearTimeout(kill);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}
