/**
 * gRPC Transaction Parser
 * Parse gRPC Yellowstone message và extract thông tin cần thiết
 * 
 * Strategy: Hybrid approach
 * 1. Nhận raw gRPC message
 * 2. Convert sang JSON string
 * 3. Parse bằng logic tương tự tx_parser nhưng được tối ưu lại
 * 4. Return structured data để áp dụng logic của parseTx
 */

'use strict';

class GrpcTxParser {
  constructor() {
    // Base58 alphabet
    this.B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  }

  /**
   * Parse gRPC message thành transaction data
   * @param {Object} grpcMsg - Raw gRPC message
   * @returns {Object|null} Parsed transaction data
   */
  parseGrpcMessage(grpcMsg) {
    try {
      // Convert to JSON string và parse lại (để revive buffers)
      const msgStr = JSON.stringify(grpcMsg);
      const parsed = JSON.parse(msgStr);
      
      // Extract transaction data
      return this._extractTransactionData(parsed);
    } catch (error) {
      console.error('Parse error:', error.message);
      return null;
    }
  }

  /**
   * Extract transaction data từ parsed message
   */
  _extractTransactionData(root) {
    // Navigate nested structure
    const top = this._pick(root, ['transaction']) ?? root;
    const txInner = this._pick(top, ['transaction']) ?? top;
    const meta = this._pick(txInner, ['meta']) ?? 
                 this._pick(top, ['meta']) ?? 
                 this._pick(root, ['meta']);

    // Signature
    const sigBuf = this._pick(txInner, ['signature']) ??
                   (this._pick(txInner, ['transaction'])?.signatures?.[0]) ??
                   null;
    const signature = this._bytesToBase58(sigBuf);

    // Slot
    const slot = this._pick(top, ['slot']) ?? 
                 this._pick(root, ['context'])?.slot ?? 
                 0;

    // Error status
    const err = this._pick(txInner, ['err']) ??
                this._pick(top, ['err']) ??
                this._pick(root, ['err']) ??
                meta?.err ?? null;

    // Message và account keys
    const message = this._pick(this._pick(txInner, ['transaction']) ?? txInner, ['message']);
    const accountKeysRaw = this._pick(message, ['account_keys', 'accountKeys', 'static_account_keys', 'staticAccountKeys']) ?? [];
    
    const accountKeys = accountKeysRaw.map(key => {
      const buf = this._asBuf(key);
      return buf ? this._bytesToBase58(buf) : null;
    }).filter(k => k !== null);

    // Balances
    const preBalances = this._pick(meta, ['pre_balances', 'preBalances']) ?? [];
    const postBalances = this._pick(meta, ['post_balances', 'postBalances']) ?? [];

    // Token balances
    const preTok = this._normalizeTokenBalances(
      this._pick(meta, ['pre_token_balances', 'preTokenBalances']) ?? []
    );
    const postTok = this._normalizeTokenBalances(
      this._pick(meta, ['post_token_balances', 'postTokenBalances']) ?? []
    );

    // Fee
    const fee = this._pick(meta, ['fee']) ?? 0;

    // Instructions (if needed)
    const instructions = this._pick(message, ['instructions', 'compiledInstructions']) ?? [];

    return {
      signature,
      slot,
      blockTime: (() => { try { const top = this._pick(root, ['transaction']) ?? root; const meta = this._pick(top, ['meta']) ?? this._pick(root, ['meta']); const bt = this._pick(top, ['blockTime']) ?? this._pick(root, ['blockTime']) ?? this._pick(meta, ['blockTime']) ?? (this._pick(root, ['block','blockTime']) ?? null); return (typeof bt === 'number' && bt > 0) ? bt : Math.floor(Date.now()/1000); } catch(e) { return Math.floor(Date.now()/1000); } })(),
      status: err ? 'Failed' : 'Success',
      fee,
      accountKeys,
      preBalances,
      postBalances,
      preTokenBalances: preTok,
      postTokenBalances: postTok,
      instructions,
      meta: {
        err,
        fee,
        preBalances,
        postBalances,
        preTokenBalances: preTok,
        postTokenBalances: postTok
      }
    };
  }

