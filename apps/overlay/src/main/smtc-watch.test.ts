import { describe, expect, it } from 'vitest';
import { isSmtcPlaying, parseSmtcJsonLine, smtcSessionsToCandidates } from './smtc-watch.js';

describe('isSmtcPlaying', () => {
  it('accepts Playing and WinRT enum 4', () => {
    expect(isSmtcPlaying('Playing')).toBe(true);
    expect(isSmtcPlaying('playing')).toBe(true);
    expect(isSmtcPlaying('4')).toBe(true);
    expect(isSmtcPlaying(4)).toBe(true);
    expect(isSmtcPlaying('Paused')).toBe(false);
    expect(isSmtcPlaying('5')).toBe(false);
    expect(isSmtcPlaying('')).toBe(false);
  });
});

describe('parseSmtcJsonLine', () => {
  it('parses an array or a single object', () => {
    expect(parseSmtcJsonLine('[]')).toEqual([]);
    expect(parseSmtcJsonLine('{"title":"A"}')).toEqual([{ title: 'A' }]);
    expect(parseSmtcJsonLine('not json')).toEqual([]);
  });
});

describe('smtcSessionsToCandidates', () => {
  it('tags foobar and keeps trackChangedAt for the same identity', () => {
    const rows = [
      {
        appId: 'foobar2000.exe',
        title: 'Track',
        artist: 'Artist',
        status: 'Playing',
        positionMs: 1000,
        durationMs: 200000,
      },
    ];
    const first = smtcSessionsToCandidates(rows, 10, new Map());
    expect(first[0]?.kind).toBe('foobar2000');
    expect(first[0]?.playing).toBe(true);
    const second = smtcSessionsToCandidates(rows, 50, new Map([[first[0]!.identity, first[0]!]]));
    expect(second[0]?.trackChangedAt).toBe(10);
  });

  it('skips untitled sessions', () => {
    expect(smtcSessionsToCandidates([{ appId: 'x', title: '  ' }], 1, new Map())).toEqual([]);
  });

  it('treats numeric PlaybackStatus 4 as playing', () => {
    const [session] = smtcSessionsToCandidates(
      [{ appId: 'foobar2000.exe', title: 'T', artist: 'A', status: '4' }],
      1,
      new Map(),
    );
    expect(session?.playing).toBe(true);
  });
});
