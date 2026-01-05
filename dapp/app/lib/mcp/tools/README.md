# MCP Tools — Key NFT & ETH Utilities

Each entry shows a brief what-it-does, then **Inputs** and **Outputs**.  
Unless noted, results are **JSON** and use the **active network**.

---

## keynft-total-supply.ts → `get_key_nft_total_supply`
**Summary:** Reads the collection’s current `totalSupply()` from the contract.  
**Inputs:** *(none)*  
**Outputs:** `address: string`, `totalSupply: string`

---

## keynft-token-metadata.ts → `get_key_nft_token_metadata`
**Summary:** Fetches a token’s `tokenURI` and/or on-chain color data.  
**Inputs:** `tokenId: string` (req), `includeColors?: boolean` (default `true`), `includeURI?: boolean` (default `true`)  
**Outputs:** `address: string`, `tokenId: string`, `tokenURI?: string`, `colors?: { backgroundColor: string; keyColor: string }`

---

## keynft-owner-tokens.ts → `get_key_nft_tokens_of_owner`
**Summary:** Lists all token IDs owned by a specific address (uses `tokensOfOwner`).  
**Inputs:** `owner: string` (0x… req)  
**Outputs:** `address: string`, `owner: string`, `tokenIds: string[]`

---

## keynft-owner-summary.ts → `get_key_nft_summary_for_owner`
**Summary:** Per-owner snapshot: balance, token IDs, and optional `tokenURI`/colors for up to `maxTokens`.  
**Inputs:** `owner: string` (req), `includeColors?: boolean` (default `true`), `includeURI?: boolean` (default `true`), `maxTokens?: number` (default `50`)  
**Outputs:** `address: string`, `owner: string`, `balance: string`, `tokenIds: string[]`, `enrichedCount: number`,  
`tokens: Array<{ tokenId: string; tokenURI?: string; colors?: { backgroundColor: string; keyColor: string } }>`

---

## keynft-owner-single.ts → `get_key_nft_token_of_owner`
**Summary:** Quick check for one-per-wallet setups: returns the owner’s token (if any).  
**Inputs:** `owner: string` (0x… req)  
**Outputs:** `address: string`, `owner: string`, `tokenId: string`, `hasToken: boolean`

---

## keynft-holders.ts → `get_key_nft_holders`
**Summary:** **Enumerates current holders from contract state** (prefers ERC-721 Enumerable: `tokenByIndex` + `ownerOf`) — no log scanning, free-tier friendly.  
**Inputs:**  
- `startIndex?: number|string` (default `0`) — start position in enumerable index  
- `maxTokens?: number|string` (optional cap; default = scan all)  
- `concurrency?: number` (default `25`, 1–200)  
**Outputs:**  
- `address: string`, `totalSupply: string`, `scanned: string`, `method: "enumerable" | "sequential"`  
- `holders: Array<{ address: string; balance: string }>`  
- `totalHolders: number`

> Note: Falls back to **sequential `ownerOf(tokenId)`** if `tokenByIndex` isn’t available; in that mode it assumes token IDs are dense/sequential from 0. Unminted IDs are skipped if they revert.

---

## keynft-collection-info.ts → `get_key_nft_collection_info`
**Summary:** Reads collection `name()` and `symbol()`.  
**Inputs:** *(none)*  
**Outputs:** `address: string`, `name: string`, `symbol: string`

---

## keynft-balance.ts → `get_key_nft_balance`
**Summary:** Reads `balanceOf(owner)` for the Key NFT.  
**Inputs:** `owner: string` (0x… req)  
**Outputs:** `address: string`, `owner: string`, `balance: string`

---

## eth-balance.ts → `get_eth_balance`
**Summary:** Gets native token balance for an address on a chosen EVM chain.  
**Inputs:** `address: string` (0x… req), `chain?: "mainnet" | "sepolia" | "polygon" | "arbitrum" | "avalanche" | "base" | "optimism" | "fantom" | "ritonet"` (default `mainnet`)  
**Output:** *(TEXT, not JSON)* — `Address {address} on {ChainName} has a balance of {value} {symbol}`
