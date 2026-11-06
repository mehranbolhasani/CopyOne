import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const packageJsonPath = path.join(projectRoot, "package.json");
const codeJsPath = path.join(projectRoot, "code.js");

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const version = String(packageJson.version ?? "").trim();

if (!version) {
  throw new Error("package.json version is missing.");
}

const codeJs = fs.readFileSync(codeJsPath, "utf8");
const updated = codeJs.replace(/__PLUGIN_VERSION__/g, version);

if (updated === codeJs) {
  throw new Error("No build tokens found in code.js.");
}

fs.writeFileSync(codeJsPath, updated, "utf8");
