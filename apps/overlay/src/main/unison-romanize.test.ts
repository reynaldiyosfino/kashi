import { describe, expect, it } from 'vitest';
import {
  detectUnisonFrom,
  fetchUnisonRomanizations,
  needsUnisonRomanize,
} from './unison-romanize.js';

describe('detectUnisonFrom', () => {
  it('prefers ja when kana is present', () => {
    expect(detectUnisonFrom(['変わらない風景 浅い正午'])).toBe('ja');
  });

  it('detects ko and zh', () => {
    expect(detectUnisonFrom(['사랑'])).toBe('ko');
    expect(detectUnisonFrom(['我爱你'])).toBe('zh');
    expect(detectUnisonFrom(['hello'])).toBeNull();
  });
});

describe('fetchUnisonRomanizations', () => {
  it('maps romanization per line', async () => {
    const fetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        lines: [
          { romanization: 'kawaranai fuukei asai shougo' },
          { romanization: null },
        ],
        detectedLang: 'ja',
      }),
    });
    const out = await fetchUnisonRomanizations(
      ['変わらない風景 浅い正午', ''],
      { fetchFn },
    );
    expect(out).toEqual(['kawaranai fuukei asai shougo', '']);
  });

  it('returns null on HTTP failure', async () => {
    const fetchFn = async () => ({
      ok: false,
      status: 502,
      json: async () => ({}),
    });
    expect(await fetchUnisonRomanizations(['사랑'], { fetchFn })).toBeNull();
  });
});

describe('needsUnisonRomanize', () => {
  it('flags CJK', () => {
    expect(needsUnisonRomanize('変わらない')).toBe(true);
    expect(needsUnisonRomanize('hello')).toBe(false);
  });
});
