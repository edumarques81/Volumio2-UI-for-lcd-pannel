/**
 * App Launcher Tile Tests
 *
 * Verifies that all tiles have valid actions and no undefined/null handlers.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

describe('AppLauncher tiles', () => {
  const source = readFileSync(
    join(ROOT, 'src', 'lib', 'components', 'AppLauncher.svelte'),
    'utf-8'
  );

  it('every tile has a non-empty action', () => {
    // Extract action fields from tile definitions
    const actionMatches = source.matchAll(/action:\s*(\([^)]*\)\s*=>|[\w]+)\s*/g);
    const actions = [...actionMatches];
    expect(actions.length).toBeGreaterThan(0);

    // No tile should have action: undefined or action: null
    expect(source).not.toMatch(/action:\s*(undefined|null)/);
  });

  it('does not contain artists or genres tiles', () => {
    // Extract tile id values
    const idMatches = [...source.matchAll(/id:\s*'(\w[\w-]*)'/g)].map(m => m[1]);
    expect(idMatches).not.toContain('artists');
    expect(idMatches).not.toContain('genres');
  });

  it('has renamed tiles with clear subtitles', () => {
    // Check the simplified tile names exist
    expect(source).toContain("title: 'My Music'");
    expect(source).toContain("subtitle: 'All sources'");
    expect(source).toContain("title: 'Local'");
    expect(source).toContain("subtitle: 'Local files only'");
  });
});

describe('MobileHomeScreen tiles', () => {
  const source = readFileSync(
    join(ROOT, 'src', 'lib', 'components', 'MobileHomeScreen.svelte'),
    'utf-8'
  );

  it('every tile has a non-empty action', () => {
    expect(source).not.toMatch(/action:\s*(undefined|null)/);
  });

  it('does not contain artists or genres tiles', () => {
    const idMatches = [...source.matchAll(/id:\s*'(\w[\w-]*)'/g)].map(m => m[1]);
    expect(idMatches).not.toContain('artists');
    expect(idMatches).not.toContain('genres');
  });

  it('has max 8 static tiles plus LCD tile', () => {
    const idMatches = [...source.matchAll(/id:\s*'(\w[\w-]*)'/g)].map(m => m[1]);
    // Filter out the lcd-panel tile since it's reactive
    const staticIds = idMatches.filter(id => id !== 'lcd-panel');
    expect(staticIds.length).toBeLessThanOrEqual(8);
  });
});
