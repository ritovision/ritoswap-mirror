import fs from "fs";
import path from "path";

export function getHomepageJsonLd() {
  let jsonLdScripts = [];

  try {
    const jsonldDir = path.join(process.cwd(), "public", "jsonld", "homepage-jsonld");

    if (!fs.existsSync(jsonldDir)) {
      console.warn(`⚠️ Homepage JSON-LD directory not found: ${jsonldDir}`);
      return [];
    }

    const files = fs.readdirSync(jsonldDir);
    jsonLdScripts = files
      .filter((file) => file.endsWith(".txt"))
      .map((file) => {
        const filePath = path.join(jsonldDir, file);
        const content = fs.readFileSync(filePath, "utf-8").trim();

        if (!content) {
          console.warn(`⚠️ Skipping empty file: ${file}`);
          return null;
        }

        try {
          return JSON.parse(content);
        } catch (error) {
          console.error(`❌ Invalid JSON in homepage JSON-LD file: ${file}`, error);
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    console.error("❌ Error reading homepage JSON-LD files:", error);
  }

  return jsonLdScripts;
}
