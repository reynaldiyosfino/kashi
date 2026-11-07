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

describe('romanizeLines Unison then local', () => {
  it('prefers Unison romanization for mixed JP', async () => {
    const lines = await romanizeLines([{ text: '変わらない風景 浅い正午' }], {
      unisonRomanizations: ['kawaranai fuukei asai shougo'],
    });
    expect(lines[0]?.romaji).toBe('kawaranai fuukei asai shougo');
    expect(lines[0]?.romaji).not.toMatch(/zheng|変|風/);
  });

  it('falls back to local when Unison misses', async () => {
    const lines = await romanizeLines([{ text: 'ありがとう' }], {
      unisonRomanizations: null,
    });
    expect(lines[0]?.romaji).toBe('arigatou');
  });

  it('hides mixed JP romaji when Unison is unavailable', async () => {
    const lines = await romanizeLines([{ text: '変わらない風景 浅い正午' }], {
      unisonRomanizations: null,
    });
    expect(lines[0]?.romaji).toBeUndefined();
  });
});
