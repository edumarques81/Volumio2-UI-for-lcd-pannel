import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';

import CastSourceBadge from '../CastSourceBadge.svelte';

describe('CastSourceBadge', () => {
  it('renders the CAST label with no device name', () => {
    const { container } = render(CastSourceBadge);
    const badge = container.querySelector('[data-testid="cast-source-badge"]')!;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('CAST');
    expect(badge.getAttribute('aria-label')).toBe('Casting');
  });

  it('names the device when one is given', () => {
    const { container } = render(CastSourceBadge, { props: { device: 'Living Room Display' } });
    const badge = container.querySelector('[data-testid="cast-source-badge"]')!;
    expect(badge.textContent).toContain('Living Room Display');
    expect(badge.getAttribute('aria-label')).toBe('Casting to Living Room Display');
  });
});
