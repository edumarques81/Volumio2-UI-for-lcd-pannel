# Reference Links

## Bit-Perfect Audio Implementation

### Official Documentation
- [MPD Documentation - Audio Outputs](https://mpd.readthedocs.io/en/latest/user.html#audio-outputs)
- [MPD Configuration Reference](https://mpd.readthedocs.io/en/latest/user.html#configuration)
- [ALSA Project Wiki](https://www.alsa-project.org/wiki/Main_Page)
- [ALSA Configuration Guide](https://www.alsa-project.org/main/index.php/Asoundrc)

### DSD Audio
- [DSD over PCM (DoP) Open Standard](http://dsd-guide.com/dop-open-standard)
- [DSD Guide - What is DSD?](http://dsd-guide.com/what-is-dsd)
- [Native DSD vs DoP Explained](https://audiophilestyle.com/forums/topic/30572-dsd-dop-native-whats-the-difference/)

### Hardware
- [Singxer SU-6 DDC Specifications](https://www.singxer.com/product/su-6/)
- [SMSL DO300EX DAC](https://www.smsl-audio.com/portal/product/detail/id/719.html)
- [ESS ES9039MSPRO DAC Chip](https://www.esstech.com/products/sabre-dacs/)

### Raspberry Pi Audio
- [Raspberry Pi USB Audio Configuration](https://www.raspberrypi.com/documentation/computers/configuration.html#audio-config)
- [Raspberry Pi 5 Specifications](https://www.raspberrypi.com/products/raspberry-pi-5/)
- [Volumio Documentation](https://volumio.github.io/docs/)

### Linux Audio Stack
- [Linux Audio - ALSA Architecture](https://www.kernel.org/doc/html/latest/sound/designs/index.html)
- [Understanding ALSA PCM Devices](https://www.volkerschatz.com/noise/alsa.html)
- [ALSA hw vs plughw vs dmix](https://wiki.archlinux.org/title/Advanced_Linux_Sound_Architecture#PCM)

### Audiophile Software Reference
- [Audirvana Exclusive Access Mode](https://audirvana.com/exclusive-access/)
- [Roon Audio Analysis](https://help.roonlabs.com/portal/en/kb/articles/signal-path)
- [foobar2000 WASAPI Exclusive](https://wiki.hydrogenaud.io/index.php?title=Foobar2000:Components/WASAPI_output_support_(foo_out_wasapi))

## Socket.IO / Real-time Communication
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [zishang520/socket.io (Go library)](https://github.com/zishang520/socket.io)

## Go Development
- [Go MPD Library - fhs/gompd](https://github.com/fhs/gompd)
- [zerolog Logging](https://github.com/rs/zerolog)

## Svelte/Frontend
- [Svelte Documentation](https://svelte.dev/docs)
- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Vite Build Tool](https://vitejs.dev/)

## Testing
- [Vitest Testing Framework](https://vitest.dev/)
- [Testing Library - Svelte](https://testing-library.com/docs/svelte-testing-library/intro/)

## Verification Commands

### Check MPD Audio Format
```bash
# While playing, check current format
mpc status -f "%file%\n%audioformat%"
```

### Verify ALSA Hardware Parameters
```bash
# Check actual sample rate during playback
cat /proc/asound/card5/pcm0p/sub0/hw_params
```

### List Audio Devices
```bash
aplay -l
aplay -L
```

### Check for Software Mixing
```bash
cat /proc/asound/card5/pcm0p/sub0/status
```
