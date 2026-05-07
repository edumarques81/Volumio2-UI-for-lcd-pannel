import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Icon from '../Icon.svelte';

describe('Icon', () => {
  describe('fill mode (default)', () => {
    it('renders a fill-style path for material-style icons (e.g. play)', () => {
      const { container } = render(Icon, { name: 'play', size: 24 });
      const svg = container.querySelector('svg');
      const path = container.querySelector('path');
      expect(svg).toBeTruthy();
      // Outer SVG fill is currentColor (the existing behaviour for fill icons)
      expect(svg?.getAttribute('fill')).toBe('currentColor');
      // Path has data but no stroke attributes
      expect(path?.getAttribute('d')).toBeTruthy();
      expect(path?.getAttribute('stroke')).toBeNull();
    });

    it('renders a fill-style path for play-fill (transport)', () => {
      const { container } = render(Icon, { name: 'play-fill', size: 64 });
      const svg = container.querySelector('svg');
      const path = container.querySelector('path');
      expect(svg?.getAttribute('fill')).toBe('currentColor');
      expect(path?.getAttribute('stroke')).toBeNull();
    });

    it('respects gradient prop on fill-mode icons', () => {
      const { container } = render(Icon, {
        name: 'heart',
        size: 24,
        gradient: { from: '#fff', to: '#000' }
      });
      const svg = container.querySelector('svg');
      const linearGradient = container.querySelector('linearGradient');
      // SVG fill is the gradient URL
      expect(svg?.getAttribute('fill')).toMatch(/^url\(#grad-/);
      expect(linearGradient).toBeTruthy();
    });
  });

  describe('stroke mode (Lucide-style outline icons)', () => {
    const strokeIcons = ['music-2', 'audio-lines', 'refresh-cw', 'user', 'vinyl-record'];

    strokeIcons.forEach((name) => {
      it(`renders ${name} as a stroke-only icon (no fill)`, () => {
        const { container } = render(Icon, { name, size: 40 });
        const svg = container.querySelector('svg');
        const path = container.querySelector('path');
        expect(svg).toBeTruthy();
        // Stroke mode: outer SVG fill is "none", path uses stroke="currentColor"
        expect(svg?.getAttribute('fill')).toBe('none');
        expect(path?.getAttribute('stroke')).toBe('currentColor');
        expect(path?.getAttribute('fill')).toBe('none');
        expect(path?.getAttribute('stroke-width')).toBe('2');
        expect(path?.getAttribute('stroke-linecap')).toBe('round');
        expect(path?.getAttribute('stroke-linejoin')).toBe('round');
      });
    });

    it('renders the correct refresh-cw path data', () => {
      const { container } = render(Icon, { name: 'refresh-cw', size: 40 });
      const path = container.querySelector('path');
      // Confirm we still draw the Lucide refresh-cw path (not a filled blob)
      expect(path?.getAttribute('d')).toContain('M21 12a9 9 0');
    });
  });

  describe('size + viewBox', () => {
    it('honours the size prop on width and height', () => {
      const { container } = render(Icon, { name: 'play', size: 96 });
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('width')).toBe('96');
      expect(svg?.getAttribute('height')).toBe('96');
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    });
  });
});
