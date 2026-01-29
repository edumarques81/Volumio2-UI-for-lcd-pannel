import { test, expect } from '@playwright/test';

test('debug window object', async ({ page }) => {
  // Listen to console
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));

  // Listen to page errors
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  // Clear browser storage and cache
  await page.context().clearCookies();

  // Go to page
  await page.goto('/');

  // Check what JS file is loaded
  const scripts = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    return scripts.map(s => s.getAttribute('src'));
  });
  console.log('Loaded scripts:', scripts);

  await page.waitForSelector('.app-container', { timeout: 10000 });

  // Check immediately after app-container appears
  const hasNavEarly = await page.evaluate(() => !!(window as any).__navigation);
  console.log('Has __navigation immediately:', hasNavEarly);

  // Wait a bit longer for the onMount to complete
  await page.waitForTimeout(3000);

  // Check what's on the window object
  const windowKeys = await page.evaluate(() => {
    const keys = Object.keys(window).filter(k => k.startsWith('__') || k.startsWith('test'));
    return keys;
  });
  console.log('Window keys:', windowKeys);

  // Check if __navigation exists
  const hasNavigation = await page.evaluate(() => !!(window as any).__navigation);
  console.log('Has __navigation after wait:', hasNavigation);

  // Try to force-check the window object
  const windowCheck = await page.evaluate(() => {
    return {
      hasTestToast: 'testToast' in window,
      hasTestIssue: 'testIssue' in window,
      hasNavigation: '__navigation' in window,
      navigationValue: (window as any).__navigation,
      typeofNavigation: typeof (window as any).__navigation
    };
  });
  console.log('Window check:', windowCheck);
});
