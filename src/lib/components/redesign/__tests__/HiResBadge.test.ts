import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import HiResBadge from '../HiResBadge.svelte';

describe('HiResBadge', () => {
  it('renders gold-filled rectangle with rate text', () => {
    const { container } = render(HiResBadge, { rate: '96kHz' });
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(container.textContent).toContain('HI-RES');
    expect(container.textContent).toContain('96kHz');
  });

  it('shows DSD label when rate starts with DSD', () => {
    const { container } = render(HiResBadge, { rate: 'DSD64', label: 'DSD' });
    expect(container.textContent).toContain('DSD');
    expect(container.textContent).toContain('DSD64');
  });

  it('shows MQA label when label prop is MQA', () => {
    const { container } = render(HiResBadge, { rate: '24/96', label: 'MQA' });
    expect(container.textContent).toContain('MQA');
  });

  it('uses currentColor fill on the rectangle (themed via --color-accent)', () => {
    const { container } = render(HiResBadge, { rate: '192kHz' });
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('fill')).toBe('currentColor');
  });
});
