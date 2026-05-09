import { writable, readable } from 'svelte/store';
import { socketService } from '$lib/services/socket';

/**
 * Version information structure (matches backend).
 */
export interface VersionInfo {
  name: string;
  version: string;
  buildTime?: string;
  gitCommit?: string;
}

// Frontend version (injected at build time via Vite's `define`).
// __APP_VERSION__ is sourced from package.json (single source of truth).
// __BUILD_TIME__ is set when the Vite process starts (ISO 8601).
const FRONTEND_VERSION: VersionInfo = {
  name: 'Stellar Volumio',
  version: __APP_VERSION__,
  buildTime: __BUILD_TIME__,
  gitCommit: ''
};

/**
 * Frontend version info (read-only).
 */
export const frontendVersion = readable<VersionInfo>(FRONTEND_VERSION);

/**
 * Backend version info (fetched via Socket.IO).
 */
export const backendVersion = writable<VersionInfo | null>(null);

/**
 * Loading state for backend version.
 */
export const backendVersionLoading = writable<boolean>(true);

/**
 * Actions for version management.
 */
export const versionActions = {
  /**
   * Request backend version via Socket.IO.
   */
  fetchBackendVersion: () => {
    socketService.emit('getVersion');
  }
};

// Initialize listeners
let initialized = false;

/**
 * Initialize version store and Socket.IO listeners.
 */
export function initVersionStore() {
  if (initialized) return;
  initialized = true;

  console.log('📦 Initializing version store...');

  // Listen for version info from backend
  socketService.on<VersionInfo>('pushVersion', (version) => {
    console.log('📦 Backend version received:', version);
    backendVersion.set(version);
    backendVersionLoading.set(false);
  });

  console.log('✅ Version store initialized');

  // Request version after a short delay
  setTimeout(() => {
    console.log('📡 Requesting backend version...');
    socketService.emit('getVersion');
  }, 500);
}

/**
 * Cleanup version store.
 */
export function cleanupVersionStore() {
  backendVersion.set(null);
  backendVersionLoading.set(true);
  initialized = false;
}
