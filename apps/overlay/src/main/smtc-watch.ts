/**
 * Windows SMTC session poller. Spawns scripts/smtc-watch.ps1 (WinRT AsTask
 * via MakeGenericMethod — PS 5.1 cannot call AsTask(IAsyncOperation) directly,
 * which left this overlay with an empty session list).
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { PlayerCandidate } from './player-mux-logic.js';
import { isFoobarAppId, slugIdentity } from './player-mux-logic.js';

export interface SmtcSessionRaw {
  appId?: string;
  title?: string;
  artist?: string;
  album?: string;
  status?: string;
  positionMs?: number;
  durationMs?: number;
}

/**
 * WinRT PlaybackStatus: Closed=0 Opened=1 Changing=2 Stopped=3 Playing=4
 * Paused=5. PowerShell `[string]$pb.PlaybackStatus` is sometimes `"4"`.
 */
export function isSmtcPlaying(status: unknown): boolean {
  const raw = String(status ?? '')
    .trim()
    .toLowerCase();
  return raw === 'playing' || raw === '4';
}

function smtcRowKey(row: SmtcSessionRaw): string {
  return `${row.appId ?? ''}|${row.title ?? ''}|${row.artist ?? ''}|${row.status ?? ''}`;
}

export function parseSmtcJsonLine(line: string): SmtcSessionRaw[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed as SmtcSessionRaw[];
    if (parsed && typeof parsed === 'object') return [parsed as SmtcSessionRaw];
    return [];
  } catch {
    return [];
  }
}

/** foobar2000 SMTC often reports Playing with position=0 and no duration. */
export function isDeadSmtcTimeline(positionMs: number, durationMs: number | undefined): boolean {
  return positionMs === 0 && (durationMs === undefined || durationMs <= 0);
}

export function resolveSmtcPositionMs(
  rowPositionMs: number,
  durationMs: number | undefined,
  playing: boolean,
  prev: PlayerCandidate | undefined,
  now: number,
): number {
  const reported = Math.max(0, rowPositionMs);
  if (!isDeadSmtcTimeline(reported, durationMs)) return reported;
  if (!prev) return 0;
  if (!playing) return Math.max(0, prev.positionMs);
  if (!prev.playing) return Math.max(0, prev.positionMs);
  const sampledAt = prev.sampledAt ?? prev.trackChangedAt;
  const dt = Math.max(0, now - sampledAt);
  return Math.max(0, prev.positionMs) + dt;
}

export function smtcSessionsToCandidates(
  rows: readonly SmtcSessionRaw[],
  now: number,
  previous: ReadonlyMap<string, PlayerCandidate>,
): PlayerCandidate[] {
  const out: PlayerCandidate[] = [];
  for (const row of rows) {
    const title = (row.title ?? '').trim();
    const artist = (row.artist ?? '').trim();
    if (!title) continue;
    const appId = row.appId ?? '';
    const kind = isFoobarAppId(appId) ? ('foobar2000' as const) : ('smtc' as const);
    const identity = `${kind}:${slugIdentity([appId, artist, title, row.album ?? ''])}`;
    const playing = isSmtcPlaying(row.status);
    const prev = previous.get(identity);
    const trackChangedAt =
      prev && prev.identity === identity ? prev.trackChangedAt : now;
    const durationMs = row.durationMs && row.durationMs > 0 ? row.durationMs : undefined;
    const positionMs = resolveSmtcPositionMs(
      row.positionMs ?? 0,
      durationMs,
      playing,
      prev,
      now,
    );
    out.push({
      kind,
      identity,
      playing,
      title,
      artist,
      album: row.album || undefined,
      durationMs,
      positionMs,
      playbackRate: 1,
      trackChangedAt,
      sampledAt: now,
      appId,
    });
  }
  return out;
}

export class SmtcWatcher {
  private child: ChildProcessWithoutNullStreams | null = null;
  private buf = '';
  private sessions: PlayerCandidate[] = [];
  private previous = new Map<string, PlayerCandidate>();
  private stopped = false;
  private lastLogKey = '';

  constructor(
    private readonly onChange: (sessions: PlayerCandidate[]) => void,
    private readonly log: (line: string) => void = () => {},
    private readonly scriptPath: string = '',
  ) {}

  start(): void {
    if (process.platform !== 'win32') return;
    if (this.child) return;
    this.stopped = false;
    if (!this.scriptPath || !existsSync(this.scriptPath)) {
      this.log(`smtc helper missing: ${this.scriptPath || '(no path)'}`);
      return;
    }
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    this.child = child;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      this.buf += chunk;
      let nl: number;
      while ((nl = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, nl);
        this.buf = this.buf.slice(nl + 1);
        this.ingestLine(line);
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      const text = chunk.trim();
      if (text) this.log(`smtc stderr: ${text.slice(0, 300)}`);
    });
    child.on('exit', (code) => {
      this.child = null;
      if (!this.stopped) {
        this.log(`smtc helper exited (${code}) — restarting`);
        setTimeout(() => this.start(), 1500);
      }
    });
  }

  stop(): void {
    this.stopped = true;
    this.child?.kill();
    this.child = null;
  }

  getSessions(): PlayerCandidate[] {
    return this.sessions;
  }

  private ingestLine(line: string): void {
    const rows = parseSmtcJsonLine(line);
    const now = Date.now();
    const logKey = rows.map(smtcRowKey).join(';') || '(none)';
    if (logKey !== this.lastLogKey) {
      this.lastLogKey = logKey;
      if (rows.length === 0) {
        this.log('smtc: no sessions — enable foobar2000 Windows now-playing');
      } else {
        for (const row of rows) {
          const app = (row.appId ?? '').slice(0, 80);
          const title = (row.title ?? '').slice(0, 80);
          this.log(`smtc: ${app} "${title}" status=${String(row.status ?? '')}`);
        }
      }
    }
    const next = smtcSessionsToCandidates(rows, now, this.previous);
    this.previous = new Map(next.map((session) => [session.identity, session]));
    this.sessions = next;
    this.onChange(next);
  }
}
