import { mkdirSync, readdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "..", "src", "db", "migrations");
const destDir = path.join(__dirname, "..", "dist", "db", "migrations");

mkdirSync(destDir, { recursive: true });

for (const file of readdirSync(srcDir)) {
  if (file.endsWith(".sql")) {
    copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  }
}

console.log(`Copied migrations to ${destDir}`);