#!/usr/bin/env node
/**
 * Launch 10 SafeCover scenario servers on ports 3001-3010.
 * Each scenario runs on its own port with industry-specific demo.
 *
 * Usage: node scripts/launch-all-scenarios.js
 * Or:    npm run scenarios
 */

const { spawn } = require('child_process');
const path = require('path');

const SCENARIOS = [
  { port: 3001, id: 'retail', name: 'Retail & E-commerce' },
  { port: 3002, id: 'logistics', name: 'Logistics & Shipping' },
  { port: 3003, id: 'healthcare', name: 'Healthcare' },
  { port: 3004, id: 'hospitality', name: 'Hospitality & Travel' },
  { port: 3005, id: 'food', name: 'Food & Delivery' },
  { port: 3006, id: 'cyber', name: 'Cyber & Digital' },
  { port: 3007, id: 'mobility', name: 'Mobility & Gig Economy' },
  { port: 3008, id: 'parametric', name: 'Parametric (Climate/Events)' },
  { port: 3009, id: 'gadgets', name: 'Gadgets & Electronics' },
  { port: 3010, id: 'events', name: 'Events & Ticketing' },
];

const backendDir = path.join(__dirname, '..', 'backend');
const serverPath = path.join(backendDir, 'server.js');

console.log('\n  SafeCover – Launching 10 industry scenarios\n');
console.log('  Each scenario runs on its own port with complex transactions.\n');

const processes = [];

SCENARIOS.forEach(({ port, id, name }) => {
  const env = { ...process.env, PORT: String(port), SCENARIO: id };
  const child = spawn('node', [serverPath], {
    cwd: backendDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let ready = false;
  child.stdout.on('data', (data) => {
    const str = data.toString();
    if (str.includes('SafeCover running')) ready = true;
    process.stdout.write(`[${port}] ${str}`);
  });
  child.stderr.on('data', (data) => {
    process.stderr.write(`[${port}] ${data}`);
  });
  child.on('error', (err) => {
    console.error(`[${port}] Failed to start:`, err.message);
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${port}] Exited with code ${code}`);
    }
  });

  processes.push({ port, id, name, child });
  console.log(`  ✓ Port ${port}: ${name} → http://localhost:${port}`);
});

console.log('\n  All 10 scenarios are running. Press Ctrl+C to stop all.\n');
console.log('  Quick links:');
SCENARIOS.forEach(({ port, id }) => {
  console.log(`    http://localhost:${port}  (${id})`);
});
console.log('');

process.on('SIGINT', () => {
  console.log('\n  Stopping all scenario servers...');
  processes.forEach(({ child }) => child.kill('SIGTERM'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  processes.forEach(({ child }) => child.kill('SIGTERM'));
  process.exit(0);
});
