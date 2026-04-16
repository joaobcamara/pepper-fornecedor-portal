import { createWriteStream, existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const timeoutMs = Number(process.env.BUILD_GUARD_TIMEOUT_MS ?? 180000);
const logFilePath = path.join(root, "guarded-build.log");
const logStream = createWriteStream(logFilePath, { flags: "w" });

function writeLine(message) {
  process.stdout.write(`${message}\n`);
  logStream.write(`${message}\n`);
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  return `${seconds}s`;
}

async function cleanNextDirectory() {
  const nextDir = path.join(root, ".next");
  if (!existsSync(nextDir)) {
    writeLine("[build:guarded] .next nao existia, seguindo.");
    return;
  }

  try {
    await rm(nextDir, { recursive: true, force: true });
    writeLine("[build:guarded] .next limpo para evitar artefatos presos.");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    writeLine(`[build:guarded] Aviso: nao foi possivel limpar .next (${reason}). O build vai seguir assim mesmo.`);
  }
}

function runStep(step) {
  const startedAt = Date.now();
  writeLine(`\n[build:guarded] Iniciando ${step.label}`);
  writeLine(`[build:guarded] Comando: ${step.command.join(" ")}`);

  const result = spawnSync(step.command[0], step.command.slice(1), {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
    logStream.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
    logStream.write(result.stderr);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.signal) {
    throw new Error(`Timeout em ${step.label} apos ${formatDuration(timeoutMs)}. Consulte ${logFilePath}.`);
  }

  if (result.status !== 0) {
    throw new Error(`${step.label} falhou com codigo ${result.status}. Consulte ${logFilePath}.`);
  }

  writeLine(`[build:guarded] ${step.label} concluido em ${formatDuration(Date.now() - startedAt)}.`);
}

async function main() {
  writeLine("[build:guarded] Preparando validacao controlada.");
  writeLine(`[build:guarded] Timeout configurado: ${formatDuration(timeoutMs)}.`);

  await cleanNextDirectory();

  runStep({
    label: "TypeScript",
    command: [process.execPath, path.join(root, "node_modules", "typescript", "bin", "tsc"), "--noEmit"]
  });

  runStep({
    label: "Next build",
    command: [process.execPath, path.join(root, "node_modules", "next", "dist", "bin", "next"), "build"]
  });

  writeLine(`\n[build:guarded] Validacao completa. Log salvo em ${logFilePath}`);
}

main()
  .catch((error) => {
    writeLine(`\n[build:guarded] Falha: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => {
    logStream.end();
  });
