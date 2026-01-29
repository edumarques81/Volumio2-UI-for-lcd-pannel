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

// Frontend version (static, set at build time)
const FRONTEND_VERSION: VersionInfo = {
  name: 'Stellar Volumio',
  version: '0.1.0',
  // These could be injected at build time via Vite's define
  buildTime: '',
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
