import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn(() => () => {}),
  },
}));

import {
  ingestStatus,
  ingestPreview,
  ingestResult,
  ingestError,
  ingestPhase,
  ingestAvailable,
  ingestHasItems,
  ingestBusy,
  ingestCanCommit,
  ingestActions,
  initIngestStore,
  cleanupIngestStore,
  type IngestReport,
  type IngestStatus,
  type IngestError,
} from '../ingest';
import { socketService } from '$lib/services/socket';

/** Grabs the handler the store registered for a given push event. */
function handlerFor<T>(event: string): (payload: T) => void {
  const call = (socketService.on as ReturnType<typeof vi.fn>).mock.calls.find(
    (c: unknown[]) => c[0] === event
  );
  if (!call) throw new Error(`no handler registered for ${event}`);
  return call[1] as (payload: T) => void;
}

function status(overrides: Partial<IngestStatus> = {}): IngestStatus {
  return { items: [], count: 0, busy: false, available: true, ...overrides };
}

function report(overrides: Partial<IngestReport> = {}): IngestReport {
  return {
    schema: 1,
    dryRun: true,
    error: '',
    exitCode: 0,
    items: [],
    summary: {
      total: 0,
      ingested: 0,
      wouldIngest: 0,
      refused: 0,
      skipped: 0,
      tagFailures: 0,
      audioAltered: 0,
    },
    mpd: {},
    ...overrides,
  };
}

/** A preview that is ready to be confirmed. */
function previewWithPlan(token = 'plan-token'): IngestReport {
  return report({
    token,
    summary: { ...report().summary, total: 1, wouldIngest: 1 },
    items: [
      {
        name: 'Holst The planets, Op. 32',
        status: 'would-ingest',
        reason: '',
        target: '/mnt/ssd/Music/Holst- The Planets, Op. 32',
        audioFiles: 7,
        tagged: [],
        tagFailures: [],
        md5Mismatches: [],
        mbRelease: '',
        art: 'already present',
        notes: [],
      },
    ],
  });
}

