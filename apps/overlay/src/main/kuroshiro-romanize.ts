/**
 * Offline JP romaji via kuroshiro + kuromoji. Init once; dict must be readable
 * outside asar (electron-builder asarUnpack + extraResources kuromoji-dict).
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

type KuroshiroInstance = {
  init: (analyzer: unknown) => Promise<void>;
  convert: (
    text: string,
    opts: { to: string; mode?: string; romajiSystem?: string },
  ) => Promise<string>;
};

let ready: Promise<KuroshiroInstance | null> | null = null;

function resolveKuromojiDictPath(): string {
  const fromResources = join(process.resourcesPath ?? '', 'kuromoji-dict');
  if (fromResources && existsSync(join(fromResources, 'base.dat.gz'))) {
    return fromResources;
  }
  const require = createRequire(import.meta.url);
  const pkg = require.resolve('kuromoji/package.json');
  const nested = join(dirname(pkg), 'dict');
  // Packaged asar: kuromoji lives under app.asar.unpacked when asarUnpack is set.
  if (nested.includes(`${join('app.asar')}${join('/')}`) || nested.includes('app.asar\\')) {
    const unpacked = nested.replace(`${join('app.asar')}`, join('app.asar.unpacked'));
    if (existsSync(join(unpacked, 'base.dat.gz'))) return unpacked;
  }
  return nested;
}

async function loadKuroshiro(): Promise<KuroshiroInstance | null> {
  try {
    const KuroshiroMod = await import('kuroshiro');
    const AnalyzerMod = await import('kuroshiro-analyzer-kuromoji');
    const KuroshiroCtor =
      (KuroshiroMod as { default?: new () => KuroshiroInstance }).default ??
      (KuroshiroMod as unknown as new () => KuroshiroInstance);
    const AnalyzerCtor =
      (AnalyzerMod as { default?: new (opts: { dictPath: string }) => unknown }).default ??
      (AnalyzerMod as unknown as new (opts: { dictPath: string }) => unknown);
    const instance = new KuroshiroCtor();
    await instance.init(new AnalyzerCtor({ dictPath: resolveKuromojiDictPath() }));
    return instance;
  } catch {
    return null;
  }
}

export function getKuroshiro(): Promise<KuroshiroInstance | null> {
  if (!ready) ready = loadKuroshiro();
  return ready;
}

/** Hepburn romaji for a JP lyric line, or '' on failure. */
export async function romanizeWithKuroshiro(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const kuroshiro = await getKuroshiro();
  if (!kuroshiro) return '';
  try {
    const out = await kuroshiro.convert(trimmed, {
      to: 'romaji',
      romajiSystem: 'hepburn',
    });
    // Match overlay/Unison ASCII Hepburn (no macrons): ū→uu, ō→ou.
    return out
      .replace(/[āĀ]/g, (c) => (c === 'Ā' ? 'Aa' : 'aa'))
      .replace(/[īĪ]/g, (c) => (c === 'Ī' ? 'Ii' : 'ii'))
      .replace(/[ūŪ]/g, (c) => (c === 'Ū' ? 'Uu' : 'uu'))
      .replace(/[ēĒ]/g, (c) => (c === 'Ē' ? 'Ee' : 'ee'))
      .replace(/[ōŌ]/g, (c) => (c === 'Ō' ? 'Ou' : 'ou'))
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return '';
  }
}

/** Test seam: reset the singleton between unit tests. */
export function resetKuroshiroForTests(): void {
  ready = null;
}
