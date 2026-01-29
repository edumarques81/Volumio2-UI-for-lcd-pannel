/**
 * Audirvana Studio Integration Service
 *
 * Provides detection and discovery of Audirvana Studio instances on the network.
 * Note: Audirvana uses a proprietary binary protocol for remote control,
 * so we can only detect/discover, not control playback.
 *
 * Discovery is via mDNS service type: _audirvana-ap._tcp
 */

export interface AudiorvanaInstance {
  name: string;
  hostname: string;
  address: string;
  port: number;
  protocol_version: string;
  os: string;
}

export interface AudiorvanaServiceStatus {
  loaded: boolean;
  enabled: boolean;
  active: boolean;
  running: boolean;
  pid?: number;
}

export interface AudiorvanaStatus {
  installed: boolean;
  service: AudiorvanaServiceStatus;
  instances: AudiorvanaInstance[];
  error?: string;
}

/**
 * Parse avahi-browse -r _audirvana-ap._tcp --terminate output
 * Returns discovered Audirvana instances with their metadata
 */
export function parseAvahiBrowseOutput(output: string): AudiorvanaInstance[] {
  if (!output || output.trim() === '') {
    return [];
  }

  const instances: AudiorvanaInstance[] = [];
  const lines = output.split('\n');

  let currentInstance: Partial<AudiorvanaInstance> | null = null;

  for (const line of lines) {
    // Resolved service line starts with "="
    // Format: =   eth0 IPv4 stellar                                       _audirvana-ap._tcp   local
    const resolvedMatch = line.match(/^=\s+\S+\s+(IPv[46])\s+(\S+)\s+_audirvana-ap\._tcp\s+local/);
    if (resolvedMatch) {
      // Save previous instance if complete
      if (currentInstance && isInstanceComplete(currentInstance)) {
        instances.push(currentInstance as AudiorvanaInstance);
      }

      currentInstance = {
        name: resolvedMatch[2].trim()
      };
      continue;
    }

    // Parse metadata lines when we have a current instance
    if (currentInstance) {
      // hostname = [stellar.local]
      const hostnameMatch = line.match(/^\s+hostname\s*=\s*\[([^\]]+)\]/);
      if (hostnameMatch) {
        currentInstance.hostname = hostnameMatch[1];
        continue;
      }

      // address = [192.168.86.34]
      const addressMatch = line.match(/^\s+address\s*=\s*\[([^\]]+)\]/);
      if (addressMatch) {
        currentInstance.address = addressMatch[1];
        continue;
      }

      // port = [39887]
      const portMatch = line.match(/^\s+port\s*=\s*\[(\d+)\]/);
      if (portMatch) {
        currentInstance.port = parseInt(portMatch[1], 10);
        continue;
      }

      // txt = ["protovers=4.1.0" "osversion=Linux" "txtvers=1"]
      const txtMatch = line.match(/^\s+txt\s*=\s*\[([^\]]*)\]/);
      if (txtMatch) {
        const txtContent = txtMatch[1];
        currentInstance.protocol_version = extractTxtValue(txtContent, 'protovers') || 'unknown';
        currentInstance.os = extractTxtValue(txtContent, 'osversion') || 'unknown';
        continue;
      }
    }
  }

  // Don't forget the last instance
  if (currentInstance && isInstanceComplete(currentInstance)) {
    instances.push(currentInstance as AudiorvanaInstance);
  }

  // Deduplicate by name, preferring IPv4 addresses
  return deduplicateInstances(instances);
}

/**
 * Extract a value from TXT record string
 * Input: '"protovers=4.1.0" "osversion=Linux" "txtvers=1"'
 * extractTxtValue(input, 'protovers') => '4.1.0'
 */
function extractTxtValue(txtContent: string, key: string): string | undefined {
  const regex = new RegExp(`"${key}=([^"]+)"`);
  const match = txtContent.match(regex);
  return match ? match[1] : undefined;
}

/**
 * Check if an instance object has all required fields
 */
