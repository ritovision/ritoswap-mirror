// dapp/pinecone/clear-namespace.ts
import "dotenv/config";
import { Pinecone } from "@pinecone-database/pinecone";

function parseNamespaces(): string[] {
  const raw = process.env.PINECONE_INDEX_1_NAMESPACES || "";
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

async function main() {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_1_NAME;
  const [, , namespace] = process.argv;

  if (!apiKey || !indexName) {
    console.error("Missing env: PINECONE_API_KEY and/or PINECONE_INDEX_1_NAME");
    process.exit(1);
  }
  const allowed = parseNamespaces();
  if (!namespace) {
    console.error("Usage: npx tsx pinecone/clear-namespace.ts <namespace>");
    console.error("Allowed namespaces:", allowed.join(", "));
    process.exit(1);
  }
  if (!allowed.includes(namespace)) {
    console.error(`Namespace "${namespace}" not permitted. Allowed: ${allowed.join(", ")}`);
    process.exit(1);
  }

  const pc = new Pinecone({ apiKey });
  const index = pc.index(indexName);

  console.warn(`Deleting ALL vectors in ${indexName}/${namespace} — DESTRUCTIVE`);
  await index.namespace(namespace).deleteAll();
  console.log(`Deleted all vectors in ${indexName}/${namespace}`);
}

main().catch(e => { console.error(e); process.exit(1); });
