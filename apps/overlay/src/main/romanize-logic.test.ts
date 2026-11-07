import { describe, expect, it } from 'vitest';
import { needsRomanization, romanizeLine } from './romanize-logic.js';

describe('romanizeLine', () => {
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
});
