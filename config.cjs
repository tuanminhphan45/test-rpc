/**
 * Configuration file for Solana Geyser monitoring
 * Central place to manage all configuration settings
 */

module.exports = {
  // gRPC settings
  grpc: {
    addr: process.env.GRPC_ADDR || '192.168.1.6:10000',
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

  // Runtime switches
  runtime: {
    verbose: process.env.VERBOSE !== 'false'
  },
  // Pool Monitor Settings
  poolMonitor: {
    enabled: process.env.POOL_MONITOR_ENABLED === 'true' || true,
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
