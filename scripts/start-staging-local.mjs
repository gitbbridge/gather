import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const envFile = process.env.GATHER_STAGING_ENV_FILE || ".env.staging.local";
if (!existsSync(envFile)) {
  console.error(`${envFile} is required to start the isolated staging worker.`);
  process.exit(1);
}
if (!existsSync("dist/server/wrangler.json")) {
  console.error(
    "The staging build is missing. Run the staging build before starting the worker.",
  );
  process.exit(1);
}

const values = new Map();
for (const sourceLine of readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const line = sourceLine.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const separator = line.indexOf("=");
  values.set(line.slice(0, separator), line.slice(separator + 1));
}

if (values.get("GATHER_ENVIRONMENT") !== "staging") {
  console.error("Refusing to start without GATHER_ENVIRONMENT=staging.");
  process.exit(1);
}

const args = [
  "--import",
  "./scripts/sites-env.mjs",
  "./node_modules/wrangler/bin/wrangler.js",
  "dev",
  "--config",
  "dist/server/wrangler.json",
  "--local",
  "--persist-to",
  ".wrangler/state",
  "--ip",
  "127.0.0.1",
  "--port",
  process.env.GATHER_STAGING_PORT || "8787",
  "--inspector-port",
  "0",
];
for (const [name, value] of values) args.push("--var", `${name}:${value}`);

const child = spawn(process.execPath, args, { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
