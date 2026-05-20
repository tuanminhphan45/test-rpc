/**
 * Main entry point - Phân tích giao dịch Solana từ gRPC (port 10000)
 */
const { SolanaGrpcClient } = require('./solanaGrpcClient.cjs');
const solPriceCache = require('../cache/solPriceCache.cjs');
const { Connection, PublicKey } = require('@solana/web3.js');

let sharedGrpcClient = null;
function getSharedGrpcClient() {
  if (!sharedGrpcClient) {
    sharedGrpcClient = new SolanaGrpcClient();
  }
  return sharedGrpcClient;
}

// Lưu lại số dư lần trước để tính chênh lệch cho lần kế tiếp
let lastTokenBalance = null;
let lastSolBalance = null;

/**
 * Xử lý và phân tích một transaction từ gRPC
 * @param {Object} parsedTx - Parsed transaction from gRPC
 * @param {string} contractX - Optional: Contract address để filter
 * @param {string} signerX - Optional: Signer address để filter (set 'none' để không filter)
 * @param {boolean} verbose - In ra chi tiết hay không
 * @returns {Object|null} Transaction analysis result
 */
// pairToContractMap: Map<string, string>  // key = pair (owner), value = contract (mint)
// Yêu cầu: cả pair và contract so sánh lowercase
function analyzeTransaction(parsedTx, pairToContractMap = null, verbose = false) {
  try {
    const mintKey = 'So11111111111111111111111111111111111111112'; // WSOL
    if (!parsedTx) return null;

    const signature = parsedTx.signature;

    const grpcClient = getSharedGrpcClient();
    const tokenTransfers = grpcClient.analyzeTokenTransfers(parsedTx);
    if (!tokenTransfers || tokenTransfers.length === 0) return null;

    if (pairToContractMap && pairToContractMap.size > 0) {
      // Tìm tokenRecord khớp (pair -> contract)
      const tokenRecord = tokenTransfers.find(t => {
        const ownerLower = (t.owner || '').toLowerCase();
        const mintLower = (t.mint || '').toLowerCase();
        if (!pairToContractMap.has(ownerLower)) return false; // tương đương t.owner === pairX
        const expectedContract = (pairToContractMap.get(ownerLower) || '').toLowerCase();
        return expectedContract === mintLower;
      });

      if (!tokenRecord) return null;
  

      // Lấy solRecords (WSOL) cho cùng owner
      const ownerLower = (tokenRecord.owner || '').toLowerCase();
      const solRecords = tokenTransfers.find(t =>
        (t.owner || '').toLowerCase() === ownerLower &&
        (t.mint || '').toLowerCase() === mintKey.toLowerCase()
      );
      
      if (solRecords === undefined)
        return null;

      {
    const connection = new Connection('http://192.168.1.6:8899', "confirmed");
    const tokenPubkey = new PublicKey("ENmCj3nV4snJrStksotVh3yLZBQw5G7Bsn9J2rD3r6oQ");
    const solPubkey = new PublicKey("6hXjc15g97u1XHb22aKrLr7HcDjYZj4Gm8AYwL7FYAdi");


    let tokenBalance = 0;
    let solBalance = 0;

    connection.getTokenAccountBalance(tokenPubkey)
      .then(res => {
        tokenBalance = res.value.uiAmount;
        return connection.getTokenAccountBalance(solPubkey);
      })
      .then(res => {
        solBalance = res.value.uiAmount;
        const price = tokenBalance !== 0 ? (solBalance / tokenBalance) : null;

        // Tính chênh lệch so với lần gọi trước (nếu đã có)
        if (lastTokenBalance !== null && lastSolBalance !== null) {
          const deltaSol = solBalance - lastSolBalance;
          const deltaToken = tokenBalance - lastTokenBalance;
          const ratioSol = lastSolBalance !== 0 ? (deltaSol / lastSolBalance) : null;
          const ratioToken = lastTokenBalance !== 0 ? (deltaToken / lastTokenBalance) : null;

          console.log(
            `Price: ${price} | ΔSOL: ${deltaSol} (${ratioSol !== null ? (ratioSol * 100).toFixed(4) + '%': 'N/A'}) | ΔToken: ${deltaToken} (${ratioToken !== null ? (ratioToken * 100).toFixed(4) + '%': 'N/A'})`
          );
        } else {
          console.log(`Price: ${price}`);
        }

        // Cập nhật số dư làm mốc cho lần kế tiếp
        lastTokenBalance = tokenBalance;
        lastSolBalance = solBalance;
      })
      .catch(err => {
        console.error("Error fetching balances:", err);
      });
    }

      // Tuỳ bạn muốn trả về gì cho luồng gọi (giữ nguyên null/undefined như hiện tại nếu chỉ lọc)
      //return { signature, tokenRecord, solRecords };
      // return {
      //   signature,
      //   slot: parsedTx.slot,
      //   //blockTime: parsedTx.blockTime,
      //   blockTime: new Date(Number(parsedTx.blockTime) * 1000)
      //   .toLocaleTimeString('vi-VN', { hour12: false }),
      //   pair: tokenRecord.owner,
      //   contract: tokenRecord.mint,
      //   tokenChange: tokenRecord.change,
      //   solChange: solRecords.change,
      //   price: solRecords.change !== 0 ? Math.abs(solRecords.change * solPriceCache.getPrice() / tokenRecord.change) : null,
      //   tokenTransfers,
      // }

      return null;
    }

    // Không có filter map → giữ nguyên hành vi cũ nếu có
  } catch (error) {
    console.error('Error analyzing transaction:', error.message);
    return null;
  }
}

module.exports = {
  analyzeTransaction
};

