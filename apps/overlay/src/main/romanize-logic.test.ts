import { describe, expect, it } from 'vitest';
import {
  needsRomanization,
  romanizeLine,
  romanizeLineLocal,
  romanizeLines,
} from './romanize-logic.js';

describe('romanizeLine local', () => {
  it('leaves latin lyrics alone', () => {
    expect(needsRomanization('Hello world')).toBe(false);
    expect(romanizeLine('Hello world')).toBe('');
  });

  it('romanizes hiragana (Hepburn)', () => {
    expect(romanizeLine('ありがとう')).toBe('arigatou');
    expect(romanizeLine('しゃしん')).toBe('shashin');
  });

  it('romanizes katakana', () => {
    expect(romanizeLine('カラオケ')).toBe('karaoke');
  });

  it('romanizes Hangul with Revised Romanization', () => {
    expect(romanizeLine('사랑')).toBe('sarang');
    expect(romanizeLine('한글')).toBe('hangeul');
  });

  it('romanizes common Chinese lyric characters to pinyin', () => {
    expect(romanizeLine('我爱你')).toBe('wo ai ni');
  });

  it('does not emit kana+pinyin garbage for mixed JP kanji lines', () => {
    expect(romanizeLineLocal('変わらない風景 浅い正午')).toBe('');
    expect(romanizeLineLocal('変わらない風景 浅い正午')).not.toMatch(/zheng/);
  });
});

describe('romanizeLines Unison then kuroshiro', () => {
  it('prefers Unison romanization for mixed JP', async () => {
    const lines = await romanizeLines([{ text: '変わらない風景 浅い正午' } as { text: string; romaji?: string }], {
      unisonRomanizations: ['kawaranai fuukei asai shougo'],
      kuroshiroFn: async () => 'should-not-run',
    });
    expect(lines[0]?.romaji).toBe('kawaranai fuukei asai shougo');
    expect(lines[0]?.romaji).not.toMatch(/zheng|変|風/);
  });

  it('falls back to local when Unison misses pure kana', async () => {
    const lines = await romanizeLines([{ text: 'ありがとう' } as { text: string; romaji?: string }], {
      unisonRomanizations: null,
      kuroshiroFn: async () => '',
    });
    expect(lines[0]?.romaji).toBe('arigatou');
  });

  it('falls back to kuroshiro for mixed JP when Unison misses', async () => {
    const lines = await romanizeLines([{ text: '変わらない風景 浅い正午' } as { text: string; romaji?: string }], {
      unisonRomanizations: null,
      kuroshiroFn: async () => 'kawaranai fuukei asai shougo',
      log: () => undefined,
    });
    expect(lines[0]?.romaji).toMatch(/kawaranai/);
    expect(lines[0]?.romaji).toMatch(/fuukei|fukei/);
    expect(lines[0]?.romaji).toMatch(/shougo|shogo/);
    expect(lines[0]?.romaji).not.toMatch(/zheng|変|風|景/);
  });

  it('hides mixed JP romaji when Unison and kuroshiro both miss', async () => {
    const lines = await romanizeLines([{ text: '変わらない風景 浅い正午' } as { text: string; romaji?: string }], {
      unisonRomanizations: null,
      kuroshiroFn: async () => '',
    });
    expect(lines[0]?.romaji).toBeUndefined();
  });
});

describe('romanizeWithKuroshiro live', () => {
  it('converts 変わらない風景 浅い正午 without zheng or kanji', async () => {
    const { romanizeWithKuroshiro } = await import('./kuroshiro-romanize.js');
    const out = await romanizeWithKuroshiro('変わらない風景 浅い正午');
    expect(out.length).toBeGreaterThan(0);
    expect(out).toMatch(/kawaranai/i);
    expect(out).toMatch(/fukei|fuukei/i);
    expect(out).toMatch(/shogo|shougo/i);
    expect(out).not.toMatch(/zheng|変|風|景|浅|正/);
  }, 30_000);
});
