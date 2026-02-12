import { writable, derived, get } from 'svelte/store';
import { socketService, connectionState } from '$lib/services/socket';
import { playerState } from '$lib/stores/player';

/**
 * Issue severity levels
 */
export type Severity = 'info' | 'warning' | 'error';

/**
 * Issue domains - categorizes where the issue originates
 */
export type Domain = 'mpd' | 'network' | 'mount' | 'playback' | 'plugin' | 'system' | 'connection';

/**
 * Issue action - button that can be shown in the drawer
 */
export interface IssueAction {
  label: string;
  actionId: string;
}

/**
 * Issue shape - normalized issue object
 */
export interface Issue {
  id: string; // Stable ID for dedupe, e.g., "mpd:connection_failed"
  domain: Domain;
  severity: Severity;
  title: string;
  detail?: string;
  ts: number; // Timestamp when issue was created/updated
  persistent: boolean; // If true, won't auto-resolve
  source?: string; // e.g., "volumio-backend", "frontend-detection"
  actions?: IssueAction[];
}

/**
 * Toast tracking for dedupe
 */
interface ToastRecord {
  issueId: string;
  ts: number;
}

// Configuration
const TOAST_DEDUPE_WINDOW_MS = 60000; // 60 seconds
const TOAST_THROTTLE_MS = 5000; // 5 seconds between toasts
const RECENT_HISTORY_LIMIT = 20;
const RECENT_HISTORY_MAX_AGE_MS = 3600000; // 1 hour

// Stores
const activeIssues = writable<Map<string, Issue>>(new Map());
const recentHistory = writable<Issue[]>([]);
const toastRecords = writable<ToastRecord[]>([]);
const lastToastTime = writable<number>(0);

/**
 * Derived: List of active issues sorted by severity then timestamp
 */
export const activeIssuesList = derived(activeIssues, ($issues) => {
  const list = Array.from($issues.values());
  const severityOrder: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  return list.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.ts - a.ts; // Newer first within same severity
  });
});

/**
 * Derived: Highest severity among active issues
 */
export const highestSeverity = derived(activeIssues, ($issues): Severity | 'ok' => {
  let highest: Severity | 'ok' = 'ok';
  for (const issue of $issues.values()) {
    if (issue.severity === 'error') return 'error';
    if (issue.severity === 'warning') highest = 'warning';
    if (issue.severity === 'info' && highest === 'ok') highest = 'info';
  }
  return highest;
});

/**
 * Derived: Counts by severity
 */
export const issueCounts = derived(activeIssues, ($issues) => {
  const counts = { error: 0, warning: 0, info: 0, total: 0 };
  for (const issue of $issues.values()) {
    counts[issue.severity]++;
    counts.total++;
  }
  return counts;
});

/**
 * Derived: Playback-related issues only (for Now Playing banner)
 */
export const playbackIssues = derived(activeIssuesList, ($issues) => {
  return $issues.filter(
    (issue) => issue.domain === 'playback' || issue.domain === 'mpd'
  );
});

/**
 * Check if we should show a toast for this issue
 */
function shouldToast(issue: Issue): boolean {
  // Only toast for errors or promoted warnings
  if (issue.severity === 'info') return false;

  const now = Date.now();
  const records = get(toastRecords);
  const lastTime = get(lastToastTime);

  // Check throttle
  if (now - lastTime < TOAST_THROTTLE_MS) return false;

  // Check dedupe
  const recentToast = records.find(
    (r) => r.issueId === issue.id && now - r.ts < TOAST_DEDUPE_WINDOW_MS
  );
  if (recentToast) return false;

  return true;
}

/**
 * Record that we showed a toast
 */
function recordToast(issueId: string) {
  const now = Date.now();
  lastToastTime.set(now);
  toastRecords.update((records) => {
    // Add new record and clean old ones
    const cleaned = records.filter((r) => now - r.ts < TOAST_DEDUPE_WINDOW_MS);
    return [...cleaned, { issueId, ts: now }];
  });
}

/**
 * Issue store actions
 */
export const issueActions = {
  /**
   * Add or update an issue
   */
  upsertIssue(issue: Issue): boolean {
    const showToast = shouldToast(issue);

    activeIssues.update((map) => {
      const existing = map.get(issue.id);
      // Update timestamp if issue already exists
      const updated = { ...issue, ts: Date.now() };
      map.set(issue.id, updated);
      return new Map(map);
    });

    // Add to history
    recentHistory.update((history) => {
      const updated = [issue, ...history.filter((h) => h.id !== issue.id)];
      return updated.slice(0, RECENT_HISTORY_LIMIT);
    });

    if (showToast) {
      recordToast(issue.id);
    }

    return showToast;
  },

  /**
   * Resolve/remove an issue
   */
  resolveIssue(id: string) {
    activeIssues.update((map) => {
      map.delete(id);
      return new Map(map);
    });
  },

  /**
   * Get list of active issues
   */
  listActive(): Issue[] {
    return get(activeIssuesList);
  },

  /**
   * Get recent history
   */
  listRecent(limit = 10): Issue[] {
    const history = get(recentHistory);
    const now = Date.now();
    return history
      .filter((h) => now - h.ts < RECENT_HISTORY_MAX_AGE_MS)
      .slice(0, limit);
  },

  /**
   * Clear all issues (useful for testing)
   */
  clearAll() {
    activeIssues.set(new Map());
  },

  /**
   * Reset all state including toast tracking (for testing)
   */
  resetAll() {
    activeIssues.set(new Map());
    recentHistory.set([]);
    toastRecords.set([]);
    lastToastTime.set(0);
  },

  /**
   * Execute an action (placeholder - would call backend)
   */
  executeAction(actionId: string) {
    console.log(`Executing action: ${actionId}`);
    switch (actionId) {
      case 'restart-mpd':
        socketService.emit('callMethod', {
          endpoint: 'music_service/mpd',
          method: 'restartMpd',
        });
        break;
      case 'retry-connection':
        socketService.connect();
        break;
      case 'open-settings':
        // Navigation would be handled by caller
        break;
      default:
        console.warn(`Unknown action: ${actionId}`);
    }
  },
};

