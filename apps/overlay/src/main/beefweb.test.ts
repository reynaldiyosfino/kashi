import { describe, expect, it } from 'vitest';
import { mergeFoobarCandidates, parseBeefwebPlayer } from './beefweb.js';
import type { PlayerCandidate } from './player-mux-logic.js';

describe('parseBeefwebPlayer', () => {
  it('maps a playing item', () => {
    const c = parseBeefwebPlayer(
      {
        player: {
          playbackState: 'playing',
          activeItem: { position: 12.5, duration: 200, columns: ['A', 'T', 'Al'] },
        },
      },
      5,
    );
    expect(c?.kind).toBe('foobar2000');
    expect(c?.title).toBe('T');
    expect(c?.positionMs).toBe(12500);
    expect(c?.durationMs).toBe(200000);
    expect(c?.playing).toBe(true);
  });

  it('returns null when stopped or untitled', () => {
    expect(
      parseBeefwebPlayer({ player: { playbackState: 'stopped', activeItem: { columns: ['A', 'T'] } } }, 1),
    ).toBeNull();
    expect(parseBeefwebPlayer({ player: { playbackState: 'playing', activeItem: { columns: ['A', ''] } } }, 1)).toBeNull();
  });
});

describe('mergeFoobarCandidates', () => {
  it('overlays beefweb position onto a matching SMTC session', () => {
    const smtc: PlayerCandidate = {
      kind: 'foobar2000',
      identity: 'foobar2000:a|t',
      playing: true,
      title: 'T',
      artist: 'A',
      positionMs: 10,
      playbackRate: 1,
      trackChangedAt: 1,
      appId: 'foobar2000.exe',
    };
    const beef = parseBeefwebPlayer(
      {
        player: {
          playbackState: 'playing',
          activeItem: { position: 3, duration: 10, columns: ['A', 'T'] },
        },
      },
      9,
    )!;
    const merged = mergeFoobarCandidates([smtc], beef, 9);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.positionMs).toBe(3000);
  });
});
