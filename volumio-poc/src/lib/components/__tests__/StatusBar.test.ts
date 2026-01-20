import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import { writable, get } from 'svelte/store';

// Use vi.hoisted to ensure stores are available before mocks are hoisted
const { stores, mockLcdToggle } = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  return {
    stores: {
      connectionState: writable('connected'),
      currentTrack: writable({
        title: 'Test Track',
        artist: 'Test Artist',
        album: 'Test Album'
      }),
      isPlaying: writable(false),
      highestSeverity: writable('ok'),
      issueCounts: writable({ error: 0, warning: 0, info: 0, total: 0 }),
      playbackIssues: writable([]),
      statusDrawerOpen: writable(false),
      lcdState: writable('on'),
      lcdLoading: writable(false)
    },
    mockLcdToggle: vi.fn(() => Promise.resolve(true))
  };
});

// Mock dependencies
vi.mock('$lib/services/socket', () => ({
  connectionState: stores.connectionState
}));

vi.mock('$lib/stores/player', () => ({
  currentTrack: stores.currentTrack,
  isPlaying: stores.isPlaying
}));

vi.mock('$lib/stores/issues', () => ({
  highestSeverity: stores.highestSeverity,
  issueCounts: stores.issueCounts,
  playbackIssues: stores.playbackIssues
}));

vi.mock('$lib/stores/ui', () => ({
  statusDrawerOpen: stores.statusDrawerOpen
}));

vi.mock('$lib/stores/lcd', () => ({
  lcdState: stores.lcdState,
  lcdLoading: stores.lcdLoading,
  lcdActions: {
    toggle: mockLcdToggle
  },
  initLcdStore: vi.fn(),
  cleanupLcdStore: vi.fn()
}));

import StatusBar from '../StatusBar.svelte';

