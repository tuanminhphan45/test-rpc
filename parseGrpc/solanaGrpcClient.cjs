/**
 * Solana gRPC Client - Nhận dữ liệu real-time từ Geyser gRPC (port 10000)
 */
const fs = require('fs');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const GrpcTxParser = require('./grpcTxParser.cjs');
const appConfig = require('../config.cjs');

class SolanaGrpcClient {
  constructor(options = {}) {
    this.addr = options.addr || appConfig.grpc.addr;
    this.token = options.token || appConfig.grpc.token;
    this.commitment = (options.commitment || appConfig.grpc.commitment).toUpperCase();
    this.protoPath = options.protoPath || path.resolve(appConfig.grpc.protoPath);
    this.protoPath2 = options.protoPath2 || path.resolve(appConfig.grpc.protoPath2);

    // Kiểm tra proto files
    for (const p of [this.protoPath, this.protoPath2]) {
      if (!fs.existsSync(p)) {
        throw new Error(`Missing proto file: ${p}`);
      }
    }

    // Load proto files
    const pkgDef = protoLoader.loadSync([this.protoPath, this.protoPath2], {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    
    const loaded = grpc.loadPackageDefinition(pkgDef);
    this.GeyserSvc = loaded?.geyser?.Geyser || loaded?.Geyser;
    
    if (!this.GeyserSvc) {
      throw new Error('Service geyser.Geyser not found in proto');
    }

    // Tạo gRPC client
    this.client = new this.GeyserSvc(this.addr, grpc.credentials.createInsecure());
    this.meta = new grpc.Metadata();
    if (this.token) this.meta.add('x-token', this.token);

    // Runtime state
    this.call = null;
    this.pingTimer = null;
    this.backoffMs = 1000;
    this._closing = false;
    this.onTransaction = null;
    
    // Parser instance
    this.parser = new GrpcTxParser();
  }

  

  /**
   * Tạo subscribe request
   */
  buildSubscribeRequest() {
    const txFilter = { vote: false, failed: false };
    return {
      commitment: this.commitment,
      transactions: { t1: txFilter },
      accounts_data_slice: [],
    };
  }

  /**
   * Parse transaction data từ gRPC message
   * Sử dụng GrpcTxParser để parse message
   */
  parseGrpcTransaction(msg) {
    return this.parser.parseGrpcMessage(msg);
  }


  /**
   * Phân tích token transfers
   * Delegate to parser
   */
  analyzeTokenTransfers(parsedTx) {
    return this.parser.analyzeTokenTransfers(parsedTx);
  }

  /**
   * Xử lý message từ gRPC stream
   */
  _handleMessage(msg) {
    try {
      const parsedTx = this.parseGrpcTransaction(msg);
      if (parsedTx && typeof this.onTransaction === 'function') {
        this.onTransaction(parsedTx);
      }
    } catch (error) {
      console.error('Error handling message:', error.message);
    }
  }

  /**
   * Kết nối gRPC stream
   */
  _connectOnce() {
    const open = this.client.subscribe || this.client.Subscribe;
    if (!open) {
      throw new Error('Client has neither subscribe nor Subscribe method');
    }

    this.call = open.call(this.client, this.meta);

    this.call.on('metadata', () => {
      console.log('✅ gRPC connected');
      this.backoffMs = 1000;
    });

    this.call.on('data', (msg) => {
      this._handleMessage(msg);
    });

    this.call.on('error', (e) => {
      if (this._closing) return;
      console.error('❌ Stream error:', e?.details || e?.message || e);
      this._reconnect();
    });

    this.call.on('end', () => {
      if (this._closing) return;
      console.log('ℹ️  Stream ended by server');
      this._reconnect();
    });

    // Gửi subscribe request
    const req = this.buildSubscribeRequest();
    this.call.write(req, (err) => {
      if (err) console.error('❌ Write request error:', err?.message || err);
      else console.log('✅ Subscribed to transactions');
    });

    // Ping để giữ kết nối
    this.pingTimer = setInterval(() => {
      if (!this.call) return;
      this.call.write({ ping: { id: Date.now() } }, (err) => {
        if (err) console.error('Ping error:', err?.message || err);
      });
    }, 30000);
  }

  /**
   * Cleanup resources
   */
  _cleanup() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.call) {
      try {
        this.call.end?.();
      } catch {}
      this.call = null;
    }
  }

  /**
   * Reconnect with backoff
   */
  _reconnect() {
    this._cleanup();
    const ms = Math.min(this.backoffMs, 30000);
    console.log(`ℹ️  Reconnecting in ${ms}ms...`);
    setTimeout(() => {
      if (!this._closing) this._connectOnce();
    }, ms);
    this.backoffMs *= 2;
  }

  /**
   * Bắt đầu nhận transactions
   */
  start(onTransaction) {
    if (typeof onTransaction === 'function') {
      this.onTransaction = onTransaction;
    }

    console.log(`🚀 Connecting to gRPC: ${this.addr}`);
    console.log(`📡 Commitment: ${this.commitment}`);
    this._connectOnce();

    // Graceful shutdown
    const onSig = () => {
      console.log('\n🛑 Closing gRPC connection...');
      this._closing = true;
      this._cleanup();
      process.exit(0);
    };
    process.on('SIGINT', onSig);
    process.on('SIGTERM', onSig);
  }

  /**
   * Dừng client
   */
  stop() {
    this._closing = true;
    this._cleanup();
  }
}

module.exports = { SolanaGrpcClient };

