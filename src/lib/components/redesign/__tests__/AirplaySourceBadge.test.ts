import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AirplaySourceBadge from '../AirplaySourceBadge.svelte';

describe('AirplaySourceBadge', () => {
  it('renders the AIRPLAY label and the sender name', () => {
    const { container } = render(AirplaySourceBadge, { sender: "Eduardo's iPhone" });
    expect(container.textContent).toContain('AIRPLAY');
    expect(container.textContent).toContain("Eduardo's iPhone");
  });

  it('renders just the AIRPLAY label when sender is empty', () => {
    const { container } = render(AirplaySourceBadge, { sender: '' });
    expect(container.textContent).toContain('AIRPLAY');
    // No middle-dot separator should leak through when sender is missing.
    expect(container.textContent).not.toContain('·');
  });

  it('shows the middle-dot separator between AIRPLAY and sender when both present', () => {
    const { container } = render(AirplaySourceBadge, { sender: 'Living Room' });
    expect(container.textContent).toContain('·');
  });

  it('exposes a data-testid for E2E selection', () => {
    const { container } = render(AirplaySourceBadge, { sender: 'iPhone' });
    expect(container.querySelector('[data-testid="airplay-source-badge"]')).toBeTruthy();
  });

  it('uses a button-or-span (non-interactive) role since this is informational', () => {
    const { container } = render(AirplaySourceBadge, { sender: 'iPhone' });
    const badge = container.querySelector('[data-testid="airplay-source-badge"]');
    // Must not be a <button> — this is a label, not an action.
    expect(badge?.tagName.toLowerCase()).not.toBe('button');
  });
});
