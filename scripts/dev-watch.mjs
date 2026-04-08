import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const watchedFiles = [
  "code.ts",
  "package.json",
  "tsconfig.json",
  "scripts/inject-version.mjs",
].map((relativePath) => path.join(projectRoot, relativePath));

let running = false;
let pending = false;
let debounceTimer = null;

function runBuild() {
  if (running) {
    pending = true;
    return;
  }

  running = true;
  console.log("\n[dev-watch] Building...");

  const child = spawn("npm", ["run", "build"], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code) => {
    running = false;
    if (code === 0) {
      console.log("[dev-watch] Build complete.");
    } else {
      console.log(`[dev-watch] Build failed (exit ${code ?? "unknown"}).`);
    }

    if (pending) {
      pending = false;
      runBuild();
    }
  });
}

function scheduleBuild() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runBuild, 150);
}

for (const filePath of watchedFiles) {
  fs.watch(filePath, () => {
    console.log(`[dev-watch] Change detected: ${path.relative(projectRoot, filePath)}`);
    scheduleBuild();
  });
}

console.log("[dev-watch] Watching TypeScript/build files.");
console.log("[dev-watch] For HTML/CSS updates, close and relaunch the plugin in Figma.");
runBuild();
