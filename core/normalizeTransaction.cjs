function normalizeGeyserTransaction(tx) {
  return {
    source: 'geyser',
    signature: tx.signature || null,
    slot: tx.slot || null,
    accountKeys: tx.accountKeys || [],
    instructions: tx.instructions || [],
    preBalances: tx.preBalances || [],
    postBalances: tx.postBalances || [],
    preTokenBalances: tx.preTokenBalances || [],
    postTokenBalances: tx.postTokenBalances || [],
    innerInstructions: tx.innerInstructions || null,
    logs: tx.logs || null,
    status: tx.status || null,
    raw: tx.raw || tx,
    needsRpcEnrichment: false
  };
}

function normalizeTurboShredsTransaction(tx) {
  const preTokenBalances = tx.preTokenBalances || null;
  const postTokenBalances = tx.postTokenBalances || null;

  return {
    source: 'turboshreds',
    signature: tx.signature || null,
    slot: tx.slot || null,
    accountKeys: tx.accounts || tx.accountKeys || [],
    instructions: tx.instructions || [],
    preBalances: tx.preBalances || null,
    postBalances: tx.postBalances || null,
    preTokenBalances,
    postTokenBalances,
    innerInstructions: tx.innerInstructions || null,
    logs: tx.logs || null,
    status: tx.status || null,
    raw: tx.rawTransactionBase64 || tx.raw || null,
    needsRpcEnrichment: !preTokenBalances || !postTokenBalances
  };
}

async function normalizeTransaction(tx) {
  if (!tx) return null;

  if (tx.source === 'turboshreds' || tx.rawTransactionBase64) {
    return normalizeTurboShredsTransaction(tx);
  }

  return normalizeGeyserTransaction(tx);
}

module.exports = {
  normalizeTransaction,
  normalizeGeyserTransaction,
  normalizeTurboShredsTransaction
};
