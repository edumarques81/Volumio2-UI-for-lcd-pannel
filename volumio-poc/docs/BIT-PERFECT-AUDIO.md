# Bit-Perfect Audio Implementation Plan

## Overview

This document outlines the implementation of bit-perfect audio playback for the Stellar audio player, targeting high-resolution PCM (up to 384kHz/32-bit) and native DSD (up to DSD512).

## Target Hardware

### Digital-to-Digital Converter (DDC)
- **Device**: Singxer SU-6
- **Connection**: USB from Raspberry Pi 5
- **Capabilities**:
  - PCM: Up to 384kHz / 32-bit
  - DSD: Native DSD512 (22.5792 MHz) via I2S
  - Output: I2S (HDMI form factor)

### Digital-to-Analog Converter (DAC)
- **Device**: SMSL DO300EX
- **Connection**: I2S from Singxer SU-6
- **Capabilities**:
  - PCM: Up to 384kHz / 32-bit
  - DSD: Native DSD512
  - Dual ES9039MSPRO chips

### Host
- **Device**: Raspberry Pi 5
- **OS**: Volumio (Debian-based)
- **Audio Stack**: ALSA → MPD

## What is Bit-Perfect Audio?

Bit-perfect playback means the digital audio data reaches the DAC exactly as stored in the source file, with:

1. **No resampling** - Sample rate preserved (44.1kHz stays 44.1kHz)
2. **No bit-depth conversion** - 24-bit stays 24-bit
3. **No mixing** - Direct hardware access, no software mixer
4. **No volume adjustment** - Hardware volume or fixed output
5. **No format conversion** - FLAC decoded → PCM sent as-is

## Current ALSA Configuration

```bash
# Current device enumeration
$ aplay -l
card 5: U20SU6 [USB Audio 2.0(SU-6)], device 0: USB Audio [USB Audio]
  Subdevices: 1/1
  Subdevice #0: subdevice #0
```

```bash
# Current asound.conf
pcm.!default {
    type             empty
    slave.pcm       "volumio"
}

pcm.volumio {
    type             empty
    slave.pcm       "volumioOutput"
}

pcm.volumioOutput {
    type plug
    slave.pcm "volumioHw"
}

pcm.volumioHw {
    type hw
    card "U20SU6"
}
```

**Issue**: The `plug` plugin in `volumioOutput` may perform format conversion.

## Bit-Perfect ALSA Configuration

```conf
# /etc/asound.conf - Bit-perfect configuration

# Direct hardware access - no conversion
pcm.!default {
    type hw
    card "U20SU6"
    device 0
}

ctl.!default {
    type hw
    card "U20SU6"
}

# Named device for explicit access
pcm.bitperfect {
    type hw
    card "U20SU6"
    device 0
    format S32_LE      # 32-bit little-endian
    rate 384000        # Max supported rate
    channels 2
}
```

## MPD Configuration for Bit-Perfect

```conf
# /etc/mpd.conf

###############################################################################
# General Settings
###############################################################################
music_directory         "/var/lib/mpd/music"
playlist_directory      "/var/lib/mpd/playlists"
db_file                 "/var/lib/mpd/database"
log_file                "/var/log/mpd/mpd.log"
pid_file                "/run/mpd/pid"
state_file              "/var/lib/mpd/state"
sticker_file            "/var/lib/mpd/sticker.sql"

user                    "mpd"
group                   "audio"

bind_to_address         "any"
port                    "6600"

###############################################################################
# Audio Output - Bit-Perfect
###############################################################################
audio_output {
    type                "alsa"
    name                "Singxer SU-6 (Bit-Perfect)"
    device              "hw:U20SU6,0"

    # Disable all processing
    mixer_type          "none"          # No software volume

    # Disable automatic conversions
    auto_resample       "no"            # No sample rate conversion
    auto_format         "no"            # No format conversion
    auto_channels       "no"            # No channel mixing

    # DSD playback
    dop                 "yes"           # DSD over PCM for compatible DACs

    # Buffer settings for stability
    buffer_time         "100000"        # 100ms buffer
    period_time         "25000"         # 25ms period
}

###############################################################################
# Decoder Settings
###############################################################################
# DSD decoder - native DSD support
decoder {
    plugin              "dsdiff"
    enabled             "yes"
}

decoder {
    plugin              "dsf"
    enabled             "yes"
}

###############################################################################
# Resampler - Disabled for bit-perfect
###############################################################################
# resampler {
#     plugin            "soxr"
#     quality           "very high"
# }

###############################################################################
# Audio Settings
###############################################################################
audio_buffer_size       "8192"          # 8MB buffer
buffer_before_play      "20%"

# Disable all audio processing
replaygain              "off"
volume_normalization    "no"

###############################################################################
# Performance
###############################################################################
auto_update             "no"
filesystem_charset      "UTF-8"
```

