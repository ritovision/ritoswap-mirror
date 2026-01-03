// pineapple/create-index.ts — create index using PINECONE_INDEX_1_NAME only
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

  await pc.createIndex({
    name: indexName,
    dimension: 1024, // multilingual-e5-large
    metric: "cosine",
    spec: {
      serverless: {
        cloud: (process.env.PINECONE_CLOUD || "aws") as "aws" | "gcp" | "azure",
        region: process.env.PINECONE_REGION || "us-east-1",
      },
    },
    waitUntilReady: true,
    suppressConflicts: true,
  });

  console.log("Index ready:", indexName);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
