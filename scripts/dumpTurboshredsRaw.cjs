#!/usr/bin/env node

const { startTurboShredsBridgeSource } = require('../sources/turboshredsBridgeSource.cjs');

const limit = parseInt(process.env.DUMP_LIMIT || process.env.INSPECT_LIMIT || '5', 10);
const pretty = process.env.DUMP_PRETTY === 'true';

let received = 0;
let sourceHandle = null;
let finished = false;

function finish(exitCode = 0) {
  if (finished) return;
  finished = true;

  if (typeof sourceHandle?.stop === 'function') sourceHandle.stop();
  else if (typeof sourceHandle?.kill === 'function') sourceHandle.kill('SIGTERM');

  process.exit(exitCode);
}

sourceHandle = startTurboShredsBridgeSource((tx) => {
  received += 1;

  if (pretty) {
    console.log(JSON.stringify(tx, null, 2));
  } else {
    console.log(JSON.stringify(tx));
  }

  if (received >= limit) finish(0);
});

process.on('SIGINT', () => finish(received > 0 ? 0 : 1));
process.on('SIGTERM', () => finish(received > 0 ? 0 : 1));
