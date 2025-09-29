// scripts/run-scripts.ts
import { readFileSync } from "fs";

type Opts = {
  stopOnError: boolean;
  include: RegExp[];
  verbose: boolean;
};
const argv = new Set(process.argv.slice(2));
const opts: Opts = {
  stopOnError: argv.has("--no-stop") ? false : true,
  verbose: argv.has("--verbose") || argv.has("--show-logs"),
  include: [/^tutorial-\d+$/, /^multi-role-/, /^subscription-/, /^transfer-/, /^withdraw-/],
};

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const names: string[] = Object.keys(pkg.scripts).filter((n) =>
  opts.include.some((r) => r.test(n)),
);

if (names.length === 0) {
  console.error("No matching scripts.");
  process.exit(1);
}

// Pull out only error-y looking lines from combined output.
// Tuned for Solana/Token2022/Swig + web3.js errors.
function extractErrorSummary(text: string) {
  const lines = text.split(/\r?\n/);

  // Keep blocks that typically indicate failure
  const keepers: string[] = [];

  // Common error indicators
  const patterns = [
    /(^| )error[: ]/i,
    /\bfailed\b/i,
    /\bexception\b/i,
    /Simulation failed/i,
    /SendTransactionError/i,
    /custom program error/i,
    /Transaction simulation failed/i,
    /Program .* failed/i,
    /owner does not match/i,
    /invalid account data/i,
    /insufficient funds/i,
    /Error processing Instruction/i,
  ];

  // Capture JSON/log blocks from web3.js errors that start with "Message:" or "Logs:"
  const blockStarts = [/^Message:/, /^Logs:/, /^transactionLogs:/, /^\s*\[/];

  let capturingBlock = false;
  for (const line of lines) {
    const isMatch = patterns.some((re) => re.test(line));
    const isBlockStart = blockStarts.some((re) => re.test(line.trim()));
    if (isMatch) keepers.push(line);
    if (isBlockStart || capturingBlock) {
      // Try to keep structured log chunks like arrays/objects
      keepers.push(line);
      // Naive block detection: stop when an empty line appears after starting
      capturingBlock = line.trim().endsWith("[") || (!line.trim() && capturingBlock);
    }
  }

  // If nothing matched, fall back to first ~20 lines of stderr
  if (keepers.length === 0) {
    return lines.slice(0, 20).join("\n");
  }
  return keepers.join("\n");
}

const failures: { name: string; summary: string }[] = [];

for (const name of names) {
  // Don’t print script chatter unless verbose
  if (opts.verbose) console.log(`\n▶ Running: ${name}`);

  const p = Bun.spawn(["bun", "run", name], { stdout: "pipe", stderr: "pipe" });

  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  const code = await p.exited;

  if (code !== 0) {
    const combined = (out + "\n" + err).trim();
    const summary = opts.verbose ? combined : extractErrorSummary(combined);
    console.error(`\n✖ ${name} failed with code ${code}`);
    console.error(summary);
    failures.push({ name, summary });

    if (opts.stopOnError) break;
  } else {
    if (opts.verbose) console.log(`✔ ${name} passed`);
  }
}

if (failures.length) {
  console.error(
    `\nFailed scripts (${failures.length}): ${failures.map((f) => f.name).join(", ")}`,
  );
  process.exit(1);
} else {
  console.log("\nAll selected scripts finished successfully.");
}
