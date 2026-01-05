// dapp/pinecone/check-stats.ts
import "dotenv/config";
import { Pinecone } from "@pinecone-database/pinecone";

async function main() {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_1_NAME;
  if (!apiKey || !indexName) {
    console.error("Missing env: PINECONE_API_KEY and/or PINECONE_INDEX_1_NAME");
    process.exit(1);
  }

  const pc = new Pinecone({ apiKey });
  const index = pc.index(indexName);

  const stats = await index.describeIndexStats();
  console.log(JSON.stringify(stats, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
