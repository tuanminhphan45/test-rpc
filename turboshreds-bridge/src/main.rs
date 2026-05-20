use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use serde::Serialize;
use std::env;
use std::io::{self, Write};
use turboshreds_sdk::{Client, Event, Subscription, Transaction};

const DEFAULT_ADDR: &str = "shreds.turboshreds.wtf:50051";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeInstruction {
    program_id: Option<String>,
    accounts: Vec<String>,
    data_base64: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeTransaction {
    source: &'static str,
    slot: u64,
    signature: String,
    num_instructions: u16,
    num_static_keys: u8,
    num_alt_accounts: usize,
    accounts: Vec<String>,
    instructions: Vec<BridgeInstruction>,
    alt_accounts: Vec<String>,
    raw_transaction_base64: String,
    has_meta: bool,
    meta: Option<serde_json::Value>,
}

fn main() -> io::Result<()> {
    let addr = env::var("TURBOSHREDS_ADDR").unwrap_or_else(|_| DEFAULT_ADDR.to_string());
    let include_env = env::var("TURBOSHREDS_INCLUDE").unwrap_or_default();
    let include: Vec<&str> = include_env
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect();

    let sub = match Subscription::from_strs(&include, &[], &[]) {
        Ok(sub) => sub,
        Err(error) => {
            eprintln!("invalid TURBOSHREDS_INCLUDE: {error}");
            return Err(io::Error::new(io::ErrorKind::InvalidInput, error));
        }
    };

    eprintln!("connecting addr={addr} include_count={}", include.len());
    let mut client = Client::connect(addr, sub)?;
    eprintln!("connected");

    loop {
        client.next(|event| match event {
            Event::Transaction(tx) => {
                if let Err(error) = write_transaction(tx) {
                    eprintln!("write transaction error: {error}");
                }
            }
            Event::Heartbeat => {
                eprintln!("heartbeat");
            }
            Event::ServerError(message) => {
                eprintln!("server error: {message}");
            }
        })?;
    }
}

fn write_transaction(tx: Transaction<'_>) -> io::Result<()> {
    let bridge_tx = to_bridge_transaction(tx);
    let line = serde_json::to_string(&bridge_tx)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;

    let mut stdout = io::stdout().lock();
    stdout.write_all(line.as_bytes())?;
    stdout.write_all(b"\n")?;
    stdout.flush()
}

fn to_bridge_transaction(tx: Transaction<'_>) -> BridgeTransaction {
    let static_accounts = extract_static_accounts(&tx);
    let alt_accounts: Vec<String> = tx.alt_accounts().iter().map(pubkey_to_base58).collect();
    let accounts = static_accounts
        .iter()
        .chain(alt_accounts.iter())
        .cloned()
        .collect::<Vec<_>>();

    let instructions = tx.instructions()
        .map(|ix| {
            let program_id = accounts.get(ix.program_id_index() as usize).cloned();
            let ix_accounts = ix.accounts()
                .iter()
                .filter_map(|index| accounts.get(*index as usize).cloned())
                .collect::<Vec<_>>();

            BridgeInstruction {
                program_id,
                accounts: ix_accounts,
                data_base64: BASE64.encode(ix.data()),
            }
        })
        .collect::<Vec<_>>();

    BridgeTransaction {
        source: "turboshreds",
        slot: tx.slot(),
        signature: bs58::encode(tx.signature()).into_string(),
        num_instructions: tx.num_instructions(),
        num_static_keys: tx.num_static_keys(),
        num_alt_accounts: tx.num_alt_accounts(),
        accounts,
        instructions,
        alt_accounts,
        raw_transaction_base64: BASE64.encode(tx.data()),
        has_meta: false,
        meta: None,
    }
}

fn extract_static_accounts(tx: &Transaction<'_>) -> Vec<String> {
    let start = tx.static_keys_offset() as usize;
    let count = tx.num_static_keys() as usize;
    let end = start.saturating_add(count * 32);
    let data = tx.data();

    if end > data.len() {
        eprintln!(
            "static account slice out of range: start={start} count={count} data_len={}",
            data.len()
        );
        return Vec::new();
    }

    data[start..end]
        .chunks_exact(32)
        .map(pubkey_bytes_to_base58)
        .collect()
}

fn pubkey_to_base58(pubkey: &[u8; 32]) -> String {
    bs58::encode(pubkey).into_string()
}

fn pubkey_bytes_to_base58(pubkey: &[u8]) -> String {
    bs58::encode(pubkey).into_string()
}
