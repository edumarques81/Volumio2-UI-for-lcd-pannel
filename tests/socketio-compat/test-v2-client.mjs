/**
 * Socket.IO v2 Client Test
 *
 * Tests whether Socket.IO v2.5.0 client (same as Volumio Connect apps)
 * can connect to Stellar's v3 server.
 */

import io from 'socket.io-client-v2';

const PI_ADDRESS = process.env.PI_ADDRESS || '192.168.86.34';
const STELLAR_PORT = process.env.STELLAR_PORT || '3000';
const TARGET_URL = `http://${PI_ADDRESS}:${STELLAR_PORT}`;
const TEST_TIMEOUT = 10000;

console.log('='.repeat(60));
console.log('Socket.IO v2 Client -> v3 Server Compatibility Test');
console.log('='.repeat(60));
console.log(`Target: ${TARGET_URL}`);
console.log(`Client: socket.io-client v2.5.0`);
console.log('');

const results = {
  connection: { status: 'pending', details: '' },
  transport: { status: 'pending', details: '' },
  getState: { status: 'pending', details: '' },
  getQueue: { status: 'pending', details: '' },
  pushState: { status: 'pending', details: '' },
};

function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('V2 CLIENT TEST RESULTS');
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
  return passed;
}

// Create v2 socket
console.log('Creating Socket.IO v2 client...');
const socket = io(TARGET_URL, {
  transports: ['polling', 'websocket'],
  reconnection: false,
  timeout: TEST_TIMEOUT,
  forceNew: true,
  autoConnect: false,
});

// Connection timeout
const connectionTimeout = setTimeout(() => {
  if (results.connection.status === 'pending') {
    results.connection.status = 'fail';
    results.connection.details = 'Connection timeout (10s)';
    console.log('\x1b[31m✗ Connection timeout\x1b[0m');
    printResults();
    process.exit(1);
  }
}, TEST_TIMEOUT);

socket.on('connect', () => {
  clearTimeout(connectionTimeout);
  results.connection.status = 'pass';
  results.connection.details = 'Connected';
  console.log('\x1b[32m✓ Connected!\x1b[0m');

  // Check transport
  const transport = socket.io?.engine?.transport?.name || 'unknown';
  results.transport.status = 'pass';
  results.transport.details = transport;
  console.log(`Transport: ${transport}`);

  // Test events
  runTests();
});

socket.on('connect_error', (error) => {
  clearTimeout(connectionTimeout);
  results.connection.status = 'fail';
  results.connection.details = `Error: ${error.message || error}`;
  console.log(`\x1b[31m✗ Connection error: ${error.message || error}\x1b[0m`);
  printResults();
  process.exit(1);
});

socket.on('error', (error) => {
  console.log(`Socket error: ${error}`);
});

// Listen for pushState (should receive after getState)
socket.on('pushState', (data) => {
  if (results.pushState.status === 'pending') {
    results.pushState.status = 'pass';
    results.pushState.details = `status=${data?.status}, title=${data?.title || 'none'}`;
    console.log(`\x1b[32m✓ Received pushState\x1b[0m: status=${data?.status}`);
  }
});

socket.on('pushQueue', (data) => {
  if (results.getQueue.status === 'pending') {
    results.getQueue.status = 'pass';
    results.getQueue.details = `${Array.isArray(data) ? data.length : 0} items`;
    console.log(`\x1b[32m✓ Received pushQueue\x1b[0m: ${Array.isArray(data) ? data.length : 0} items`);
  }
});

async function runTests() {
  console.log('\nRunning event tests...\n');

  // Test getState
  console.log('Emitting: getState');
  socket.emit('getState');

  // Wait a bit then test getQueue
  await sleep(1000);
  console.log('Emitting: getQueue');
  socket.emit('getQueue');

  // Wait for responses
  await sleep(3000);

  // Mark any pending as failed
  if (results.pushState.status === 'pending') {
    results.pushState.status = 'fail';
    results.pushState.details = 'No response';
  }
  if (results.getQueue.status === 'pending') {
    results.getQueue.status = 'fail';
    results.getQueue.details = 'No response';
  }
  results.getState.status = results.pushState.status;
  results.getState.details = results.pushState.details;

  const passed = printResults();
  socket.disconnect();

  if (passed >= 4) {
    console.log('\n\x1b[32mSUCCESS: Socket.IO v2 client is COMPATIBLE with v3 server!\x1b[0m');
    console.log('No middleware translation needed.');
    process.exit(0);
  } else if (passed > 0) {
    console.log('\n\x1b[33mPARTIAL: Some compatibility - investigate failing tests\x1b[0m');
    process.exit(1);
  } else {
    console.log('\n\x1b[31mFAILED: Socket.IO v2 client is NOT compatible with v3 server\x1b[0m');
    console.log('Middleware translation or protocol bridge needed.');
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start connection
console.log('Connecting...\n');
socket.connect();

process.on('SIGINT', () => {
  socket.disconnect();
  process.exit(0);
});
