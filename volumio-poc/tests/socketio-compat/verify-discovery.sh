#!/bin/bash
# Verify mDNS Discovery for Volumio Connect Apps
#
# This script checks that the Stellar device is discoverable
# by Volumio Connect apps via mDNS.

set -e

echo "============================================================"
echo "Stellar mDNS Discovery Verification"
echo "============================================================"
echo ""

# Test 1: Check _Volumio._tcp service discovery
echo "1. Discovering _Volumio._tcp services..."
echo "   (This may take a few seconds)"
echo ""

# Use dns-sd to browse services
RESULT=$(dns-sd -B _Volumio._tcp local. 2>&1 &
  PID=$!
  sleep 3
  kill $PID 2>/dev/null || true
  wait $PID 2>/dev/null || true
)

if echo "$RESULT" | grep -q "raspberrypi"; then
  echo "✓ Found 'raspberrypi' service"
else
  echo "✗ Service not found. Check avahi-daemon on Pi."
  exit 1
fi

echo ""

# Test 2: Get service details
echo "2. Checking service details..."
echo ""

DETAILS=$(dns-sd -L raspberrypi _Volumio._tcp local. 2>&1 &
  PID=$!
  sleep 3
  kill $PID 2>/dev/null || true
  wait $PID 2>/dev/null || true
)

# Check port
if echo "$DETAILS" | grep -q ":3002"; then
  echo "✓ Port 3002 advertised correctly"
else
  echo "✗ Port not found in service details"
fi

# Check TXT records
if echo "$DETAILS" | grep -q "volumioName=Stellar"; then
  echo "✓ volumioName=Stellar TXT record present"
else
  echo "✗ volumioName TXT record missing"
fi

if echo "$DETAILS" | grep -q "UUID=stellar-rpi-001"; then
  echo "✓ UUID=stellar-rpi-001 TXT record present"
else
  echo "✗ UUID TXT record missing"
fi

echo ""
echo "============================================================"
echo "Next Steps: Manual Testing with Volumio Connect App"
echo "============================================================"
echo ""
echo "1. Install 'Volumio' app from App Store (iOS) or Play Store (Android)"
echo "2. Ensure your phone is on the same WiFi network as the Pi"
echo "3. Open the app and look for 'Stellar' or 'raspberrypi' in device list"
echo "4. Tap to connect and verify you can:"
echo "   - See now playing info"
echo "   - Control play/pause"
echo "   - Adjust volume"
echo "   - Browse library (if supported by your Volumio app version)"
echo ""
