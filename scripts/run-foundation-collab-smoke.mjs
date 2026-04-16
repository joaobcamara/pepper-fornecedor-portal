import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const cwd = process.cwd();
const envPath = path.join(cwd, ".env");
const env = { ...process.env };

if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!key || env[key]) {
      continue;
    }

    env[key] = rawValue.replace(/^"(.*)"$/, "$1");
  }
}

if (env.DIRECT_URL?.trim()) {
  env.DATABASE_URL = env.DIRECT_URL.trim();
}

const child = spawn(
  process.execPath,
  [path.join(cwd, "node_modules", "tsx", "dist", "cli.mjs"), "scripts/foundation-collab-smoke.ts"],
  {
    cwd,
    stdio: "inherit",
    env
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