/**
 * Initialize issue detection from various sources
 */
let initialized = false;

export function initIssueStore() {
  if (initialized) return;
  initialized = true;

  console.log('Initializing issue store...');

  // Monitor connection state
  connectionState.subscribe((state) => {
    if (state === 'disconnected') {
      issueActions.upsertIssue({
        id: 'connection:disconnected',
        domain: 'connection',
        severity: 'error',
        title: 'Connection Lost',
        detail: 'Lost connection to Volumio backend',
        ts: Date.now(),
        persistent: true,
        source: 'frontend-detection',
        actions: [{ label: 'Retry', actionId: 'retry-connection' }],
      });
    } else if (state === 'connected') {
      issueActions.resolveIssue('connection:disconnected');
    }
  });

  // Monitor player state for issues
  playerState.subscribe((state) => {
    if (!state) return;

    // Check for playback errors
    if (state.status === 'stop' && state.service === 'mpd') {
      // Check if MPD reported an error (this would come from backend)
      // For now, we just monitor state changes
    }

    // Check for stream errors (usually indicated by specific states)
    if (!state.stream && state.status === 'play') {
      issueActions.upsertIssue({
        id: 'playback:stream_error',
        domain: 'playback',
        severity: 'warning',
        title: 'Stream Issue',
        detail: 'Stream may have stopped unexpectedly',
        ts: Date.now(),
        persistent: false,
        source: 'frontend-detection',
      });
    } else {
      issueActions.resolveIssue('playback:stream_error');
    }
  });

  // Listen for backend error events
  socketService.on('pushError', (data: any) => {
    console.log('Received pushError:', data);
    issueActions.upsertIssue({
      id: `system:${data.code || 'unknown'}`,
      domain: 'system',
      severity: 'error',
      title: data.title || 'System Error',
      detail: data.message || data.error,
      ts: Date.now(),
      persistent: true,
      source: 'volumio-backend',
    });
  });

  // Listen for MPD-specific errors
  socketService.on('pushMpdError', (data: any) => {
    console.log('Received pushMpdError:', data);
    issueActions.upsertIssue({
      id: `mpd:${data.code || 'error'}`,
      domain: 'mpd',
      severity: 'error',
      title: 'MPD Error',
      detail: data.message || 'Music player daemon error',
      ts: Date.now(),
      persistent: false,
      source: 'volumio-backend',
      actions: [{ label: 'Restart MPD', actionId: 'restart-mpd' }],
    });
  });

  // Listen for mount errors (NAS/USB issues)
  socketService.on('pushMountError', (data: any) => {
    console.log('Received pushMountError:', data);
    issueActions.upsertIssue({
      id: `mount:${data.path || 'unknown'}`,
      domain: 'mount',
      severity: 'warning',
      title: 'Mount Error',
      detail: data.message || `Failed to mount: ${data.path}`,
      ts: Date.now(),
      persistent: true,
      source: 'volumio-backend',
    });
  });

  // Listen for network issues
  socketService.on('pushNetworkError', (data: any) => {
    console.log('Received pushNetworkError:', data);
    issueActions.upsertIssue({
      id: `network:${data.code || 'error'}`,
      domain: 'network',
      severity: 'warning',
      title: 'Network Issue',
      detail: data.message || 'Network connectivity problem',
      ts: Date.now(),
      persistent: true,
      source: 'volumio-backend',
    });
  });

  // Also check toast messages for errors
  socketService.on('pushToastMessage', (data: any) => {
    if (data?.type === 'error') {
      // Create an issue from the toast
      const id = `toast:${data.title?.replace(/\s+/g, '_').toLowerCase() || Date.now()}`;
      issueActions.upsertIssue({
        id,
        domain: 'system',
        severity: 'error',
        title: data.title || 'Error',
        detail: data.message || data.body,
        ts: Date.now(),
        persistent: false,
        source: 'volumio-toast',
      });

      // Auto-resolve after 30 seconds for toast-originated issues
      setTimeout(() => issueActions.resolveIssue(id), 30000);
    }
  });
}

// Export stores for direct subscription
export { activeIssues, recentHistory };
