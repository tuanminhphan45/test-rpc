const { normalizeTransaction } = require('../core/normalizeTransaction.cjs');
const {
  analyzeTransaction: analyzeNormalizedTransaction,
  buildPairToContractMap
} = require('../core/analyzeTransaction.cjs');

async function analyzeTransaction(parsedTx, pairToContractMap = null, verbose = false) {
  const normalized = await normalizeTransaction(parsedTx);
  return analyzeNormalizedTransaction(normalized, {
    pairToContractMap: pairToContractMap || buildPairToContractMap(),
    verbose
  });
}

module.exports = {
  analyzeTransaction
};