describe('StatusBar component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset stores to default values
    stores.connectionState.set('connected');
    stores.currentTrack.set({ title: 'Test Track', artist: 'Test Artist', album: 'Test Album' });
    stores.isPlaying.set(false);
    stores.highestSeverity.set('ok');
    stores.issueCounts.set({ error: 0, warning: 0, info: 0, total: 0 });
    stores.playbackIssues.set([]);
    stores.statusDrawerOpen.set(false);
    stores.lcdState.set('on');
    stores.lcdLoading.set(false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('basic rendering', () => {
    it('should render the status bar', () => {
      render(StatusBar);

      expect(screen.getByRole('button', { name: /open status drawer/i })).toBeInTheDocument();
    });

    it('should display current time', () => {
      vi.setSystemTime(new Date('2024-01-15T14:30:00'));
      render(StatusBar);

      // Time updates on mount
      vi.advanceTimersByTime(1000);

      // Should show formatted time (format: Mon 15 Jan 2:30 pm)
      expect(screen.getByText(/mon 15 jan/i)).toBeInTheDocument();
    });
  });

  describe('ON AIR badge', () => {
    it('should show ON AIR when track is playing', () => {
      stores.currentTrack.set({ title: 'Playing Song', artist: 'Artist', album: 'Album' });
      render(StatusBar);

      expect(screen.getByText('ON AIR')).toBeInTheDocument();
    });

    it('should show STATUS when no track', () => {
      stores.currentTrack.set({ title: '', artist: '', album: '' });
      render(StatusBar);

      expect(screen.getByText('STATUS')).toBeInTheDocument();
    });

    it('should show STATUS when track title is "No track"', () => {
      stores.currentTrack.set({ title: 'No track', artist: '', album: '' });
      render(StatusBar);

      expect(screen.getByText('STATUS')).toBeInTheDocument();
    });
  });

  describe('status dot color', () => {
    it('should show green dot when severity is ok', () => {
      stores.highestSeverity.set('ok');
      render(StatusBar);

      const dot = document.querySelector('.status-dot');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveStyle({ backgroundColor: '#34c759' });
    });

    it('should show blue dot when severity is info', () => {
      stores.highestSeverity.set('info');
      render(StatusBar);

      const dot = document.querySelector('.status-dot');
      expect(dot).toHaveStyle({ backgroundColor: '#007aff' });
    });

    it('should show yellow dot when severity is warning', () => {
      stores.highestSeverity.set('warning');
      render(StatusBar);

      const dot = document.querySelector('.status-dot');
      expect(dot).toHaveStyle({ backgroundColor: '#ffcc00' });
    });

    it('should show red dot when severity is error', () => {
      stores.highestSeverity.set('error');
      render(StatusBar);

      const dot = document.querySelector('.status-dot');
      expect(dot).toHaveStyle({ backgroundColor: '#ff3b30' });
    });
  });

  describe('issue count badge', () => {
    it('should not show badge when no issues', () => {
      stores.issueCounts.set({ error: 0, warning: 0, info: 0, total: 0 });
      render(StatusBar);

      expect(document.querySelector('.issue-count')).not.toBeInTheDocument();
    });

    it('should show issue count when there are issues', () => {
      stores.issueCounts.set({ error: 2, warning: 1, info: 0, total: 3 });
      render(StatusBar);

      const badge = document.querySelector('.issue-count');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('3');
    });

    it('should apply error class when highest severity is error', () => {
      stores.highestSeverity.set('error');
      stores.issueCounts.set({ error: 1, warning: 0, info: 0, total: 1 });
      render(StatusBar);

      const badge = document.querySelector('.issue-count');
      expect(badge).toHaveClass('error');
    });

    it('should apply warning class when highest severity is warning', () => {
      stores.highestSeverity.set('warning');
      stores.issueCounts.set({ error: 0, warning: 1, info: 0, total: 1 });
      render(StatusBar);

      const badge = document.querySelector('.issue-count');
      expect(badge).toHaveClass('warning');
    });
  });

  describe('playback issue banner', () => {
    it('should not show banner when no playback issues', () => {
      stores.playbackIssues.set([]);
      render(StatusBar);

      expect(document.querySelector('.playback-issue-banner')).not.toBeInTheDocument();
    });

    it('should show banner with first playback issue title', () => {
      stores.playbackIssues.set([
        { id: 'test:1', title: 'Stream Error', severity: 'error', domain: 'playback' }
      ]);
      render(StatusBar);

      const banner = document.querySelector('.playback-issue-banner');
      expect(banner).toBeInTheDocument();
      expect(screen.getByText('Stream Error')).toBeInTheDocument();
    });

    it('should apply correct severity class to banner', () => {
      stores.playbackIssues.set([
        { id: 'test:1', title: 'Warning Issue', severity: 'warning', domain: 'playback' }
      ]);
      render(StatusBar);

      const banner = document.querySelector('.playback-issue-banner');
      expect(banner).toHaveClass('warning');
    });
  });

  describe('connection indicator', () => {
    it('should show connected state', () => {
      stores.connectionState.set('connected');
      render(StatusBar);

      const indicator = document.querySelector('.indicator');
      expect(indicator).toHaveClass('connected');
    });

    it('should not show connected class when disconnected', () => {
      stores.connectionState.set('disconnected');
      render(StatusBar);

      const indicator = document.querySelector('.indicator');
      expect(indicator).not.toHaveClass('connected');
    });
  });

  describe('LCD toggle button', () => {
    it('should show "LCD Off" when LCD is on', () => {
      stores.lcdState.set('on');
      render(StatusBar);

      expect(screen.getByText('LCD Off')).toBeInTheDocument();
    });

    it('should show "LCD On" when LCD is off', () => {
      stores.lcdState.set('off');
      render(StatusBar);

      expect(screen.getByText('LCD On')).toBeInTheDocument();
    });

    it('should apply lcd-on class when LCD is off (green style)', () => {
      stores.lcdState.set('off');
      render(StatusBar);

      const button = document.querySelector('.lcd-toggle-btn');
      expect(button).toHaveClass('lcd-on');
    });

    it('should call lcdActions.toggle when clicked', async () => {
      render(StatusBar);

      const button = screen.getByText('LCD Off').closest('button')!;
      await fireEvent.click(button);

      expect(mockLcdToggle).toHaveBeenCalled();
    });

    it('should disable button while loading', () => {
      stores.lcdLoading.set(true);
      render(StatusBar);

      const button = document.querySelector('.lcd-toggle-btn');
      expect(button).toBeDisabled();
    });

    it('should show spinner when loading', () => {
      stores.lcdLoading.set(true);
      render(StatusBar);

      expect(document.querySelector('.spinner-small')).toBeInTheDocument();
    });
  });

  describe('status drawer interaction', () => {
    it('should open status drawer when status badge is clicked', async () => {
      render(StatusBar);

      const badge = screen.getByRole('button', { name: /open status drawer/i });
      await fireEvent.click(badge);

      // Check that the store was updated
      expect(get(stores.statusDrawerOpen)).toBe(true);
    });

    it('should open status drawer when playback issue banner is clicked', async () => {
      stores.playbackIssues.set([
        { id: 'test:1', title: 'Test Issue', severity: 'error', domain: 'playback' }
      ]);
      render(StatusBar);

      const banner = screen.getByRole('button', { name: /view issue details/i });
      await fireEvent.click(banner);

      expect(get(stores.statusDrawerOpen)).toBe(true);
    });
  });
});
