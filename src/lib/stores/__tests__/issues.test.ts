import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock the socket service before importing issues store
vi.mock('$lib/services/socket', () => ({
  socketService: {
    on: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn()
  },
  connectionState: {
    subscribe: vi.fn((cb) => {
      cb('connected');
      return () => {};
    })
  }
}));

// Mock the player store
vi.mock('$lib/stores/player', () => ({
  playerState: {
    subscribe: vi.fn((cb) => {
      cb(null);
      return () => {};
    })
  }
}));

import {
  activeIssuesList,
  highestSeverity,
  issueCounts,
  playbackIssues,
  issueActions,
  type Issue,
  type Severity
} from '../issues';

describe('issues store', () => {
  beforeEach(() => {
    // Reset all state including toast tracking before each test
    issueActions.resetAll();
    vi.clearAllMocks();
  });

  describe('issueActions.upsertIssue', () => {
    it('should add a new issue to active issues', () => {
      const issue: Issue = {
        id: 'test:issue1',
        domain: 'system',
        severity: 'error',
        title: 'Test Error',
        detail: 'Test error detail',
        ts: Date.now(),
        persistent: false
      };

      issueActions.upsertIssue(issue);

      const issues = get(activeIssuesList);
      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('test:issue1');
      expect(issues[0].title).toBe('Test Error');
    });

    it('should update existing issue with same id', () => {
      const issue1: Issue = {
        id: 'test:issue1',
        domain: 'system',
        severity: 'warning',
        title: 'Original Title',
        ts: Date.now(),
        persistent: false
      };

      const issue2: Issue = {
        id: 'test:issue1',
        domain: 'system',
        severity: 'error',
        title: 'Updated Title',
        ts: Date.now(),
        persistent: false
      };

      issueActions.upsertIssue(issue1);
      issueActions.upsertIssue(issue2);

      const issues = get(activeIssuesList);
      expect(issues).toHaveLength(1);
      expect(issues[0].title).toBe('Updated Title');
      expect(issues[0].severity).toBe('error');
    });

    it('should not add duplicate issues with same id', () => {
      const issue: Issue = {
        id: 'test:duplicate',
        domain: 'mpd',
        severity: 'error',
        title: 'MPD Error',
        ts: Date.now(),
        persistent: false
      };

      issueActions.upsertIssue(issue);
      issueActions.upsertIssue(issue);
      issueActions.upsertIssue(issue);

      const issues = get(activeIssuesList);
      expect(issues).toHaveLength(1);
    });
  });

  describe('issueActions.resolveIssue', () => {
    it('should remove an issue by id', () => {
      const issue: Issue = {
        id: 'test:toremove',
        domain: 'network',
        severity: 'warning',
        title: 'Network Warning',
        ts: Date.now(),
        persistent: false
      };

      issueActions.upsertIssue(issue);
      expect(get(activeIssuesList)).toHaveLength(1);

      issueActions.resolveIssue('test:toremove');
      expect(get(activeIssuesList)).toHaveLength(0);
    });

    it('should not throw when resolving non-existent issue', () => {
      expect(() => {
        issueActions.resolveIssue('nonexistent:id');
      }).not.toThrow();
    });
  });

  describe('highestSeverity derived store', () => {
    it('should return "ok" when no issues', () => {
      expect(get(highestSeverity)).toBe('ok');
    });

    it('should return "info" when only info issues exist', () => {
      issueActions.upsertIssue({
        id: 'test:info',
        domain: 'system',
        severity: 'info',
        title: 'Info',
        ts: Date.now(),
        persistent: false
      });

      expect(get(highestSeverity)).toBe('info');
    });

    it('should return "warning" when warning is highest', () => {
      issueActions.upsertIssue({
        id: 'test:info',
        domain: 'system',
        severity: 'info',
        title: 'Info',
        ts: Date.now(),
        persistent: false
      });

      issueActions.upsertIssue({
        id: 'test:warning',
        domain: 'system',
        severity: 'warning',
        title: 'Warning',
        ts: Date.now(),
        persistent: false
      });

      expect(get(highestSeverity)).toBe('warning');
    });

    it('should return "error" when error exists', () => {
      issueActions.upsertIssue({
        id: 'test:info',
        domain: 'system',
        severity: 'info',
        title: 'Info',
        ts: Date.now(),
        persistent: false
      });

      issueActions.upsertIssue({
        id: 'test:error',
        domain: 'system',
        severity: 'error',
        title: 'Error',
        ts: Date.now(),
        persistent: false
      });

      expect(get(highestSeverity)).toBe('error');
    });
  });

  describe('issueCounts derived store', () => {
    it('should return zero counts when no issues', () => {
      const counts = get(issueCounts);
      expect(counts).toEqual({
        error: 0,
        warning: 0,
        info: 0,
        total: 0
      });
    });

    it('should count issues by severity', () => {
      issueActions.upsertIssue({
        id: 'test:error1',
        domain: 'system',
        severity: 'error',
        title: 'Error 1',
        ts: Date.now(),
        persistent: false
      });

      issueActions.upsertIssue({
        id: 'test:error2',
        domain: 'mpd',
        severity: 'error',
        title: 'Error 2',
        ts: Date.now(),
        persistent: false
      });

      issueActions.upsertIssue({
        id: 'test:warning1',
        domain: 'network',
        severity: 'warning',
        title: 'Warning 1',
        ts: Date.now(),
        persistent: false
      });

      issueActions.upsertIssue({
        id: 'test:info1',
        domain: 'system',
        severity: 'info',
        title: 'Info 1',
        ts: Date.now(),
        persistent: false
      });

      const counts = get(issueCounts);
      expect(counts.error).toBe(2);
      expect(counts.warning).toBe(1);
      expect(counts.info).toBe(1);
      expect(counts.total).toBe(4);
    });
  });

  describe('playbackIssues derived store', () => {
    it('should filter only playback and mpd domain issues', () => {
      issueActions.upsertIssue({
        id: 'test:system',
        domain: 'system',
        severity: 'error',
        title: 'System Error',
        ts: Date.now(),
        persistent: false
      });

      issueActions.upsertIssue({
        id: 'test:playback',
        domain: 'playback',
        severity: 'warning',
        title: 'Playback Warning',
        ts: Date.now(),
        persistent: false
      });

      issueActions.upsertIssue({
        id: 'test:mpd',
        domain: 'mpd',
        severity: 'error',
        title: 'MPD Error',
        ts: Date.now(),
        persistent: false
      });

      issueActions.upsertIssue({
        id: 'test:network',
        domain: 'network',
        severity: 'warning',
        title: 'Network Warning',
        ts: Date.now(),
        persistent: false
      });

      const playback = get(playbackIssues);
      expect(playback).toHaveLength(2);
      expect(playback.map((i) => i.domain)).toEqual(['mpd', 'playback']);
    });

    it('should return empty array when no playback issues', () => {
      issueActions.upsertIssue({
        id: 'test:network',
        domain: 'network',
        severity: 'error',
        title: 'Network Error',
        ts: Date.now(),
        persistent: false
      });

      expect(get(playbackIssues)).toHaveLength(0);
    });
  });

  describe('activeIssuesList sorting', () => {
    it('should sort issues by severity (errors first)', () => {
      issueActions.upsertIssue({
        id: 'test:info',
        domain: 'system',
        severity: 'info',
        title: 'Info',
        ts: Date.now(),
        persistent: false
      });

      issueActions.upsertIssue({
        id: 'test:error',
        domain: 'system',
        severity: 'error',
        title: 'Error',
        ts: Date.now(),
        persistent: false
      });

      issueActions.upsertIssue({
        id: 'test:warning',
        domain: 'system',
        severity: 'warning',
        title: 'Warning',
        ts: Date.now(),
        persistent: false
      });

      const issues = get(activeIssuesList);
      expect(issues.map((i) => i.severity)).toEqual(['error', 'warning', 'info']);
    });

    it('should sort by timestamp within same severity (newer first)', async () => {
      issueActions.upsertIssue({
        id: 'test:error1',
        domain: 'system',
        severity: 'error',
        title: 'Older Error',
        ts: Date.now() - 1000,
        persistent: false
      });

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));

      issueActions.upsertIssue({
        id: 'test:error2',
        domain: 'system',
        severity: 'error',
        title: 'Newer Error',
        ts: Date.now(),
        persistent: false
      });

      const issues = get(activeIssuesList);
      expect(issues[0].title).toBe('Newer Error');
      expect(issues[1].title).toBe('Older Error');
    });
  });

  describe('toast dedupe behavior', () => {
    it('should return true for first toast of an issue', () => {
      const showToast = issueActions.upsertIssue({
        id: 'test:first_error',
        domain: 'system',
        severity: 'error',
        title: 'First Error',
        ts: Date.now(),
        persistent: false
      });

      expect(showToast).toBe(true);
    });

    it('should return false for info severity (no toast)', () => {
      const showToast = issueActions.upsertIssue({
        id: 'test:info',
        domain: 'system',
        severity: 'info',
        title: 'Info Message',
        ts: Date.now(),
        persistent: false
      });

      expect(showToast).toBe(false);
    });

    it('should return false for duplicate within dedupe window', () => {
      const issue: Issue = {
        id: 'test:dedupe',
        domain: 'system',
        severity: 'error',
        title: 'Dedupe Test',
        ts: Date.now(),
        persistent: false
      };

      const first = issueActions.upsertIssue(issue);
      const second = issueActions.upsertIssue(issue);

      expect(first).toBe(true);
      expect(second).toBe(false);
    });

    it('should throttle rapid toasts', () => {
      const issue1: Issue = {
        id: 'test:throttle1',
        domain: 'system',
        severity: 'error',
        title: 'Throttle 1',
        ts: Date.now(),
        persistent: false
      };

      const issue2: Issue = {
        id: 'test:throttle2',
        domain: 'system',
        severity: 'error',
        title: 'Throttle 2',
        ts: Date.now(),
        persistent: false
      };

      const first = issueActions.upsertIssue(issue1);
      const second = issueActions.upsertIssue(issue2);

      expect(first).toBe(true);
      expect(second).toBe(false); // Throttled
    });
  });

  describe('issueActions.clearAll', () => {
    it('should clear all active issues', () => {
      issueActions.upsertIssue({
        id: 'test:1',
        domain: 'system',
        severity: 'error',
        title: 'Error 1',
        ts: Date.now(),
        persistent: false
      });

      issueActions.upsertIssue({
        id: 'test:2',
        domain: 'network',
        severity: 'warning',
        title: 'Warning 1',
        ts: Date.now(),
        persistent: false
      });

      expect(get(activeIssuesList)).toHaveLength(2);

      issueActions.clearAll();

      expect(get(activeIssuesList)).toHaveLength(0);
      expect(get(highestSeverity)).toBe('ok');
      expect(get(issueCounts).total).toBe(0);
    });
  });

  describe('issueActions.listActive', () => {
    it('should return array of active issues', () => {
      issueActions.upsertIssue({
        id: 'test:active1',
        domain: 'system',
        severity: 'error',
        title: 'Active Error',
        ts: Date.now(),
        persistent: false
      });

      const active = issueActions.listActive();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('test:active1');
    });

    it('should return empty array when no active issues', () => {
      const active = issueActions.listActive();
      expect(active).toHaveLength(0);
    });
  });

  describe('issueActions.listRecent', () => {
    it('should return recent issues up to limit', () => {
      // Add multiple issues
      for (let i = 0; i < 5; i++) {
        issueActions.upsertIssue({
          id: `test:recent${i}`,
          domain: 'system',
          severity: 'info',
          title: `Recent ${i}`,
          ts: Date.now() + i,
          persistent: false
        });
      }

      const recent = issueActions.listRecent(3);
      expect(recent.length).toBeLessThanOrEqual(3);
    });

    it('should return all recent if less than limit', () => {
      issueActions.upsertIssue({
        id: 'test:single',
        domain: 'system',
        severity: 'warning',
        title: 'Single Issue',
        ts: Date.now(),
        persistent: false
      });

      const recent = issueActions.listRecent(10);
      expect(recent.length).toBe(1);
    });
  });
});
