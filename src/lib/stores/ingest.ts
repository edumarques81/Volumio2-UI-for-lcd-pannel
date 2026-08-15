import { writable, derived, get } from 'svelte/store';
import { socketService } from '$lib/services/socket';

/**
 * Drop-box ingest store.
 *
 * Mirrors the backend's `ingest:*` contract (docs/SOCKET-CONTRACT.md). The flow
 * is deliberately two-step: `preview()` runs the script with --dry-run and the
 * backend answers with a plan plus a token; `commit()` hands that token back.
 * Committing without a token is refused by the backend, so the UI cannot skip
 * the confirmation step even by accident.
 *
 * Preview and result arrive as BROADCASTS, not replies. A commit started on the
 * phone lands here too, which is the point — the LCD must not keep showing a
 * plan for files that another surface already ingested. Errors are the
 * exception: they are sent only to the client that caused them.
 */

/** One inbox entry's outcome. Mirrors ingest.Item on the backend. */
export interface IngestItem {
  name: string;
  /** ingested | would-ingest | refused | skipped */
  status: string;
  reason: string;
  target: string;
  audioFiles: number;
  tagged: string[];
  tagFailures: string[];
  md5Mismatches: string[];
  mbRelease: string;
  art: string;
  notes: string[];
}

/** Per-run tally. Mirrors ingest.Summary. */
export interface IngestSummary {
  total: number;
  ingested: number;
  wouldIngest: number;
  refused: number;
  skipped: number;
  tagFailures: number;
  audioAltered: number;
}

/** A whole dry-run or commit document. Mirrors ingest.Report. */
export interface IngestReport {
  schema: number;
  dryRun: boolean;
  error: string;
  exitCode: number;
  items: IngestItem[];
  summary: IngestSummary;
  mpd: Record<string, number>;
  /** Only present on a preview; must be handed back to commit. */
  token?: string;
}

/** Cheap "is there anything waiting?" answer. Mirrors ingest.Status. */
export interface IngestStatus {
  items: string[];
  count: number;
  busy: boolean;
  /** False when the script or the inbox is missing (e.g. on the Mac). */
  available: boolean;
  error?: string;
}

/** Payload of pushIngestError. */
export interface IngestError {
  /** status | preview | commit */
  phase: string;
  error: string;
  /** True when previewing again can clear it (stale plan, busy). */
  retryable: boolean;
}

/**
 * What the UI is waiting for. Driven by the local tap, not by broadcasts: a
 * commit another surface started should not make this screen show a spinner
 * over its own Confirm button.
 */
export type IngestPhase = 'idle' | 'previewing' | 'committing';

export const ingestStatus = writable<IngestStatus | null>(null);
export const ingestPreview = writable<IngestReport | null>(null);
export const ingestResult = writable<IngestReport | null>(null);
export const ingestError = writable<IngestError | null>(null);
export const ingestPhase = writable<IngestPhase>('idle');

/** False on platforms with no ingest script — the button should stay hidden. */
export const ingestAvailable = derived(
  ingestStatus,
  ($status) => $status?.available === true
);

/** Something is waiting in the inbox. */
export const ingestHasItems = derived(
  ingestStatus,
  ($status) => ($status?.count ?? 0) > 0
);

/** A run is in flight — this client's or another's. */
export const ingestBusy = derived(
  [ingestStatus, ingestPhase],
  ([$status, $phase]) => $status?.busy === true || $phase !== 'idle'
);

/** A plan is on screen and can be confirmed. */
export const ingestCanCommit = derived(
  [ingestPreview, ingestPhase],
  ([$preview, $phase]) =>
    $phase === 'idle' && !!$preview?.token && ($preview?.summary.wouldIngest ?? 0) > 0
);

export const ingestActions = {
  /** Ask what is sitting in the inbox. Cheap: no script run. */
  requestStatus(): void {
    socketService.emit('ingest:status');
  },

  /**
   * Run the dry run. The plan comes back as a broadcast, so every surface sees
   * the same thing before anyone confirms.
   */
  preview(): void {
    if (get(ingestPhase) !== 'idle') return;
    ingestError.set(null);
    ingestResult.set(null);
    ingestPreview.set(null);
    ingestPhase.set('previewing');
    socketService.emit('ingest:preview');
  },

  /**
   * Confirm the plan currently on screen. Sends the token the preview issued;
   * without it the backend refuses, which is what stops a stale plan from
   * executing against a changed inbox.
   */
  commit(): void {
    const token = get(ingestPreview)?.token;
    if (!token || get(ingestPhase) !== 'idle') return;
    ingestError.set(null);
    ingestPhase.set('committing');
    socketService.emit('ingest:commit', { token });
  },

  /** Drop the plan without running it. */
  cancel(): void {
    ingestPreview.set(null);
    ingestError.set(null);
  },

  /** Dismiss the result/error banner. */
  dismiss(): void {
    ingestResult.set(null);
    ingestError.set(null);
  },
};

let initialized = false;

/**
 * Registers the ingest listeners. Idempotent — App.svelte calls it once, but a
 * remount must not stack handlers.
 */
export function initIngestStore(): void {
  if (initialized) return;
  initialized = true;

  socketService.on<IngestStatus>('pushIngestStatus', (status) => {
    ingestStatus.set(status);
  });

  socketService.on<IngestReport>('pushIngestPreview', (report) => {
    ingestPreview.set(report);
    ingestPhase.set('idle');
  });

  socketService.on<IngestReport>('pushIngestResult', (report) => {
    ingestResult.set(report);
    // The plan has been spent; its token will never be accepted again.
    ingestPreview.set(null);
    ingestPhase.set('idle');
  });

  socketService.on<IngestError>('pushIngestError', (err) => {
    ingestError.set(err);
    ingestPhase.set('idle');
    // A stale plan is the one error whose remedy is previewing again, so clear
    // the dead plan rather than leaving a Confirm button that cannot work.
    if (err.retryable) {
      ingestPreview.set(null);
    }
  });

  // Ask once on init so the button knows whether to show at all.
  ingestActions.requestStatus();
}

export function cleanupIngestStore(): void {
  initialized = false;
}
