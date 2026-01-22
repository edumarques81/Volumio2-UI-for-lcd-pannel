import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte';

// Toast message interface matching Volumio backend format
interface VolumioToastMessage {
  type: string;
  title?: string;
  message?: string;
  body?: string;
}

// We need to mock the socket service before importing the component
let socketHandlers: Map<string, (data: VolumioToastMessage) => void> = new Map();

vi.mock('$lib/services/socket', () => ({
  socketService: {
    on: vi.fn((event: string, handler: (data: VolumioToastMessage) => void) => {
      socketHandlers.set(event, handler);
      return () => socketHandlers.delete(event);
    }),
    emit: vi.fn()
  }
}));

// Mock the issue actions
vi.mock('$lib/stores/issues', () => ({
  issueActions: {
    upsertIssue: vi.fn(() => true) // Return true to allow toast to show
  }
}));

// Import component after mocks are set up
import Toast from '../Toast.svelte';
import { issueActions } from '$lib/stores/issues';

// Constants for timing - should match Toast.svelte internal values
const INFO_TOAST_DURATION = 4000;
const THROTTLE_MS = 3000;
const DEDUPE_WINDOW_MS = 60000;

/**
 * Helper to safely get socket handler with clear error message
 */
function getSocketHandler(event: string): (data: VolumioToastMessage) => void {
  const handler = socketHandlers.get(event);
  if (!handler) {
    throw new Error(`Expected ${event} handler to be registered`);
  }
  return handler;
}

describe('Toast component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketHandlers.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('should render without toasts initially', () => {
    render(Toast);

    const container = screen.getByRole('status');
    expect(container).toBeInTheDocument();
    expect(container.children.length).toBe(0);
  });

  it('should display toast when pushToastMessage event is received', async () => {
    render(Toast);

    // Simulate receiving a toast message from socket
    const handler = socketHandlers.get('pushToastMessage');
    expect(handler).toBeDefined();

    handler!({
      type: 'info',
      title: 'Test Info',
      message: 'This is a test info message'
    });

    // Wait for the toast to appear
    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByText('Test Info')).toBeInTheDocument();
    });

    expect(screen.getByText('This is a test info message')).toBeInTheDocument();
  });

  it('should display success toast with correct styling', async () => {
    render(Toast);

    const handler = socketHandlers.get('pushToastMessage');
    handler!({
      type: 'success',
      title: 'Success!',
      message: 'Operation completed'
    });

    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveClass('toast--success');
    });
  });

  it('should display error toast with correct styling', async () => {
    render(Toast);

    const handler = socketHandlers.get('pushToastMessage');
    handler!({
      type: 'error',
      title: 'Error!',
      message: 'Something went wrong'
    });

    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveClass('toast--error');
    });
  });

  it('should display warning toast with correct styling', async () => {
    render(Toast);

    const handler = socketHandlers.get('pushToastMessage');
    handler!({
      type: 'warning',
      title: 'Warning',
      message: 'Be careful'
    });

    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveClass('toast--warning');
    });
  });

  it('should map unknown types to info', async () => {
    render(Toast);

    const handler = socketHandlers.get('pushToastMessage');
    handler!({
      type: 'unknown',
      title: 'Unknown Type',
      message: 'Should be info'
    });

    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveClass('toast--info');
    });
  });

  it('should remove toast when dismiss button is clicked', async () => {
    render(Toast);

    const handler = socketHandlers.get('pushToastMessage');
    handler!({
      type: 'info',
      title: 'Dismissable Toast'
    });

    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByText('Dismissable Toast')).toBeInTheDocument();
    });

    // Click the dismiss button
    const dismissButton = screen.getByLabelText('Dismiss');
    await fireEvent.click(dismissButton);

    await waitFor(() => {
      expect(screen.queryByText('Dismissable Toast')).not.toBeInTheDocument();
    });
  });

  it('should auto-remove toast after duration', async () => {
    render(Toast);

    const handler = socketHandlers.get('pushToastMessage');
    handler!({
      type: 'info',
      title: 'Auto Remove Toast'
    });

    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByText('Auto Remove Toast')).toBeInTheDocument();
    });

    // Advance time past the auto-remove duration
    vi.advanceTimersByTime(INFO_TOAST_DURATION + 500);

    await waitFor(() => {
      expect(screen.queryByText('Auto Remove Toast')).not.toBeInTheDocument();
    });
  });

  it('should limit toasts to MAX_TOASTS (3)', async () => {
    render(Toast);

    const handler = socketHandlers.get('pushToastMessage');

    // Add more toasts than MAX_TOASTS with delays to avoid throttling
    handler!({ type: 'success', title: 'Toast 1' });
    vi.advanceTimersByTime(THROTTLE_MS + 500); // Wait past throttle

    handler!({ type: 'success', title: 'Toast 2' });
    vi.advanceTimersByTime(THROTTLE_MS + 500);

    handler!({ type: 'success', title: 'Toast 3' });
    vi.advanceTimersByTime(THROTTLE_MS + 500);

    handler!({ type: 'success', title: 'Toast 4' });
    vi.advanceTimersByTime(0);

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeLessThanOrEqual(3);
    });

    // First toast should be removed when 4th is added
    expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
  });

  it('should create issue for error toasts', async () => {
    render(Toast);

    const handler = socketHandlers.get('pushToastMessage');
    handler!({
      type: 'error',
      title: 'Error Title',
      message: 'Error message'
    });

    vi.advanceTimersByTime(0);

    expect(issueActions.upsertIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'system',
        severity: 'error',
        title: 'Error Title',
        detail: 'Error message',
        source: 'volumio-toast'
      })
    );
  });

  it('should not create issue for success toasts', async () => {
    vi.clearAllMocks();
    render(Toast);

    const handler = socketHandlers.get('pushToastMessage');
    handler!({
      type: 'success',
      title: 'Success Title'
    });

    vi.advanceTimersByTime(0);

    expect(issueActions.upsertIssue).not.toHaveBeenCalled();
  });

  it('should handle missing message gracefully', async () => {
    render(Toast);

    const handler = socketHandlers.get('pushToastMessage');
    handler!({
      type: 'info',
      title: 'No Message Toast'
    });

    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByText('No Message Toast')).toBeInTheDocument();
    });

    // Should only have title, no message element
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });
});

