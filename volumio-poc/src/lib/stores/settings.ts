import { writable, get } from 'svelte/store';
import { socketService } from '$lib/services/socket';
import { layoutMode, type LayoutMode } from './navigation';
import { getVolumioHost } from '$lib/config';

/**
 * System info from Volumio
 */
export interface SystemInfo {
  id: string;
  host: string;
  name: string;
  type: string;
  serviceName: string;
  systemversion: string;
  builddate: string;
  variant: string;
  hardware: string;
}

/**
 * Network status
 */
export interface NetworkStatus {
  status: string;
  online: boolean;
  ip?: string;
}

/**
 * Audio output device
 */
export interface AudioOutput {
  id: string;
  name: string;
  enabled: boolean;
}

/**
 * Background image
 */
export interface Background {
  name: string;
  path: string;
  thumbnail: string;
}

/**
 * Backgrounds data from Volumio
 */
export interface BackgroundsData {
  available: Background[];
  current?: Background;
}

/**
 * Settings category for navigation
 */
export interface SettingsCategory {
  id: string;
  title: string;
  icon: string;
  description: string;
}

// System info
export const systemInfo = writable<SystemInfo | null>(null);

// Network status
export const networkStatus = writable<NetworkStatus | null>(null);

// Audio outputs
export const audioOutputs = writable<AudioOutput[]>([]);

// Available backgrounds
export const availableBackgrounds = writable<Background[]>([]);

// Current selected background (stored locally)
const BACKGROUND_STORAGE_KEY = 'volumio-poc-background';

function loadStoredBackground(): string {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(BACKGROUND_STORAGE_KEY) || '';
  }
  return '';
}

export const selectedBackground = writable<string>(loadStoredBackground());

/**
 * LCD Standby Mode
 * - 'css': Dimmed standby (20% brightness via CSS overlay) - instant, touch-to-wake works
 * - 'hardware': Hardware off (wlr-randr) - actually turns off display, slower wake
 */
export type LcdStandbyMode = 'css' | 'hardware';

const LCD_STANDBY_MODE_KEY = 'volumio-poc-lcd-standby-mode';

function loadLcdStandbyMode(): LcdStandbyMode {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(LCD_STANDBY_MODE_KEY);
    if (stored === 'css' || stored === 'hardware') {
      return stored;
    }
  }
  return 'css'; // Default to CSS dimmed standby for reliable touch-to-wake
}

export const lcdStandbyMode = writable<LcdStandbyMode>(loadLcdStandbyMode());

// Settings categories
export const settingsCategories: SettingsCategory[] = [
  {
    id: 'playback',
    title: 'Playback',
    icon: 'play',
    description: 'Audio output, volume, and playback settings'
  },
  {
    id: 'network',
    title: 'Network',
    icon: 'wifi',
    description: 'WiFi, Ethernet, and network settings'
  },
  {
    id: 'sources',
    title: 'Music Sources',
    icon: 'folder',
    description: 'NAS, USB, and streaming services'
  },
  {
    id: 'appearance',
    title: 'Appearance',
    icon: 'settings',
    description: 'Display and interface settings'
  },
  {
    id: 'system',
    title: 'System',
    icon: 'info',
    description: 'System info, updates, and shutdown'
  }
];

// Current settings category
export const currentSettingsCategory = writable<string | null>(null);

/**
 * Display mode based on screen size
 */
export type DisplayMode = 'lcd' | 'desktop' | 'tablet' | 'mobile';

// Display mode detection
function detectDisplayMode(): DisplayMode {
  if (typeof window === 'undefined') return 'desktop';

  const width = window.innerWidth;
  const height = window.innerHeight;

  // LCD panel: wide and short (e.g., 1920x440)
  if (height <= 500) {
    return 'lcd';
  }

  // Mobile: narrow screens
  if (width < 768) {
    return 'mobile';
  }

  // Tablet: medium screens
  if (width < 1025) {
    return 'tablet';
  }

  // Desktop: large screens
  return 'desktop';
}

export const displayMode = writable<DisplayMode>(detectDisplayMode());
export const isLcdMode = writable<boolean>(false);
export const isTouchDevice = writable<boolean>(false);

// Update display mode on resize
if (typeof window !== 'undefined') {
  // Initial detection
  displayMode.set(detectDisplayMode());
  isLcdMode.set(detectDisplayMode() === 'lcd');
  isTouchDevice.set('ontouchstart' in window || navigator.maxTouchPoints > 0);

  // Listen for resize
  let resizeTimeout: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const mode = detectDisplayMode();
      displayMode.set(mode);
      isLcdMode.set(mode === 'lcd');
    }, 150);
  });
}

