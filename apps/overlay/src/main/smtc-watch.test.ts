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

  it('extrapolates when SMTC timeline stays at 0 while playing', () => {
    const row = {
      appId: 'foobar2000.exe',
      title: '火星人',
      artist: 'ヨルシカ',
      status: 'Playing',
      positionMs: 0,
      durationMs: 0,
    };
    const first = smtcSessionsToCandidates([row], 1000, new Map());
    expect(first[0]?.positionMs).toBe(0);
    const second = smtcSessionsToCandidates(
      [row],
      1400,
      new Map([[first[0]!.identity, first[0]!]]),
    );
    expect(second[0]?.positionMs).toBe(400);
  });

  it('freezes extrapolated position while paused', () => {
    const playing = smtcSessionsToCandidates(
      [
        {
          appId: 'foobar2000.exe',
          title: 'T',
          artist: 'A',
          status: 'Playing',
          positionMs: 0,
        },
      ],
      1000,
      new Map(),
    );
    const advanced = smtcSessionsToCandidates(
      [
        {
          appId: 'foobar2000.exe',
          title: 'T',
          artist: 'A',
          status: 'Playing',
          positionMs: 0,
        },
      ],
      1500,
      new Map([[playing[0]!.identity, playing[0]!]]),
    );
    const paused = smtcSessionsToCandidates(
      [
        {
          appId: 'foobar2000.exe',
          title: 'T',
          artist: 'A',
          status: 'Paused',
          positionMs: 0,
        },
      ],
      2000,
      new Map([[advanced[0]!.identity, advanced[0]!]]),
    );
    expect(paused[0]?.positionMs).toBe(500);
    expect(paused[0]?.playing).toBe(false);
  });

  it('does not override a real SMTC timeline', () => {
    const [session] = smtcSessionsToCandidates(
      [
        {
          appId: 'foobar2000.exe',
          title: 'T',
          artist: 'A',
          status: 'Playing',
          positionMs: 12_000,
          durationMs: 200_000,
        },
      ],
      1,
      new Map(),
    );
    expect(session?.positionMs).toBe(12_000);
  });
});