function isInstanceComplete(instance: Partial<AudiorvanaInstance>): boolean {
  return !!(
    instance.name &&
    instance.hostname &&
    instance.address &&
    instance.port !== undefined
  );
}

/**
 * Deduplicate instances by name, preferring IPv4 addresses over IPv6
 */
function deduplicateInstances(instances: AudiorvanaInstance[]): AudiorvanaInstance[] {
  const byName = new Map<string, AudiorvanaInstance>();

  for (const instance of instances) {
    const existing = byName.get(instance.name);

    if (!existing) {
      byName.set(instance.name, instance);
    } else {
      // Prefer IPv4 (doesn't contain ':')
      const existingIsIPv4 = !existing.address.includes(':');
      const newIsIPv4 = !instance.address.includes(':');

      if (newIsIPv4 && !existingIsIPv4) {
        byName.set(instance.name, instance);
      }
    }
  }

  return Array.from(byName.values());
}

/**
 * Parse systemctl status audirvanaStudio output
 */
export function parseSystemctlStatus(output: string): AudiorvanaServiceStatus {
  const result: AudiorvanaServiceStatus = {
    loaded: false,
    enabled: false,
    active: false,
    running: false,
    pid: undefined
  };

  if (!output || output.includes('could not be found')) {
    return result;
  }

  // Check if loaded
  // Loaded: loaded (/etc/systemd/system/audirvanaStudio.service; enabled; preset: enabled)
  const loadedMatch = output.match(/Loaded:\s+loaded\s+\([^;]+;\s*(enabled|disabled)/);
  if (loadedMatch) {
    result.loaded = true;
    result.enabled = loadedMatch[1] === 'enabled';
  }

  // Check if active
  // Active: active (running) since ...
  // Active: inactive (dead)
  // Active: failed (Result: exit-code)
  const activeMatch = output.match(/Active:\s+(active|inactive|failed)\s*\(([^)]+)\)/);
  if (activeMatch) {
    result.active = activeMatch[1] === 'active';
    result.running = activeMatch[1] === 'active' && activeMatch[2] === 'running';
  }

  // Extract PID if running
  // Main PID: 6448 (audirvanaStudio)
  if (result.running) {
    const pidMatch = output.match(/Main PID:\s+(\d+)/);
    if (pidMatch) {
      result.pid = parseInt(pidMatch[1], 10);
    }
  }

  return result;
}

/**
 * Service type for mDNS discovery
 */
export const AUDIRVANA_MDNS_SERVICE_TYPE = '_audirvana-ap._tcp';

/**
 * Default installation paths for Audirvana Studio on Linux
 */
export const AUDIRVANA_PATHS = {
  binary: '/opt/audirvana/studio/audirvanaStudio',
  serviceScript: '/opt/audirvana/studio/setAsService.sh',
  configDir: '~/.config/audirvana',
  dataDir: '~/.local/share/audirvana',
  logFile: '~/.local/share/audirvana/audirvana_studio.log',
  systemdUnit: '/etc/systemd/system/audirvanaStudio.service'
};

/**
 * Commands for Audirvana service management
 */
export const AUDIRVANA_COMMANDS = {
  /** Check if binary is installed */
  checkInstalled: `test -f ${AUDIRVANA_PATHS.binary} && echo "installed" || echo "not_installed"`,

  /** Get service status */
  getServiceStatus: 'systemctl status audirvanaStudio --no-pager 2>&1 || true',

  /** Discover instances via mDNS */
  discoverInstances: `avahi-browse -r ${AUDIRVANA_MDNS_SERVICE_TYPE} --terminate 2>/dev/null || echo ""`,

  /** Start service */
  startService: 'sudo /opt/audirvana/studio/setAsService.sh start',

  /** Stop service */
  stopService: 'sudo /opt/audirvana/studio/setAsService.sh stop',

  /** Enable service (auto-start on boot) */
  enableService: 'sudo /opt/audirvana/studio/setAsService.sh enable',

  /** Disable service */
  disableService: 'sudo /opt/audirvana/studio/setAsService.sh disable'
};