  /**
   * Normalize token balances để có format chuẩn
   */
  _normalizeTokenBalances(balances) {
    if (!balances || !Array.isArray(balances)) return [];
    
    return balances.map(b => {
      const accountIndex = b.account_index ?? b.accountIndex ?? 0;
      
      // Mint
      const mintBuf = this._asBuf(b.mint);
      const mint = mintBuf ? this._bytesToBase58(mintBuf) : (b.mint || '');
      
      // Owner (quan trọng!)
      const ownerBuf = this._asBuf(b.owner);
      const owner = ownerBuf ? this._bytesToBase58(ownerBuf) : (b.owner || '');
      
      // UI Token Amount
      const uiTokenAmount = b.ui_token_amount || b.uiTokenAmount || {};
      const decimals = uiTokenAmount.decimals ?? 0;
      const uiAmount = parseFloat(uiTokenAmount.ui_amount || uiTokenAmount.uiAmount || 0);
      const amount = uiTokenAmount.amount || '0';
      
      return {
        accountIndex,
        mint,
        owner,
        decimals,
        uiTokenAmount: {
          uiAmount,
          decimals,
          amount
        }
      };
    }).filter(b => b.mint && b.owner); // Chỉ lấy những balance có đủ mint và owner
  }

  /**
   * Analyze token transfers từ pre/post balances
   */
  analyzeTokenTransfers(parsedTx) {
    if (!parsedTx || !parsedTx.preTokenBalances || !parsedTx.postTokenBalances) {
      return [];
    }

    const transfers = [];
    
    parsedTx.postTokenBalances.forEach(postBalance => {
      const preBalance = parsedTx.preTokenBalances.find(
        pre => pre.accountIndex === postBalance.accountIndex &&
               pre.mint === postBalance.mint
      );

      if (preBalance) {
        const preAmount = parseFloat(preBalance.uiTokenAmount.uiAmount || 0);
        const postAmount = parseFloat(postBalance.uiTokenAmount.uiAmount || 0);
        const change = postAmount - preAmount;

        if (change !== 0) {
          transfers.push({
            accountIndex: postBalance.accountIndex,
            tokenAccount: parsedTx.accountKeys[postBalance.accountIndex],
            owner: postBalance.owner,
            mint: postBalance.mint,
            change: change,
            decimals: postBalance.uiTokenAmount.decimals,
            preBalance: preAmount,
            postBalance: postAmount
          });
        }
      } else {
        // New account (không có pre balance)
        const postAmount = parseFloat(postBalance.uiTokenAmount.uiAmount || 0);
        if (postAmount !== 0) {
          transfers.push({
            accountIndex: postBalance.accountIndex,
            tokenAccount: parsedTx.accountKeys[postBalance.accountIndex],
            owner: postBalance.owner,
            mint: postBalance.mint,
            change: postAmount,
            decimals: postBalance.uiTokenAmount.decimals,
            preBalance: 0,
            postBalance: postAmount
          });
        }
      }
    });

    return transfers;
  }

  /**
   * Analyze SOL transfers từ balance changes
   */
  analyzeSolTransfers(parsedTx) {
    if (!parsedTx || !parsedTx.preBalances || !parsedTx.postBalances) {
      return [];
    }

    const transfers = [];
    const LAMPORTS_PER_SOL = 1000000000;

    parsedTx.postBalances.forEach((postBalance, index) => {
      const preBalance = parsedTx.preBalances[index] || 0;
      const change = (postBalance - preBalance) / LAMPORTS_PER_SOL;

      if (change !== 0 && index < parsedTx.accountKeys.length) {
        transfers.push({
          accountIndex: index,
          account: parsedTx.accountKeys[index],
          change: change,
          preBalance: preBalance / LAMPORTS_PER_SOL,
          postBalance: postBalance / LAMPORTS_PER_SOL
        });
      }
    });

    return transfers;
  }

  // ===== Helper methods =====

  _pick(obj, keys) {
    if (!obj) return null;
    for (const k of keys) {
      if (obj[k] !== undefined) return obj[k];
    }
    return null;
  }

  _asBuf(input) {
    if (input == null) return null;
    if (Buffer.isBuffer(input)) return input;
    if (input instanceof Uint8Array) return Buffer.from(input);
    if (Array.isArray(input)) return Buffer.from(input);
    if (typeof input === 'object' && input.type === 'Buffer' && Array.isArray(input.data)) {
      return Buffer.from(input.data);
    }
    return null;
  }

  _bytesToBase58(input) {
    const buf = this._asBuf(input);
    if (!buf) return '';
    
    // Leading zeros -> '1'
    let zeros = 0;
    while (zeros < buf.length && buf[zeros] === 0) zeros++;
    
    // Bytes -> BigInt
    let x = 0n;
    for (const b of buf) x = (x << 8n) + BigInt(b);
    
    // Base58
    let out = '';
    while (x > 0n) {
      const mod = x % 58n;
      out = this.B58[Number(mod)] + out;
      x /= 58n;
    }
    
    for (let i = 0; i < zeros; i++) out = '1' + out;
    return out;
  }
}

module.exports = GrpcTxParser;

