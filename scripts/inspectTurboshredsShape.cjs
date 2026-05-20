#!/usr/bin/env node

const { startTurboShredsBridgeSource } = require('../sources/turboshredsBridgeSource.cjs');
const { normalizeTransaction } = require('../core/normalizeTransaction.cjs');

const limit = parseInt(process.env.INSPECT_LIMIT || '20', 10);
const timeoutMs = parseInt(process.env.INSPECT_TIMEOUT_MS || '30000', 10);

const samples = [];
let sourceHandle = null;
let finished = false;

function hasAny(samplesToCheck, predicate) {
  return samplesToCheck.some(predicate);
}

function buildReport(transactions) {
  const normalized = transactions.map((tx) => tx.normalized);

  const report = {
    connected: transactions.length > 0,
    receivedTransactions: transactions.length,
    hasSignature: hasAny(normalized, (tx) => Boolean(tx.signature)),
    hasSlot: hasAny(normalized, (tx) => tx.slot !== null && tx.slot !== undefined),
    hasAccountKeys: hasAny(normalized, (tx) => Array.isArray(tx.accountKeys) && tx.accountKeys.length > 0),
    hasInstructions: hasAny(normalized, (tx) => Array.isArray(tx.instructions) && tx.instructions.length > 0),
    hasProgramId: hasAny(normalized, (tx) => (
      Array.isArray(tx.instructions) && tx.instructions.some((ix) => Boolean(ix.programId || ix.program_id))
    )),
    hasRawTransaction: hasAny(normalized, (tx) => Boolean(tx.raw)),
    hasPreBalances: hasAny(normalized, (tx) => Array.isArray(tx.preBalances) && tx.preBalances.length > 0),
    hasPostBalances: hasAny(normalized, (tx) => Array.isArray(tx.postBalances) && tx.postBalances.length > 0),
    hasPreTokenBalances: hasAny(normalized, (tx) => Array.isArray(tx.preTokenBalances) && tx.preTokenBalances.length > 0),
    hasPostTokenBalances: hasAny(normalized, (tx) => Array.isArray(tx.postTokenBalances) && tx.postTokenBalances.length > 0),
    hasLogs: hasAny(normalized, (tx) => Array.isArray(tx.logs) && tx.logs.length > 0),
    hasStatus: hasAny(normalized, (tx) => Boolean(tx.status)),
    missingForCurrentAnalyzer: [],
    recommendation: 'rewrite-instruction-parser'
  };

  const requiredForCurrentAnalyzer = [
    ['signature', report.hasSignature],
    ['slot', report.hasSlot],
    ['accountKeys', report.hasAccountKeys],
    ['instructions', report.hasInstructions],
    ['preTokenBalances', report.hasPreTokenBalances],
    ['postTokenBalances', report.hasPostTokenBalances],
    ['preBalances', report.hasPreBalances],
    ['postBalances', report.hasPostBalances]
  ];

  report.missingForCurrentAnalyzer = requiredForCurrentAnalyzer
    .filter(([, present]) => !present)
    .map(([field]) => field);

  if (report.missingForCurrentAnalyzer.length === 0) {
    report.recommendation = 'direct';
  } else if (
    report.hasSignature &&
    report.hasSlot &&
    (report.hasAccountKeys || report.hasInstructions)
  ) {
    report.recommendation = 'hybrid-rpc-enrich';
  }

  return report;
}

function finish() {
  if (finished) return;
  finished = true;

  if (typeof sourceHandle?.stop === 'function') sourceHandle.stop();
  else if (typeof sourceHandle?.kill === 'function') sourceHandle.kill('SIGTERM');

  console.log(JSON.stringify(buildReport(samples), null, 2));
  process.exit(samples.length > 0 ? 0 : 1);
}

sourceHandle = startTurboShredsBridgeSource(async (tx) => {
  const normalized = await normalizeTransaction(tx);
  samples.push({ raw: tx, normalized });

  if (samples.length >= limit) finish();
});

setTimeout(() => {
  console.error(`[inspect] timed out after ${timeoutMs}ms`);
  finish();
}, timeoutMs);

process.on('SIGINT', finish);
process.on('SIGTERM', finish);