## DSD Playback Modes

### 1. DoP (DSD over PCM)
- DSD data encapsulated in PCM frames
- Compatible with most USB DACs
- Marker bytes identify DSD content
- Slight bandwidth overhead

```conf
# MPD config for DoP
audio_output {
    dop                 "yes"
}
```

### 2. Native DSD
- Direct DSD bitstream to DAC
- Requires DAC with native DSD support
- No overhead, maximum fidelity
- Singxer SU-6 supports native DSD512

```conf
# For native DSD (if supported by ALSA driver)
audio_output {
    dop                 "no"
    # Native DSD handled by ALSA driver
}
```

## Supported Formats

| Format | Sample Rate | Bit Depth | Notes |
|--------|-------------|-----------|-------|
| PCM | 44.1 kHz | 16-bit | CD quality |
| PCM | 48 kHz | 24-bit | DVD quality |
| PCM | 88.2 kHz | 24-bit | 2x CD |
| PCM | 96 kHz | 24-bit | DVD-Audio |
| PCM | 176.4 kHz | 24-bit | 4x CD |
| PCM | 192 kHz | 24-bit | High-res |
| PCM | 352.8 kHz | 32-bit | DXD |
| PCM | 384 kHz | 32-bit | Max PCM |
| DSD64 | 2.8224 MHz | 1-bit | SACD |
| DSD128 | 5.6448 MHz | 1-bit | 2x DSD |
| DSD256 | 11.2896 MHz | 1-bit | 4x DSD |
| DSD512 | 22.5792 MHz | 1-bit | 8x DSD |

## Implementation Tasks

### Phase 1: MPD Configuration
- [ ] Create bit-perfect mpd.conf template
- [ ] Test with high-res PCM files (96/24, 192/24)
- [ ] Verify no resampling occurs
- [ ] Test DSD playback (DSD64, DSD128)

### Phase 2: ALSA Configuration
- [ ] Create minimal asound.conf (direct hw access)
- [ ] Remove plug/dmix layers
- [ ] Test hardware mixer bypass
- [ ] Verify format passthrough

### Phase 3: Backend Integration
- [ ] Add bit-perfect status to player state
- [ ] Detect current audio format from MPD
- [ ] Display sample rate/bit depth in UI
- [ ] Add audio output configuration API

### Phase 4: UI Enhancements
- [ ] Show bit-perfect indicator when active
- [ ] Display current format (e.g., "192kHz/24-bit FLAC")
- [ ] DSD indicator for DSD playback
- [ ] Audio output device selector

### Phase 5: Testing & Validation
- [ ] Test all supported formats
- [ ] Verify bit-perfect with audio analyzer
- [ ] Test gapless playback
- [ ] Stress test with format switching

## Verification Methods

### 1. Check MPD Output Format
```bash
# While playing, check MPD status
mpc status -f "%file%\n%audioformat%"
```

### 2. Verify No Resampling
```bash
# Check ALSA actual rate
cat /proc/asound/card5/pcm0p/sub0/hw_params
```

Expected output for 192kHz file:
```
access: MMAP_INTERLEAVED
format: S32_LE
subformat: STD
channels: 2
rate: 192000 (192000/1)
```

### 3. Check for Software Mixing
```bash
# Should show only hardware access
cat /proc/asound/card5/pcm0p/sub0/status
```

## References

- [MPD Documentation - Audio Outputs](https://mpd.readthedocs.io/en/latest/user.html#audio-outputs)
- [ALSA Documentation](https://www.alsa-project.org/wiki/Main_Page)
- [DSD over PCM (DoP) Specification](http://dsd-guide.com/dop-open-standard)
- [Singxer SU-6 Specifications](https://www.singxer.com/product/su-6/)
- [Raspberry Pi USB Audio](https://www.raspberrypi.com/documentation/computers/configuration.html#audio-config)

## Related Documentation

- [Stellar Backend Architecture](../../../stellar-volumio-audioplayer-backend/docs/ARCHITECTURE.md)
- [State Machine Issues](./STATE-MACHINE-ISSUES.md)
