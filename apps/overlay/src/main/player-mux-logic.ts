/**
 * Which player the overlay should follow. Pure so Auto / pinned sources
 * are unit-tested without Electron or SMTC.
 */
import type { TrackInfo } from '@kashi/protocol';

export const SOURCE_MODES = ['auto', 'youtube_music', 'foobar2000'] as const;
export type SourceMode = (typeof SOURCE_MODES)[number];

export const DEFAULT_SOURCE_MODE: SourceMode = 'auto';

export type PlayerKind = 'youtube_music' | 'foobar2000' | 'smtc';

export interface PlayerCandidate {
  kind: PlayerKind;
  /** Stable track key (`youtube:id`, `foobar2000:…`, `smtc:…`). */
  identity: string;
  playing: boolean;
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  positionMs: number;
  playbackRate: number;
  /** Epoch ms when this identity first appeared (or last changed). */
  trackChangedAt: number;
  artworkUrl?: string;
  /** AppUserModelId or similar, for SMTC sessions. */
  appId?: string;
  /** Extension latch ids, when this candidate came from YouTube Music. */
  clientId?: number;
  tabId?: number;
}

export function parseSourceMode(value: unknown): SourceMode {
  if (value === 'auto' || value === 'youtube_music' || value === 'foobar2000') return value;
  return DEFAULT_SOURCE_MODE;
}

export function sourceModeLabel(mode: SourceMode): string {
  if (mode === 'youtube_music') return 'YouTube Music';
  if (mode === 'foobar2000') return 'foobar2000';
  return 'Auto';
}

export function isFoobarAppId(appId: string | undefined): boolean {
  if (!appId) return false;
  const id = appId.toLowerCase();
  return id.includes('foobar2000') || id.includes('foobar2000.exe');
}

/** Chrome / Edge / YTM desktop — the extension already owns that clock. */
export function isBrowserMediaAppId(appId: string | undefined): boolean {
  if (!appId) return false;
  const id = appId.toLowerCase();
  return (
    id.includes('chrome') ||
    id.includes('msedge') ||
    id.includes('edge') ||
    id.includes('brave') ||
    id.includes('firefox') ||
    id.includes('youtube.music') ||
    id.includes('youtubemusic')
  );
}

export function slugIdentity(parts: readonly string[]): string {
  return parts
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter((part) => part.length > 0)
    .join('|')
    .slice(0, 180);
}

/**
 * Pick the session the overlay should show.
 *
 * Auto: among Playing candidates, the one that last changed track. Paused
 * sessions stay on screen (clock frozen). Nothing eligible → null (idle).
 */
export function pickWinner(
  mode: SourceMode,
  ytm: PlayerCandidate | null,
  sessions: readonly PlayerCandidate[],
): PlayerCandidate | null {
  const foobar = sessions.filter((session) => session.kind === 'foobar2000' || isFoobarAppId(session.appId));
  const other = sessions.filter(
    (session) =>
      session.kind !== 'foobar2000' &&
      !isFoobarAppId(session.appId) &&
      !isBrowserMediaAppId(session.appId),
  );

  const allowed: PlayerCandidate[] = [];
  if (mode === 'auto' || mode === 'youtube_music') {
    if (ytm && ytm.title) allowed.push(ytm);
  }
  if (mode === 'auto' || mode === 'foobar2000') {
    for (const session of foobar) {
      if (session.title) allowed.push({ ...session, kind: 'foobar2000' });
    }
  }
  if (mode === 'auto') {
    for (const session of other) {
      if (session.title) allowed.push(session);
    }
  }

  const playing = allowed.filter((candidate) => candidate.playing);
  const pool = playing.length > 0 ? playing : allowed.filter((candidate) => !candidate.playing);
  if (pool.length === 0) return null;
  return pool.reduce((best, candidate) =>
    candidate.trackChangedAt >= best.trackChangedAt ? candidate : best,
  );
}

export function candidateToTrack(candidate: PlayerCandidate): TrackInfo {
  const id = candidate.identity.includes(':')
    ? candidate.identity.slice(candidate.identity.indexOf(':') + 1)
    : candidate.identity;
  const type =
    candidate.kind === 'youtube_music'
      ? ('youtube' as const)
      : candidate.kind === 'foobar2000'
        ? ('foobar2000' as const)
        : ('smtc' as const);
  return {
    source: { type, id },
    title: candidate.title,
    artist: candidate.artist || 'Unknown',
    album: candidate.album,
    duration_ms: candidate.durationMs,
    artwork_url: candidate.artworkUrl,
  };
}
