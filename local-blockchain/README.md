# RitoSwap Local Besu Network

Single-validator QBFT network powered by Hyperledger Besu plus the full Blockscout explorer stack. The workflow mirrors the SuSquares SuNet setup but keeps the RitoSwap naming convention and `.env` driven configuration.

## Prerequisites
- Docker Desktop / Docker Engine (Compose v2)
- Node 18+ (npm, pnpm, or yarn)
- Git (first setup clones Blockscout)

> Ensure Docker Desktop is running before executing any of the commands below.

## Quick Start

```bash
cd local-blockchain
npm install
npm run setup          # generate validator key + genesis, clone Blockscout
npm run start:node     # Besu only
npm run start          # Besu + Blockscout stack
npm run logs           # follow stack logs
npm run stop           # stop full stack
npm run clean          # remove data + Blockscout checkout
```

Access:
- RPC: http://localhost:8545
- WS: ws://localhost:8546
- Blockscout: http://localhost:4001 (set `BLOCKSCOUT_PUBLIC_HOST` to your LAN IP/hostname so phones/tablets resolve assets and APIs)

## Scripts

| Command | Description |
| --- | --- |
| `npm run setup` | Creates `.env`, validator key, genesis, Besu data dir, and clones Blockscout |
| `npm run start` | Runs Besu + Blockscout via `docker-compose.yml` |
| `npm run start:node` | Runs Besu only (`docker-compose.besu.yml`) |
| `npm run stop` / `npm run stop:node` | Stops the chosen stack |
| `npm run logs` / `npm run logs:node` | Follows logs |
| `npm run logs:blockscout` | Tails Blockscout frontend/backend |
| `npm run status` | Shows container status |
| `npm run clean` | Prompts + removes Besu data, validator keys, Blockscout checkout, docker volumes |
| `npm run generate:genesis` | Regenerates `config/genesis.json` from `.env` |
| `npm run reveal:address` / `npm run reveal:key` | Prints validator metadata or the private key (with warnings) |

## Configuration

`local-blockchain/.env.example` contains sane defaults:

```bash
# RitoSwap Local Besu Network
LOCAL_CHAIN_ID=99999991
NETWORK_NAME=RitoSwap Localnet
SUBNETWORK=Local
COIN_NAME=RITO
COIN_SYMBOL=RITO
BLOCK_TIME=5
GENESIS_TIMESTAMP=0

# Ports
RPC_PORT=8545
RPC_WS_PORT=8546
P2P_PORT=30303
BLOCKSCOUT_PORT=4001

# Blockscout
BLOCKSCOUT_TAG=v9.2.2
BLOCKSCOUT_PUBLIC_HOST=localhost   # set to your LAN IP/hostname for mobile access

# Validator (auto-filled by npm run setup)
VALIDATOR_PRIVATE_KEY=
VALIDATOR_ADDRESS=
VALIDATOR_ACCOUNT_BALANCE=

# Prefunded test account
TEST_ACCOUNT=0xee1520c50f0ee31a37fd9699db29b69565c9eda9
TEST_ACCOUNT_BALANCE=10000000000000000000000
TEST_ACCOUNT_PRIVATE_KEY=
```

`npm run setup` copies `.env.example` to `.env` if it does not exist, creates `config/keys/validator.key`, and writes `VALIDATOR_PRIVATE_KEY`/`VALIDATOR_ADDRESS` back to `.env`. The genesis generator pre-funds the validator plus any `TEST_ACCOUNT` you set.

## Design Notes
- Besu runs in archive mode with QBFT consensus so traces and debug APIs are available to Blockscout.
- `docker-compose.besu.yml` can be used when you only want the node; the main `docker-compose.yml` extends the official Blockscout services and proxies them via nginx on `BLOCKSCOUT_PORT`.
- `BLOCKSCOUT_PUBLIC_HOST` is injected into the Blockscout Next.js frontend so assets and API calls work when browsing from a phone/tablet on the same LAN.
- All generated state (validator key, genesis, chain data, Blockscout clone) lives inside this package so `npm run clean` leaves you with a fresh workspace.

## Troubleshooting
- **Docker not running**: start Docker Desktop/daemon before invoking the scripts.
- **Ports already in use**: update `RPC_PORT`, `RPC_WS_PORT`, `P2P_PORT`, or `BLOCKSCOUT_PORT` in `.env` and re-run `npm run start`.
- **Blockscout cannot fetch data on mobile**: set `BLOCKSCOUT_PUBLIC_HOST` to the machine’s LAN IP (e.g. `192.168.1.42`) before running `npm run start`.
- **Changed validator key or chain ID**: run `npm run clean` followed by `npm run setup` to regenerate genesis and keys.
