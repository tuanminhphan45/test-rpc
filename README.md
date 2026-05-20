# test-rpc

Node.js CommonJS monitor for Solana transactions. The default data source is
Yellowstone/Geyser gRPC, with an experimental TurboShreds bridge prepared for
server-side inspection.

## Data Sources

Set `DATA_SOURCE` to choose the transaction stream:

```bash
DATA_SOURCE=geyser npm start
DATA_SOURCE=turboshreds npm start
```

Default endpoints are configured in `config.cjs`:

- Geyser: `192.168.1.6:10000`
- TurboShreds decoded stream: `shreds.turboshreds.wtf:50051`
- RPC enrichment endpoint: `http://tyo.corvus-labs.io:8899`

TurboShreds access is expected to work only from the provider-whitelisted IP.
Do not treat local connection failures as integration failures unless the local
machine is running from that IP.

## TurboShreds Integration Test

Step 1: build bridge

```bash
npm run build:turboshreds
```

Step 2: check network on the whitelisted server

```bash
nc -vz -w 5 shreds.turboshreds.wtf 50051
```

```bash
curl --max-time 10 http://tyo.corvus-labs.io:8899 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

Step 3: inspect data shape

```bash
DATA_SOURCE=turboshreds INSPECT_LIMIT=20 npm run inspect:turboshreds
```

Step 4: run main

```bash
DATA_SOURCE=turboshreds npm start
```

## TurboShreds Notes

The Rust bridge writes transaction JSON lines to stdout and writes heartbeats,
server errors, and warnings to stderr. The Node source parses only stdout, so
the inspect script can safely detect whether TurboShreds can feed the existing
analyzer directly or whether the flow needs RPC enrichment.

Expected inspect recommendation values:

- `direct`: stream has account keys, instructions, SOL balances, and token balances.
- `hybrid-rpc-enrich`: stream has enough keys/instructions to filter first, but
  needs selective `getTransaction` calls for balances.
- `rewrite-instruction-parser`: stream lacks enough decoded structure for the
  current analyzer and needs deeper transaction deserialization/parsing.
