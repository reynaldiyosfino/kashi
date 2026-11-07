/**
 * Optional foo_beefweb client. Used only when the mux winner is foobar2000
 * (or Auto picked foobar) for a tighter playhead than SMTC.
 */
import type { PlayerCandidate } from './player-mux-logic.js';
import { slugIdentity } from './player-mux-logic.js';

export const DEFAULT_BEEFWEB_URL = 'http://127.0.0.1:8880';

export interface BeefwebPlayerJson {
  player?: {
    playbackState?: string;
    activeItem?: {
      position?: number;
      duration?: number;
      columns?: unknown;
    };
  };
}

export function parseBeefwebPlayer(data: BeefwebPlayerJson, now: number): PlayerCandidate | null {
  const player = data.player;
  if (!player) return null;
  const item = player.activeItem;
  const columns = Array.isArray(item?.columns)
    ? item.columns.map((col) => String(col ?? ''))
    : [];
  const artist = (columns[0] ?? '').trim();
  const title = (columns[1] ?? '').trim();
  if (!title) return null;
  const album = (columns[2] ?? '').trim() || undefined;
  const state = String(player.playbackState ?? '').toLowerCase();
  const playing = state === 'playing';
  if (state === 'stopped') return null;
  const durationSec = item?.duration;
  const positionSec = item?.position;
  const durationMs =
    typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0
      ? Math.round(durationSec * 1000)
      : undefined;
  const positionMs =
    typeof positionSec === 'number' && Number.isFinite(positionSec)
      ? Math.max(0, Math.round(positionSec * 1000))
      : 0;
  return {
    kind: 'foobar2000',
    identity: `foobar2000:${slugIdentity([artist, title, album ?? ''])}`,
    playing,
    title,
    artist,
    album,
    durationMs,
    positionMs,
    playbackRate: 1,
    trackChangedAt: now,
    appId: 'foobar2000',
  };
}

export function mergeFoobarCandidates(
  smtc: readonly PlayerCandidate[],
  beefweb: PlayerCandidate | null,
  now: number,
): PlayerCandidate[] {
  if (!beefweb) return [...smtc];
  const match = smtc.find(
    (session) =>
      session.kind === 'foobar2000' &&
      session.title.trim().toLowerCase() === beefweb.title.trim().toLowerCase(),
  );
  if (match) {
    return smtc.map((session) =>
      session === match
        ? {
            ...session,
            playing: beefweb.playing,
            positionMs: beefweb.positionMs,
            durationMs: beefweb.durationMs ?? session.durationMs,
            trackChangedAt: match.identity === beefweb.identity ? match.trackChangedAt : now,
          }
        : session,
    );
  }
  return [...smtc, { ...beefweb, trackChangedAt: now }];
}

export class BeefwebClient {
  private timer: NodeJS.Timeout | null = null;
  private snapshot: PlayerCandidate | null = null;
  private identityEpoch = new Map<string, number>();

  constructor(
    private readonly fetchFn: typeof fetch,
    private readonly onChange: (candidate: PlayerCandidate | null) => void,
    private readonly log: (line: string) => void = () => {},
    private readonly baseUrl: string = DEFAULT_BEEFWEB_URL,
  ) {}

  start(): void {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 400);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getSnapshot(): PlayerCandidate | null {
    return this.snapshot;
  }

  private async tick(): Promise<void> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/player?columns=%25artist%25,%25title%25,%25album%25`;
    try {
      const ac = new AbortController();
      const kill = setTimeout(() => ac.abort(), 400);
      const res = await this.fetchFn(url, { signal: ac.signal });
      clearTimeout(kill);
      if (!res.ok) {
        this.setSnapshot(null);
        return;
      }
      const data = (await res.json()) as BeefwebPlayerJson;
      const parsed = parseBeefwebPlayer(data, Date.now());
      if (parsed) {
        const firstSeen = this.identityEpoch.get(parsed.identity) ?? parsed.trackChangedAt;
        if (!this.identityEpoch.has(parsed.identity)) this.identityEpoch.set(parsed.identity, firstSeen);
        this.setSnapshot({ ...parsed, trackChangedAt: firstSeen });
      } else {
        this.setSnapshot(null);
      }
    } catch {
      this.setSnapshot(null);
    }
  }

  private setSnapshot(next: PlayerCandidate | null): void {
    const prev = this.snapshot;
    this.snapshot = next;
    if (prev?.identity !== next?.identity || prev?.playing !== next?.playing) {
      if (next) this.log(`beefweb: ${next.playing ? 'playing' : 'paused'} ${next.artist} - ${next.title}`);
    }
    this.onChange(next);
  }
}
