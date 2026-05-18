import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

export interface Config {
  port: number;
  uploadsDir: string;
  outputDir: string;
  publicDir: string;
}

function env(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

export function loadConfig(): Config {
  return {
    port: parseInt(env("PORT", "8000"), 10),
    uploadsDir: path.resolve(projectRoot, env("UPLOADS_DIR", "./data/uploads")),
    outputDir: path.resolve(projectRoot, env("OUTPUT_DIR", "./data/output")),
    publicDir: path.resolve(projectRoot, "public"),
  };
}