describe('Toast dedupe behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketHandlers.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('should dedupe identical error toasts within 60 seconds', async () => {
    render(Toast);

    const handler = socketHandlers.get('pushToastMessage');

    // First error toast
    handler!({
      type: 'error',
      title: 'Duplicate Error'
    });
    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByText('Duplicate Error')).toBeInTheDocument();
    });

    // Try to add same error again (within dedupe window)
    vi.advanceTimersByTime(10000); // 10 seconds
    handler!({
      type: 'error',
      title: 'Duplicate Error'
    });
    vi.advanceTimersByTime(0);

    // Should still only have one toast
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBe(1);
  });

  it('should allow same toast after dedupe window expires', async () => {
    render(Toast);

    const handler = socketHandlers.get('pushToastMessage');

    // First error toast
    handler!({
      type: 'error',
      title: 'Dedupe Test'
    });
    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByText('Dedupe Test')).toBeInTheDocument();
    });

    // Wait for first toast to auto-remove and dedupe window to expire
    vi.advanceTimersByTime(DEDUPE_WINDOW_MS + 5000); // Past dedupe window

    // Now same toast should be allowed
    handler!({
      type: 'error',
      title: 'Dedupe Test'
    });
    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByText('Dedupe Test')).toBeInTheDocument();
    });
  });

  it('should throttle rapid non-success toasts', async () => {
    render(Toast);

    const handler = socketHandlers.get('pushToastMessage');

    // First warning toast
    handler!({
      type: 'warning',
      title: 'Warning 1'
    });
    vi.advanceTimersByTime(0);

    // Immediately try to add another warning (should be throttled)
    handler!({
      type: 'warning',
      title: 'Warning 2'
    });
    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByText('Warning 1')).toBeInTheDocument();
    });

    // Warning 2 should be throttled
    expect(screen.queryByText('Warning 2')).not.toBeInTheDocument();
  });

  it('should not throttle success toasts', async () => {
    render(Toast);

    const handler = socketHandlers.get('pushToastMessage');

    // First success toast
    handler!({
      type: 'success',
      title: 'Success 1'
    });
    vi.advanceTimersByTime(0);

    // Immediately add another success
    handler!({
      type: 'success',
      title: 'Success 2'
    });
    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByText('Success 1')).toBeInTheDocument();
      expect(screen.getByText('Success 2')).toBeInTheDocument();
    });
  });
});
