/**
 * Configuration file for Solana Geyser monitoring
 * Central place to manage all configuration settings
 */

module.exports = {
  dataSource: process.env.DATA_SOURCE || 'geyser',

  rpc: {
    endpoint: process.env.SOLANA_RPC_ENDPOINT || 'http://tyo.corvus-labs.io:8899'
  },

  turboshreds: {
    addr: process.env.TURBOSHREDS_ADDR || 'shreds.turboshreds.wtf:50051',
    include: process.env.TURBOSHREDS_INCLUDE
      ? process.env.TURBOSHREDS_INCLUDE.split(',').filter(Boolean)
      : [],
    bridgePath: process.env.TURBOSHREDS_BRIDGE_PATH || './turboshreds-bridge/target/release/turboshreds-bridge'
  },

  geyser: {
    endpoint: process.env.GEYSER_ENDPOINT || process.env.GRPC_ADDR || '192.168.1.6:10000'
  },

  // gRPC settings
  grpc: {
    addr: process.env.GRPC_ADDR || process.env.GEYSER_ENDPOINT || '192.168.1.6:10000',
    token: process.env.GRPC_TOKEN || undefined,
    commitment: (process.env.GRPC_COMMITMENT || 'PROCESSED'),
    protoPath: './lib/geyser.proto',
    protoPath2: './lib/solana-storage.proto'
  },

  // Filters
  filters: {
    pairFilter: process.env.PAIR_FILTER || 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE',
    contractFilter: process.env.CONTRACT_FILTER || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  },

  monitoredPairs: [
    {
      pair: process.env.PAIR_ADDRESS || '7yWTzFjqAKFRquWA57QWt5Qcs3nkMMmXwxw95kcsgP8d',
      contract: process.env.CONTRACT_ADDRESS || '3wppuwUMAGgxnX75Aqr4W91xYWaN6RjxjCUFiPZUpump'
    }
  ],

  // Runtime switches
  runtime: {
    verbose: process.env.VERBOSE !== 'false'
  },
  // Pool Monitor Settings
  poolMonitor: {
    enabled: process.env.POOL_MONITOR_ENABLED === 'true',
    debugMode: process.env.DEBUG_MODE === 'true' || false,
    showStats: process.env.SHOW_STATS === 'true' || false,
    statsInterval: parseInt(process.env.STATS_INTERVAL) || 30000,
    webSocketPort: parseInt(process.env.WS_PORT) || 8080
  },

  // Common settings
  common: {
    gracefulShutdown: true,
    reconnectDelay: 5000,
    maxReconnectAttempts: 10,
  },

  // SOL Address
  solAddress: 'So11111111111111111111111111111111111111112',
  solPair: 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE'
};
