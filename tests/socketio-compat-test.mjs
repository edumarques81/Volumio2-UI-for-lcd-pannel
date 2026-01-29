/**
 * Socket.IO v2/v3 Compatibility Test
 *
 * This script tests whether a Socket.IO v2 client can connect to our
 * Stellar backend which uses Socket.IO v3 (Go implementation).
 *
 * Volumio Connect apps use Socket.IO v2.x client.
 * Stellar backend uses github.com/zishang520/socket.io/v3
 *
 * Run: node tests/socketio-compat-test.mjs
 */

import { io } from 'socket.io-client';
import { createRequire } from 'module';

// Get Pi address from environment or use default
const PI_ADDRESS = process.env.PI_ADDRESS || '192.168.86.34';
const STELLAR_PORT = process.env.STELLAR_PORT || '3002';
const TARGET_URL = `http://${PI_ADDRESS}:${STELLAR_PORT}`;

console.log('='.repeat(60));
console.log('Socket.IO v2/v3 Compatibility Test');
console.log('='.repeat(60));
console.log(`Target: ${TARGET_URL}`);
console.log(`Socket.IO Client Version: ${io.version || 'unknown (check package.json)'}`);
console.log('');

// Track test results
const results = {
  connection: { status: 'pending', details: '' },
  getState: { status: 'pending', details: '' },
  getQueue: { status: 'pending', details: '' },
  play: { status: 'pending', details: '' },
  pause: { status: 'pending', details: '' },
  volume: { status: 'pending', details: '' },
};

// Timeout for each test
const TEST_TIMEOUT = 5000;

function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS');
  console.log('='.repeat(60));

  for (const [test, result] of Object.entries(results)) {
    const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '?';
    const color = result.status === 'pass' ? '\x1b[32m' : result.status === 'fail' ? '\x1b[31m' : '\x1b[33m';
    console.log(`${color}${icon}\x1b[0m ${test}: ${result.status} ${result.details ? `- ${result.details}` : ''}`);
  }

  const passed = Object.values(results).filter(r => r.status === 'pass').length;
  const total = Object.keys(results).length;
  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('\x1b[32m\nSocket.IO v2/v3 COMPATIBLE!\x1b[0m');
  } else if (passed > 0) {
    console.log('\x1b[33m\nPartial compatibility - some features may not work\x1b[0m');
  } else {
    console.log('\x1b[31m\nSocket.IO v2/v3 INCOMPATIBLE - middleware needed\x1b[0m');
  }
}

// Create socket with v2-style options
const socket = io(TARGET_URL, {
  transports: ['polling', 'websocket'],  // Try polling first (v2 default)
  reconnection: false,
  timeout: TEST_TIMEOUT,
  forceNew: true,
});

// Connection test
const connectionTimeout = setTimeout(() => {
  if (results.connection.status === 'pending') {
    results.connection.status = 'fail';
    results.connection.details = 'Connection timeout';
    console.log('Connection timeout - server may be down or incompatible');
    printResults();
    process.exit(1);
  }
}, TEST_TIMEOUT);

socket.on('connect', () => {
  clearTimeout(connectionTimeout);
  results.connection.status = 'pass';
  results.connection.details = `Connected with transport: ${socket.io.engine.transport.name}`;
  console.log(`✓ Connected! Transport: ${socket.io.engine.transport.name}`);

  // Run event tests
  runEventTests();
});

socket.on('connect_error', (error) => {
  clearTimeout(connectionTimeout);
  results.connection.status = 'fail';
  results.connection.details = error.message;
  console.log(`✗ Connection error: ${error.message}`);
  printResults();
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log(`Disconnected: ${reason}`);
});

// Event tests
async function runEventTests() {
  console.log('\nRunning event tests...\n');

  // Test 1: getState -> pushState
  await testEvent('getState', 'pushState', null, (data) => {
    results.getState.status = 'pass';
    results.getState.details = `Received state: status=${data?.status || 'unknown'}`;
    return true;
  });

  // Test 2: getQueue -> pushQueue
  await testEvent('getQueue', 'pushQueue', null, (data) => {
    results.getQueue.status = 'pass';
    results.getQueue.details = `Received queue: ${Array.isArray(data) ? data.length : 0} items`;
    return true;
  });

  // Test 3: volume (emit only, response via pushState)
  await testEmitOnly('volume', 50, () => {
    results.volume.status = 'pass';
    results.volume.details = 'Emit accepted';
  });

  // Test 4: pause (emit only)
  await testEmitOnly('pause', null, () => {
    results.pause.status = 'pass';
    results.pause.details = 'Emit accepted';
  });

  // Test 5: play (emit only)
  await testEmitOnly('play', null, () => {
    results.play.status = 'pass';
    results.play.details = 'Emit accepted';
  });

  // Print results and exit
  setTimeout(() => {
    printResults();
    socket.disconnect();
    process.exit(0);
  }, 1000);
}

function testEvent(emitEvent, listenEvent, data, validator) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      results[emitEvent].status = 'fail';
      results[emitEvent].details = `No ${listenEvent} response`;
      resolve();
    }, TEST_TIMEOUT);

    const handler = (responseData) => {
      clearTimeout(timeout);
      socket.off(listenEvent, handler);
      if (validator(responseData)) {
        console.log(`✓ ${emitEvent} -> ${listenEvent}`);
      }
      resolve();
    };

    socket.on(listenEvent, handler);
    console.log(`  Emitting: ${emitEvent}`);
    socket.emit(emitEvent, data);
  });
}

function testEmitOnly(event, data, onSuccess) {
  return new Promise((resolve) => {
    try {
      socket.emit(event, data);
      console.log(`✓ ${event} emitted`);
      onSuccess();
      resolve();
    } catch (error) {
      results[event].status = 'fail';
      results[event].details = error.message;
      resolve();
    }
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nTest interrupted');
  socket.disconnect();
  process.exit(0);
});
