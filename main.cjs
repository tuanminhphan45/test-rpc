#!/usr/bin/env node

const appConfig = require('./config.cjs');
const solPriceCache = require('./cache/solPriceCache.cjs');
const { startGeyserSource } = require('./sources/geyserSource.cjs');
const { startTurboShredsBridgeSource } = require('./sources/turboshredsBridgeSource.cjs');
const { normalizeTransaction } = require('./core/normalizeTransaction.cjs');
const { analyzeTransaction, buildPairToContractMap } = require('./core/analyzeTransaction.cjs');

function handleTokenTransaction(transaction) {
  if (transaction.tokenChange * transaction.solChange >= 0) return;

  if (transaction.pair === appConfig.solPair) {
    const solPrice = Math.abs(transaction.tokenChange / transaction.solChange);
    solPriceCache.setPrice(solPrice);
    return;
  }

  console.log(JSON.stringify(transaction));
}

function startSource(onTransaction) {
  if (appConfig.dataSource === 'geyser') {
    console.log(`[source] using geyser endpoint=${appConfig.geyser.endpoint}`);
    return startGeyserSource(onTransaction);
  }

  if (appConfig.dataSource === 'turboshreds') {
    console.log(`[source] using turboshreds addr=${appConfig.turboshreds.addr}`);
    console.log(`[source] turboshreds bridge=${appConfig.turboshreds.bridgePath}`);
    return startTurboShredsBridgeSource(onTransaction);
  }

  throw new Error(`Unsupported DATA_SOURCE: ${appConfig.dataSource}`);
}

function main() {
  const pairToContractMap = buildPairToContractMap();
  let sourceHandle = null;

  console.log('SOLANA TOKEN TRANSACTION MONITOR');
  console.log(`dataSource=${appConfig.dataSource}`);
  console.log(`rpcEndpoint=${appConfig.rpc.endpoint}`);
  console.log(`monitoredPairs=${JSON.stringify(appConfig.monitoredPairs)}`);

  sourceHandle = startSource(async (tx) => {
    const normalized = await normalizeTransaction(tx);
    const result = await analyzeTransaction(normalized, { pairToContractMap });
    if (result) handleTokenTransaction(result);
  });

  const shutdown = () => {
    console.log('\nStopping monitor...');
    if (typeof sourceHandle?.stop === 'function') sourceHandle.stop();
    else if (typeof sourceHandle?.kill === 'function') sourceHandle.kill('SIGTERM');
    console.log('Stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  main();
}