describe('ingest store', () => {
  beforeEach(() => {
    cleanupIngestStore();
    ingestStatus.set(null);
    ingestPreview.set(null);
    ingestResult.set(null);
    ingestError.set(null);
    ingestPhase.set('idle');
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupIngestStore();
  });

  describe('initIngestStore', () => {
    it('registers all four push handlers and asks for status once', () => {
      initIngestStore();

      const events = (socketService.on as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0]
      );
      expect(events).toEqual(
        expect.arrayContaining([
          'pushIngestStatus',
          'pushIngestPreview',
          'pushIngestResult',
          'pushIngestError',
        ])
      );
      expect(socketService.emit).toHaveBeenCalledWith('ingest:status');
    });

    it('is idempotent — a second call does not stack handlers', () => {
      initIngestStore();
      const first = (socketService.on as ReturnType<typeof vi.fn>).mock.calls.length;
      initIngestStore();
      expect((socketService.on as ReturnType<typeof vi.fn>).mock.calls.length).toBe(first);
    });
  });

  describe('derived state', () => {
    it.each([
      ['no status yet', null, false],
      ['script missing', status({ available: false }), false],
      ['script present', status({ available: true }), true],
    ])('ingestAvailable: %s', (_name, value, expected) => {
      ingestStatus.set(value);
      expect(get(ingestAvailable)).toBe(expected);
    });

    it.each([
      ['empty inbox', status({ count: 0 }), false],
      ['one album waiting', status({ count: 1, items: ['Holst'] }), true],
    ])('ingestHasItems: %s', (_name, value, expected) => {
      ingestStatus.set(value);
      expect(get(ingestHasItems)).toBe(expected);
    });

    it('ingestBusy reflects another surface running a commit', () => {
      ingestStatus.set(status({ busy: true }));
      expect(get(ingestBusy)).toBe(true);
    });

    it('ingestBusy reflects this client waiting on its own preview', () => {
      ingestStatus.set(status({ busy: false }));
      ingestPhase.set('previewing');
      expect(get(ingestBusy)).toBe(true);
    });

    it('ingestCanCommit requires a token', () => {
      ingestPreview.set(report({ summary: { ...report().summary, wouldIngest: 1 } }));
      expect(get(ingestCanCommit)).toBe(false);
    });

    it('ingestCanCommit is false when the plan would ingest nothing', () => {
      ingestPreview.set(report({ token: 'abc' }));
      expect(get(ingestCanCommit)).toBe(false);
    });

    it('ingestCanCommit is true for a real plan at rest', () => {
      ingestPreview.set(previewWithPlan());
      expect(get(ingestCanCommit)).toBe(true);
    });

    it('ingestCanCommit is false while a run is in flight', () => {
      ingestPreview.set(previewWithPlan());
      ingestPhase.set('committing');
      expect(get(ingestCanCommit)).toBe(false);
    });
  });

  describe('actions', () => {
    it('preview emits and clears any stale plan, result and error', () => {
      ingestPreview.set(previewWithPlan('old'));
      ingestResult.set(report({ dryRun: false }));
      ingestError.set({ phase: 'commit', error: 'boom', retryable: false });

      ingestActions.preview();

      expect(socketService.emit).toHaveBeenCalledWith('ingest:preview');
      expect(get(ingestPreview)).toBeNull();
      expect(get(ingestResult)).toBeNull();
      expect(get(ingestError)).toBeNull();
      expect(get(ingestPhase)).toBe('previewing');
    });

    it('preview is a no-op while a run is already in flight', () => {
      ingestPhase.set('committing');
      ingestActions.preview();
      expect(socketService.emit).not.toHaveBeenCalledWith('ingest:preview');
    });

    it('commit sends the token the preview issued', () => {
      ingestPreview.set(previewWithPlan('the-token'));
      ingestActions.commit();
      expect(socketService.emit).toHaveBeenCalledWith('ingest:commit', {
        token: 'the-token',
      });
      expect(get(ingestPhase)).toBe('committing');
    });

    it('commit without a plan never reaches the backend', () => {
      ingestPreview.set(null);
      ingestActions.commit();
      expect(socketService.emit).not.toHaveBeenCalled();
      expect(get(ingestPhase)).toBe('idle');
    });

    it('cancel drops the plan without emitting anything', () => {
      ingestPreview.set(previewWithPlan());
      ingestActions.cancel();
      expect(get(ingestPreview)).toBeNull();
      expect(socketService.emit).not.toHaveBeenCalled();
    });
  });

  describe('broadcast handling', () => {
    beforeEach(() => {
      initIngestStore();
    });

    it('stores the pushed status', () => {
      handlerFor<IngestStatus>('pushIngestStatus')(
        status({ count: 1, items: ['Holst'] })
      );
      expect(get(ingestStatus)?.count).toBe(1);
    });

    it('shows a plan broadcast by another surface and settles the phase', () => {
      ingestPhase.set('previewing');
      handlerFor<IngestReport>('pushIngestPreview')(previewWithPlan());
      expect(get(ingestPreview)?.token).toBe('plan-token');
      expect(get(ingestPhase)).toBe('idle');
    });

    it('a result clears the spent plan so Confirm cannot be pressed twice', () => {
      ingestPreview.set(previewWithPlan());
      ingestPhase.set('committing');

      handlerFor<IngestReport>('pushIngestResult')(
        report({ dryRun: false, summary: { ...report().summary, ingested: 1 } })
      );

      expect(get(ingestResult)?.summary.ingested).toBe(1);
      expect(get(ingestPreview)).toBeNull();
      expect(get(ingestPhase)).toBe('idle');
      expect(get(ingestCanCommit)).toBe(false);
    });

    it('a retryable error clears the dead plan', () => {
      ingestPreview.set(previewWithPlan());
      handlerFor<IngestError>('pushIngestError')({
        phase: 'commit',
        error: 'ingest: the inbox changed since the preview; preview again',
        retryable: true,
      });
      expect(get(ingestPreview)).toBeNull();
      expect(get(ingestError)?.retryable).toBe(true);
      expect(get(ingestPhase)).toBe('idle');
    });

    it('a non-retryable error keeps the plan on screen', () => {
      ingestPreview.set(previewWithPlan());
      handlerFor<IngestError>('pushIngestError')({
        phase: 'commit',
        error: 'unauthorized',
        retryable: false,
      });
      expect(get(ingestPreview)?.token).toBe('plan-token');
      expect(get(ingestError)?.error).toBe('unauthorized');
    });
  });
});
