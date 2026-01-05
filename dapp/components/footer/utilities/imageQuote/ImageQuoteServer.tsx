import fs from "fs";
import path from "path";
import ImageQuoteClient from "./ImageQuoteClient";

export default function ImageQuoteServer() {
  const imagesDir = path.join(process.cwd(), "public/images/utilities/imageQuote"); // ✅ Corrected path for Next.js

  if (!fs.existsSync(imagesDir)) {
    console.error("❌ Error: Images directory not found at", imagesDir);
    return <p>Error loading images.</p>;
  }

  const files = fs.readdirSync(imagesDir);

  // Parse image-text pairs
  const imageTextPairs = files
    .filter((file) => file.match(/\.(jpg|jpeg|png|gif)$/i)) // Get only image files
    .map((imageFile) => {
      const textFile = imageFile.replace(/\.(jpg|jpeg|png|gif)$/i, ".txt"); // Match text file
      const textFilePath = path.join(imagesDir, textFile);
      const text = fs.existsSync(textFilePath) ? fs.readFileSync(textFilePath, "utf-8").trim() : "";
      return { image: `/images/utilities/imageQuote/${imageFile}`, text };
    })
    .filter(({ text }) => text); // Ensure only pairs with text exist

  return <ImageQuoteClient imageTextPairs={imageTextPairs} />;
}
