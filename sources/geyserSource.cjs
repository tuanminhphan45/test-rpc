const { SolanaGrpcClient } = require('../parseGrpc/solanaGrpcClient.cjs');
const appConfig = require('../config.cjs');

function startGeyserSource(onTransaction, options = {}) {
  const grpcClient = new SolanaGrpcClient({
    addr: options.addr || appConfig.geyser.endpoint || appConfig.grpc.addr,
    commitment: options.commitment || appConfig.grpc.commitment,
    token: options.token || appConfig.grpc.token
  });

  grpcClient.start((tx) => {
    onTransaction({
      source: 'geyser',
      ...tx
    });
  });

  return grpcClient;
}

module.exports = { startGeyserSource };
