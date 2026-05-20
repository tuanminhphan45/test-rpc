#!/usr/bin/env node
/**
 * Main entry point - Solana Transaction Monitor via gRPC
 * 
 * Script này sử dụng parseGrpc để phân tích giao dịch real-time từ Solana gRPC (port 10000)
 * Đầu ra: Thông tin mua/bán token trên mạng Solana
 */

const { SolanaGrpcClient } = require('./parseGrpc/solanaGrpcClient.cjs');
const { analyzeTransaction } = require('./parseGrpc/index.cjs');
const appConfig = require('./config.cjs');
const solPriceCache = require('./cache/solPriceCache.cjs');
const { createLogger, transports, format } = require('winston');
const { Connection, PublicKey } = require('@solana/web3.js');

const logger = createLogger({
  format: format.combine(format.timestamp(), format.simple()),
  transports: [
    new transports.File({ filename: 'app.log' }),
  ],
});

// ============================
// CONFIGURATION
// ============================

// Cấu hình
const GRPC_ADDR = appConfig.grpc.addr;
const COMMITMENT = appConfig.grpc.commitment;
const GRPC_TOKEN = appConfig.grpc.token;
const PAIR_FILTER = appConfig.filters.pairFilter;
const CONTRACT_FILTER = appConfig.filters.contractFilter;
const VERBOSE = appConfig.runtime.verbose;

// ============================
// CUSTOM TRANSACTION HANDLER
// ============================

/**
 * Xử lý khi phát hiện transaction mua/bán token
 * @param {Object} transaction - Transaction data
 */
function handleTokenTransaction(transaction) {
  const { signature, slot, blockTime, pair, contract, tokenChange, solChange, tokenTransfers } = transaction;

  //console.log(`${JSON.stringify(transaction)}`)
  if (transaction.tokenChange * transaction.solChange < 0) {
    // calculate sol/usdc
    if (transaction.pair === appConfig.solPair) {
      solPrice = Math.abs(transaction.tokenChange / transaction.solChange);
      solPriceCache.setPrice(solPrice);
      // console.log(`${solPriceCache.getPrice()}`);
    } else {
      console.log(`tokenChange ${transaction.tokenChange} solChange ${transaction.solChange} price ${transaction.price}`);
    }
  }
}

// ============================
// START MONITOR
// ============================

function main() {
  console.log('🚀 SOLANA TOKEN TRANSACTION MONITOR');
  console.log('═'.repeat(80));
  console.log(`📡 gRPC Server: ${GRPC_ADDR}`);
  console.log(`🔧 Commitment: ${COMMITMENT}`);
  console.log(`👤 Signer Filter: ${PAIR_FILTER || 'ALL (Monitor tất cả)'}`);
  console.log(`🎯 Contract Filter: ${CONTRACT_FILTER || 'ALL (Monitor tất cả)'}`);
  console.log(`📊 Verbose Mode: ${VERBOSE ? 'ON' : 'OFF'}`);
  console.log('═'.repeat(80));
  console.log('\n⏳ Đang kết nối và chờ transactions...\n');

  // TẠO CLIENT TRỰC TIẾP
  const grpcClient = new SolanaGrpcClient({
    addr: GRPC_ADDR,
    commitment: COMMITMENT,
    token: GRPC_TOKEN
  });

  const pairs = [
    { pair: '7yWTzFjqAKFRquWA57QWt5Qcs3nkMMmXwxw95kcsgP8d', contract: '3wppuwUMAGgxnX75Aqr4W91xYWaN6RjxjCUFiPZUpump' }
  ];
  const pairToContractMap = new Map(
    pairs.map(({ pair, contract }) => [pair.toLowerCase(), contract.toLowerCase()])
  );
  
  // START với callback TRỰC TIẾP
  grpcClient.start((parsedTx) => {
    // Phân tích
    const result = analyzeTransaction(
      parsedTx,
      pairToContractMap,  
      false
    );

    if (result) {
      // handleTokenTransaction(result);
    }
  });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Đang dừng monitor...');
    grpcClient.stop();
    console.log('✅ Đã dừng thành công!');
    process.exit(0);
  });

  // THÊM ĐOẠN NÀY
  process.on('SIGTERM', () => {
    console.log('\n\n🛑 Đang dừng monitor...');
    grpcClient.stop();
    console.log('✅ Đã dừng thành công!');
    process.exit(0);
  });
}

if (require.main === module) {
  //main();
  // analyzeTransaction(
  //     '',
  //     '',  
  //     false
  //   );
  const tokenPubkey = new PublicKey("ENmCj3nV4snJrStksotVh3yLZBQw5G7Bsn9J2rD3r6oQ");
  const solPubkey = new PublicKey("6hXjc15g97u1XHb22aKrLr7HcDjYZj4Gm8AYwL7FYAdi");
  console.log(`tokenPubkey: ${tokenPubkey.toBase58()}`);
  console.log(`tokenPubkey: ${solPubkey.toBase58()}`);
}

