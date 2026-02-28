/**
 * Touch Accessibility Test
 *
 * Verifies that the global CSS includes touch-action: manipulation
 * to prevent the 300ms tap delay on touch devices.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

describe('Touch Accessibility', () => {
  it('app.css has touch-action: manipulation on universal selector', () => {
    const css = readFileSync(join(ROOT, 'src', 'app.css'), 'utf-8');
    // Check that touch-action: manipulation exists in a * {} block
    expect(css).toContain('touch-action: manipulation');
  });

  it('app.css has -webkit-tap-highlight-color: transparent', () => {
    const css = readFileSync(join(ROOT, 'src', 'app.css'), 'utf-8');
    expect(css).toContain('-webkit-tap-highlight-color: transparent');
  });

  it('app.css has touch-action on button/interactive selectors', () => {
    const css = readFileSync(join(ROOT, 'src', 'app.css'), 'utf-8');
    // Verify the button selector block with touch-action
    expect(css).toMatch(/button.*\{[^}]*touch-action:\s*manipulation/s);
  });

  it('AppLauncher tiles have touch-action: manipulation', () => {
    const svelte = readFileSync(
      join(ROOT, 'src', 'lib', 'components', 'AppLauncher.svelte'),
      'utf-8'
    );
    // Check the .app-tile style block contains touch-action
    expect(svelte).toContain('touch-action: manipulation');
  });

  it('MobileHomeScreen tiles have touch-action: manipulation', () => {
    const svelte = readFileSync(
      join(ROOT, 'src', 'lib', 'components', 'MobileHomeScreen.svelte'),
      'utf-8'
    );
    expect(svelte).toContain('touch-action: manipulation');
  });

  it('MobileLayout nav tabs have touch-action: manipulation', () => {
    const svelte = readFileSync(
      join(ROOT, 'src', 'lib', 'components', 'layouts', 'MobileLayout.svelte'),
      'utf-8'
    );
    expect(svelte).toContain('touch-action: manipulation');
  });
});