/**
 * Settings actions
 */
export const settingsActions = {
  /**
   * Get system info
   */
  getSystemInfo() {
    socketService.emit('getSystemInfo');
  },

  /**
   * Get network status
   */
  getNetworkStatus() {
    socketService.emit('getNetworkStatus');
  },

  /**
   * Navigate to settings category
   */
  openCategory(categoryId: string) {
    currentSettingsCategory.set(categoryId);
  },

  /**
   * Go back to settings root
   */
  backToRoot() {
    currentSettingsCategory.set(null);
  },

  /**
   * Set audio output
   */
  setAudioOutput(outputId: string) {
    console.log('[Settings] Setting audio output:', outputId);
    socketService.emit('setAudioOutput', { output: outputId });
  },

  /**
   * Restart Volumio
   */
  restart() {
    console.log('[Settings] Restarting Volumio');
    socketService.emit('reboot');
  },

  /**
   * Shutdown Volumio
   */
  shutdown() {
    console.log('[Settings] Shutting down Volumio');
    socketService.emit('shutdown');
  },

  /**
   * Toggle layout mode
   */
  toggleLayoutMode() {
    layoutMode.update(mode => mode === 'compact' ? 'full' : 'compact');
  },

  /**
   * Set layout mode
   */
  setLayoutMode(mode: LayoutMode) {
    layoutMode.set(mode);
  },

  /**
   * Scan for music
   */
  rescanLibrary() {
    console.log('[Settings] Rescanning library');
    socketService.emit('rescanDb');
  },

  /**
   * Get available backgrounds
   */
  getBackgrounds() {
    console.log('[Settings] Fetching backgrounds');
    socketService.emit('getBackgrounds');
  },

  /**
   * Set background image
   */
  setBackground(backgroundPath: string) {
    console.log('[Settings] Setting background:', backgroundPath);
    selectedBackground.set(backgroundPath);
    // Store in localStorage for persistence
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BACKGROUND_STORAGE_KEY, backgroundPath);
    }
  },

  /**
   * Clear background (use album art)
   */
  clearBackground() {
    console.log('[Settings] Clearing background (using album art)');
    selectedBackground.set('');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(BACKGROUND_STORAGE_KEY);
    }
  },

  /**
   * Set LCD standby mode
   * @param mode 'css' for dimmed standby (recommended), 'hardware' for wlr-randr off
   */
  setLcdStandbyMode(mode: LcdStandbyMode) {
    console.log('[Settings] Setting LCD standby mode:', mode);
    lcdStandbyMode.set(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LCD_STANDBY_MODE_KEY, mode);
    }
  }
};

/**
 * Initialize settings store - set up socket listeners
 */
export function initSettingsStore() {
  // Listen for system info
  socketService.on<SystemInfo>('pushSystemInfo', (data) => {
    console.log('[Settings] System info:', data);
    systemInfo.set(data);
  });

  // Listen for network status
  socketService.on('pushNetworkStatus', (data: any) => {
    console.log('[Settings] Network status:', data);
    networkStatus.set(data);
  });

  // Listen for audio outputs
  socketService.on('pushAudioOutputs', (data: AudioOutput[]) => {
    console.log('[Settings] Audio outputs:', data);
    audioOutputs.set(data || []);
  });

  // Listen for backgrounds
  socketService.on('pushBackgrounds', (data: any) => {
    console.log('[Settings] Backgrounds:', data);
    if (data && data.available) {
      const host = getVolumioHost();
      const bgBasePath = '/app/plugins/miscellanea/appearance/backgrounds';
      const backgrounds: Background[] = data.available.map((bg: any) => ({
        name: bg.name || bg.path.replace('.jpg', '').replace('.png', ''),
        path: bg.path.startsWith('http') ? bg.path : `${host}${bgBasePath}/${bg.path}`,
        thumbnail: bg.thumbnail
          ? (bg.thumbnail.startsWith('http') ? bg.thumbnail : `${host}${bgBasePath}/${bg.thumbnail}`)
          : (bg.path.startsWith('http') ? bg.path : `${host}${bgBasePath}/${bg.path}`)
      }));
      availableBackgrounds.set(backgrounds);
    }
  });

  // Fetch initial data
  settingsActions.getSystemInfo();
  settingsActions.getNetworkStatus();
  settingsActions.getBackgrounds();
}
