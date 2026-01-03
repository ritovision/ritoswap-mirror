// dapp/pinecone/seed.ts
/**
 * Seed JSON into Pinecone namespace.
 * Usage:
 *  npx tsx pinecone/seed.ts <jsonPath> <namespace>
 *  OR with npm script (see README)
 *
 * Required env:
 *  - PINECONE_API_KEY
 *  - PINECONE_INDEX_1_NAME
 *  - PINECONE_INDEX_1_NAMESPACES
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { Pinecone } from "@pinecone-database/pinecone";

type Row = { id: string; text: string; metadata?: Record<string, any> };
type PineconeMetadata = Record<string, string | number | boolean | string[]>;

function parseNamespaces(): string[] {
  const raw = process.env.PINECONE_INDEX_1_NAMESPACES || "";
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function sanitizeMetadata(meta: Record<string, any> | undefined): PineconeMetadata {
  const out: PineconeMetadata = {};
  if (!meta) return out;
  for (const [k, v] of Object.entries(meta)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) out[k] = v.map(x => String(x));
    else if (typeof v === "object") out[k] = JSON.stringify(v);
    else out[k] = v as string | number | boolean;
  }
  return out;
}

async function embedBatch(pc: Pinecone, texts: string[]) {
  const resp = await pc.inference.embed(
    "multilingual-e5-large",
    texts,
    { inputType: "passage", truncate: "END" }
  );
  if (resp.vectorType !== "dense") throw new Error(`Expected dense embeddings, got ${resp.vectorType}`);
  return resp.data.map(d => (d as any).values as number[]);
}

async function main() {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_1_NAME;
  const allowedNamespaces = parseNamespaces();

  if (!apiKey || !indexName) {
    console.error("Missing env: PINECONE_API_KEY and/or PINECONE_INDEX_1_NAME");
    process.exit(1);
  }

  // CLI
  const [, , fileArg, nsArg] = process.argv;
  const jsonPath = fileArg || "app/search/ritorhymes.json";
  const namespace = nsArg || (allowedNamespaces.includes("__default__") ? "__default__" : allowedNamespaces[0]);

  if (!allowedNamespaces.includes(namespace)) {
    console.error(`Namespace "${namespace}" not permitted. Allowed: ${allowedNamespaces.join(", ")}`);
    process.exit(1);
  }

  const file = path.resolve(process.cwd(), jsonPath);
  if (!fs.existsSync(file)) {
    console.error("JSON file not found:", file);
    process.exit(1);
  }

  const rows: Row[] = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error("JSON contains no records.");
    process.exit(1);
  }

  const pc = new Pinecone({ apiKey });
  const index = pc.index(indexName);
  const ns = index.namespace(namespace);

  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const texts = batch.map(r => r.text);
    const vectors = await embedBatch(pc, texts);

    const upserts = batch.map((r, idx) => {
      const meta = sanitizeMetadata(r.metadata);
      meta.text = r.text;
      return { id: r.id, values: vectors[idx], metadata: meta };
    });

    await ns.upsert(upserts);
    console.log(`Upserted batch ${i}-${i + upserts.length - 1} into ${indexName}/${namespace}`);
  }

  console.log(`Seed complete: ${rows.length} vectors -> ${indexName}/${namespace}`);
}

main().catch(e => { console.error("Seed failed:", e); process.exit(1); });
