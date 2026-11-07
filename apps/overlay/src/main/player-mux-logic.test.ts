import { describe, expect, it } from 'vitest';
import {
  isBrowserMediaAppId,
  isFoobarAppId,
  parseSourceMode,
  pickWinner,
  slugIdentity,
  sourceModeLabel,
  type PlayerCandidate,
} from './player-mux-logic.js';

function cand(partial: Partial<PlayerCandidate> & Pick<PlayerCandidate, 'kind' | 'identity'>): PlayerCandidate {
  return {
    playing: true,
    title: 'Song',
    artist: 'Artist',
    positionMs: 0,
    playbackRate: 1,
    trackChangedAt: 1,
    ...partial,
  };
}

describe('parseSourceMode', () => {
  it('accepts the three tray values and defaults the rest to auto', () => {
    expect(parseSourceMode('auto')).toBe('auto');
    expect(parseSourceMode('youtube_music')).toBe('youtube_music');
    expect(parseSourceMode('foobar2000')).toBe('foobar2000');
    expect(parseSourceMode('spotify')).toBe('auto');
    expect(parseSourceMode(null)).toBe('auto');
  });
});

describe('sourceModeLabel', () => {
  it('matches the tray labels', () => {
    expect(sourceModeLabel('auto')).toBe('Auto');
    expect(sourceModeLabel('youtube_music')).toBe('YouTube Music');
    expect(sourceModeLabel('foobar2000')).toBe('foobar2000');
  });
});

describe('app id helpers', () => {
  it('recognises foobar2000 and browser SMTC sessions', () => {
    expect(isFoobarAppId('foobar2000.exe')).toBe(true);
    expect(isFoobarAppId('PeterPawlowski.foobar2000_…')).toBe(true);
    expect(isFoobarAppId('Spotify.exe')).toBe(false);
    expect(isBrowserMediaAppId('Chrome.Chrome')).toBe(true);
    expect(isBrowserMediaAppId('Microsoft.MicrosoftEdge_…')).toBe(true);
    expect(isBrowserMediaAppId('foobar2000.exe')).toBe(false);
  });
});

describe('pickWinner', () => {
  const ytm = cand({
    kind: 'youtube_music',
    identity: 'youtube:abc',
    trackChangedAt: 10,
  });
  const foobar = cand({
    kind: 'foobar2000',
    identity: 'foobar2000:x',
    appId: 'foobar2000.exe',
    title: 'Local',
    trackChangedAt: 20,
  });

  it('Auto prefers the playing session that last changed track', () => {
    const winner = pickWinner('auto', ytm, [foobar]);
    expect(winner?.kind).toBe('foobar2000');
    expect(winner?.title).toBe('Local');
  });

  it('Auto follows YouTube Music when it is the only one playing', () => {
    const pausedFb = { ...foobar, playing: false, trackChangedAt: 99 };
    expect(pickWinner('auto', ytm, [pausedFb])?.kind).toBe('youtube_music');
  });

  it('pinned YouTube Music ignores foobar even if foobar is playing', () => {
    expect(pickWinner('youtube_music', ytm, [foobar])?.kind).toBe('youtube_music');
    expect(pickWinner('youtube_music', null, [foobar])).toBeNull();
  });

  it('pinned foobar2000 ignores YouTube Music', () => {
    expect(pickWinner('foobar2000', ytm, [foobar])?.kind).toBe('foobar2000');
    expect(pickWinner('foobar2000', ytm, [])).toBeNull();
  });

  it('keeps a paused session (freeze) when nothing else is playing', () => {
    const paused = { ...foobar, playing: false };
    expect(pickWinner('auto', null, [paused])?.identity).toBe('foobar2000:x');
  });

  it('returns null when there is no titled session', () => {
    expect(pickWinner('auto', null, [])).toBeNull();
    expect(
      pickWinner('auto', { ...ytm, title: '' }, []),
    ).toBeNull();
  });

  it('does not treat Chrome SMTC as a rival when YTM is present via the extension', () => {
    const chrome = cand({
      kind: 'smtc',
      identity: 'smtc:chrome:x',
      appId: 'Chrome',
      trackChangedAt: 99,
    });
    expect(pickWinner('auto', ytm, [chrome])?.kind).toBe('youtube_music');
  });
});

describe('slugIdentity', () => {
  it('normalises whitespace and case', () => {
    expect(slugIdentity([' Artist ', 'SONG'])).toBe('artist|song');
  });
});
