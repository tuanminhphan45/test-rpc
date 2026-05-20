const appConfig = require('../config.cjs');
const solPriceCache = require('../cache/solPriceCache.cjs');

const WSOL_MINT = appConfig.solAddress;

function buildPairToContractMap(pairs = appConfig.monitoredPairs) {
  return new Map(
    (pairs || []).map(({ pair, contract }) => [
      String(pair || '').toLowerCase(),
      String(contract || '').toLowerCase()
    ])
  );
}

function getUiAmount(balance) {
  return parseFloat(
    balance?.uiTokenAmount?.uiAmount
    ?? balance?.ui_token_amount?.ui_amount
    ?? balance?.uiTokenAmount?.ui_amount
    ?? 0
  );
}

function analyzeTokenTransfers(tx) {
  if (!Array.isArray(tx?.preTokenBalances) || !Array.isArray(tx?.postTokenBalances)) {
    return [];
  }

  const transfers = [];

  for (const postBalance of tx.postTokenBalances) {
    const preBalance = tx.preTokenBalances.find((pre) => (
      pre.accountIndex === postBalance.accountIndex &&
      pre.mint === postBalance.mint
    ));

    const postAmount = getUiAmount(postBalance);
    const preAmount = preBalance ? getUiAmount(preBalance) : 0;
    const change = postAmount - preAmount;

    if (change === 0) continue;

    transfers.push({
      accountIndex: postBalance.accountIndex,
      tokenAccount: tx.accountKeys?.[postBalance.accountIndex],
      owner: postBalance.owner || '',
      mint: postBalance.mint || '',
      change,
      decimals: postBalance.uiTokenAmount?.decimals ?? postBalance.ui_token_amount?.decimals ?? 0,
      preBalance: preAmount,
      postBalance: postAmount
    });
  }

  return transfers;
}

async function analyzeTransaction(tx, options = {}) {
  if (!tx) return null;

  const pairToContractMap = options.pairToContractMap || buildPairToContractMap(options.pairs);
  const tokenTransfers = analyzeTokenTransfers(tx);
  if (!tokenTransfers.length) return null;

  const tokenRecord = tokenTransfers.find((transfer) => {
    const ownerLower = String(transfer.owner || '').toLowerCase();
    const mintLower = String(transfer.mint || '').toLowerCase();
    if (!pairToContractMap.has(ownerLower)) return false;
    return pairToContractMap.get(ownerLower) === mintLower;
  });

  if (!tokenRecord) return null;

  const ownerLower = String(tokenRecord.owner || '').toLowerCase();
  const solRecord = tokenTransfers.find((transfer) => (
    String(transfer.owner || '').toLowerCase() === ownerLower &&
    String(transfer.mint || '').toLowerCase() === WSOL_MINT.toLowerCase()
  ));

  if (!solRecord) return null;

  const price = solRecord.change !== 0
    ? Math.abs(solRecord.change * (solPriceCache.getPrice() || 1) / tokenRecord.change)
    : null;

  return {
    source: tx.source,
    signature: tx.signature,
    slot: tx.slot,
    pair: tokenRecord.owner,
    contract: tokenRecord.mint,
    tokenChange: tokenRecord.change,
    solChange: solRecord.change,
    price,
    needsRpcEnrichment: tx.needsRpcEnrichment === true,
    tokenTransfers
  };
}

module.exports = {
  analyzeTransaction,
  analyzeTokenTransfers,
  buildPairToContractMap
};
