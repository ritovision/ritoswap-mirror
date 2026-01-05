// scripts/check-env.ts
import "dotenv/config";            // so local .env works
import { validateEnvironment } from "@app/config/validate";

(async () => {
  await validateEnvironment();
  console.log("✅ env OK");
})().catch(err => {
  console.error("❌ env invalid:", err);
  process.exit(1);
});
