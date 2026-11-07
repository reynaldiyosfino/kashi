import { describe, expect, it } from 'vitest';
import { parseSmtcJsonLine, smtcSessionsToCandidates } from './smtc-watch.js';

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
});
