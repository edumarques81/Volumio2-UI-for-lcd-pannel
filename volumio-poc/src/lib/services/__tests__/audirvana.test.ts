import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseAvahiBrowseOutput,
  parseSystemctlStatus,
  type AudiorvanaInstance,
  type AudiorvanaStatus
} from '../audirvana';

describe('Audirvana Service', () => {
  describe('parseAvahiBrowseOutput', () => {
    it('should parse valid avahi-browse output with resolved services', () => {
      const output = `+   eth0 IPv6 stellar                                       _audirvana-ap._tcp   local
+   eth0 IPv4 stellar                                       _audirvana-ap._tcp   local
=   eth0 IPv4 stellar                                       _audirvana-ap._tcp   local
   hostname = [stellar.local]
   address = [192.168.86.34]
   port = [39887]
   txt = ["protovers=4.1.0" "osversion=Linux" "txtvers=1"]
=   eth0 IPv4 DESKTOP-7B25TBE                               _audirvana-ap._tcp   local
   hostname = [DESKTOP-7B25TBE.local]
   address = [192.168.86.28]
   port = [57768]
   txt = ["txtvers=1" "osversion=Win" "protovers=4.1.0"]`;

      const instances = parseAvahiBrowseOutput(output);

      expect(instances).toHaveLength(2);

      expect(instances[0]).toEqual({
        name: 'stellar',
        hostname: 'stellar.local',
        address: '192.168.86.34',
        port: 39887,
        protocol_version: '4.1.0',
        os: 'Linux'
      });

      expect(instances[1]).toEqual({
        name: 'DESKTOP-7B25TBE',
        hostname: 'DESKTOP-7B25TBE.local',
        address: '192.168.86.28',
        port: 57768,
        protocol_version: '4.1.0',
        os: 'Win'
      });
    });

    it('should handle empty output', () => {
      const instances = parseAvahiBrowseOutput('');
      expect(instances).toHaveLength(0);
    });

    it('should handle output with no resolved services (only discoveries)', () => {
      const output = `+   eth0 IPv6 stellar                                       _audirvana-ap._tcp   local
+   eth0 IPv4 stellar                                       _audirvana-ap._tcp   local`;

      const instances = parseAvahiBrowseOutput(output);
      expect(instances).toHaveLength(0);
    });

    it('should handle malformed TXT records gracefully', () => {
      const output = `=   eth0 IPv4 stellar                                       _audirvana-ap._tcp   local
   hostname = [stellar.local]
   address = [192.168.86.34]
   port = [39887]
   txt = []`;

      const instances = parseAvahiBrowseOutput(output);

      expect(instances).toHaveLength(1);
      expect(instances[0].protocol_version).toBe('unknown');
      expect(instances[0].os).toBe('unknown');
    });

    it('should handle IPv6 addresses', () => {
      const output = `=   eth0 IPv6 stellar                                       _audirvana-ap._tcp   local
   hostname = [stellar.local]
   address = [fd8f:a9c6:654:5933:ede4:428c:88a2:186]
   port = [39887]
   txt = ["protovers=4.1.0" "osversion=Linux" "txtvers=1"]`;

      const instances = parseAvahiBrowseOutput(output);

      expect(instances).toHaveLength(1);
      expect(instances[0].address).toBe('fd8f:a9c6:654:5933:ede4:428c:88a2:186');
    });

    it('should deduplicate instances by name (prefer IPv4)', () => {
      const output = `=   eth0 IPv6 stellar                                       _audirvana-ap._tcp   local
   hostname = [stellar.local]
   address = [fd8f:a9c6:654:5933::186]
   port = [39887]
   txt = ["protovers=4.1.0" "osversion=Linux" "txtvers=1"]
=   eth0 IPv4 stellar                                       _audirvana-ap._tcp   local
   hostname = [stellar.local]
   address = [192.168.86.34]
   port = [39887]
   txt = ["protovers=4.1.0" "osversion=Linux" "txtvers=1"]`;

      const instances = parseAvahiBrowseOutput(output);

      // Should deduplicate and prefer IPv4
      expect(instances).toHaveLength(1);
      expect(instances[0].address).toBe('192.168.86.34');
    });
  });

  describe('parseSystemctlStatus', () => {
    it('should parse active service status', () => {
      const output = `● audirvanaStudio.service - Run audirvanaStudio
     Loaded: loaded (/etc/systemd/system/audirvanaStudio.service; enabled; preset: enabled)
     Active: active (running) since Sun 2026-01-25 13:52:11 AEST; 3s ago
   Main PID: 6448 (audirvanaStudio)
      Tasks: 68 (limit: 9572)
        CPU: 40ms
     CGroup: /system.slice/audirvanaStudio.service
             └─6448 /opt/audirvana/studio/audirvanaStudio`;

      const status = parseSystemctlStatus(output);

      expect(status).toEqual({
        loaded: true,
        enabled: true,
        active: true,
        running: true,
        pid: 6448
      });
    });

    it('should parse inactive service status', () => {
      const output = `● audirvanaStudio.service - Run audirvanaStudio
     Loaded: loaded (/etc/systemd/system/audirvanaStudio.service; enabled; preset: enabled)
     Active: inactive (dead)`;

      const status = parseSystemctlStatus(output);

      expect(status).toEqual({
        loaded: true,
        enabled: true,
        active: false,
        running: false,
        pid: undefined
      });
    });

    it('should handle service not found', () => {
      const output = `Unit audirvanaStudio.service could not be found.`;

      const status = parseSystemctlStatus(output);

      expect(status).toEqual({
        loaded: false,
        enabled: false,
        active: false,
        running: false,
        pid: undefined
      });
    });

    it('should parse failed service status', () => {
      const output = `● audirvanaStudio.service - Run audirvanaStudio
     Loaded: loaded (/etc/systemd/system/audirvanaStudio.service; enabled; preset: enabled)
     Active: failed (Result: exit-code) since Sun 2026-01-25 12:00:00 AEST; 1h ago
    Process: 1234 ExecStart=/opt/audirvana/studio/audirvanaStudio (code=exited, status=1/FAILURE)`;

      const status = parseSystemctlStatus(output);

      expect(status).toEqual({
        loaded: true,
        enabled: true,
        active: false,
        running: false,
        pid: undefined
      });
    });

    it('should parse disabled service status', () => {
      const output = `● audirvanaStudio.service - Run audirvanaStudio
     Loaded: loaded (/etc/systemd/system/audirvanaStudio.service; disabled; preset: enabled)
     Active: inactive (dead)`;

      const status = parseSystemctlStatus(output);

      expect(status).toEqual({
        loaded: true,
        enabled: false,
        active: false,
        running: false,
        pid: undefined
      });
    });
  });
});
