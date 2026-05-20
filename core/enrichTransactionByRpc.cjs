const axios = require('axios');
const appConfig = require('../config.cjs');

async function enrichTransactionByRpc(signature, rpcEndpoint = appConfig.rpc.endpoint) {
  if (!signature) return null;

  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getTransaction',
    params: [
      signature,
      {
        encoding: 'jsonParsed',
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      }
    ]
  };

  try {
    const response = await axios.post(rpcEndpoint, body, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.data?.error) {
      console.error('[rpc-enrich] getTransaction error:', response.data.error);
      return null;
    }

    return response.data?.result || null;
  } catch (error) {
    console.error('[rpc-enrich] request failed:', error.message);
    return null;
  }
}

function normalizeRpcTransaction(rpcTx, fallback = {}) {
  if (!rpcTx) return null;

  const message = rpcTx.transaction?.message || {};
  const meta = rpcTx.meta || {};
  const accountKeys = (message.accountKeys || []).map((key) => (
    typeof key === 'string' ? key : key.pubkey
  )).filter(Boolean);

  return {
    source: fallback.source || 'rpc',
    signature: fallback.signature || rpcTx.transaction?.signatures?.[0] || null,
    slot: fallback.slot || rpcTx.slot || null,
    accountKeys,
    instructions: message.instructions || [],
    preBalances: meta.preBalances || [],
    postBalances: meta.postBalances || [],
    preTokenBalances: meta.preTokenBalances || [],
    postTokenBalances: meta.postTokenBalances || [],
    innerInstructions: meta.innerInstructions || [],
    logs: meta.logMessages || [],
    status: meta.err ? 'Failed' : 'Success',
    raw: rpcTx,
    needsRpcEnrichment: false
  };
}

module.exports = {
  enrichTransactionByRpc,
  normalizeRpcTransaction
};
