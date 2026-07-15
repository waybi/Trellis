#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * @typedef {{
 *   id: string,
 *   description: string,
 *   ownedPaths: string[],
 *   integrationPaths: string[],
 *   tests: string[]
 * }} ForkFeature
 * @typedef {{schemaVersion: 1, upstreamBaseline: string, features: ForkFeature[]}} ForkContract
 * @typedef {{label: string, command: string, args: string[]}} CommandStep
 */

function fail(message) {
  throw new Error(`Invalid fork contract: ${message}`);
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim() === "") fail(`${label} must be a non-empty string`);
  return value;
}

function validatePath(value, root, label) {
  const relative = assertString(value, label).replaceAll("\\", "/");
  if (path.isAbsolute(relative) || relative.split("/").includes("..")) {
    fail(`${label} must be repository-relative: ${relative}`);
  }
  if (!fs.existsSync(path.join(root, relative))) fail(`${label} missing path: ${relative}`);
  return relative;
}

/** @returns {ForkContract} */
export function validateContract(value, root) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("root must be an object");
  if (value.schemaVersion !== 1) fail("schemaVersion must equal 1");
  const upstreamBaseline = assertString(value.upstreamBaseline, "upstreamBaseline");
  if (!Array.isArray(value.features) || value.features.length === 0) fail("features must be non-empty");

  const ids = new Set();
  const features = value.features.map((feature) => {
    if (!feature || typeof feature !== "object" || Array.isArray(feature)) fail("feature must be an object");
    const id = assertString(feature.id, "feature id");
    if (ids.has(id)) fail(`duplicate feature id: ${id}`);
    ids.add(id);
    const description = assertString(feature.description, `${id}.description`);
    if (!Array.isArray(feature.ownedPaths) || feature.ownedPaths.length === 0) fail(`${id} must declare at least one owned path`);
    if (!Array.isArray(feature.integrationPaths)) fail(`${id}.integrationPaths must be an array`);
    if (!Array.isArray(feature.tests) || feature.tests.length === 0) fail(`${id} must declare at least one test`);

    const ownedPaths = feature.ownedPaths.map((entry) => validatePath(entry, root, `${id}.ownedPaths`));
    const integrationPaths = feature.integrationPaths.map((entry) => validatePath(entry, root, `${id}.integrationPaths`));
    const tests = feature.tests.map((entry) => {
      const testPath = validatePath(entry, root, `${id}.tests`);
      if (!testPath.startsWith("packages/cli/test/") || !testPath.endsWith(".test.ts")) {
        fail(`${id}.tests must point to packages/cli/test/**/*.test.ts: ${testPath}`);
      }
      return testPath;
    });
    return { id, description, ownedPaths, integrationPaths, tests };
  });
  return { schemaVersion: 1, upstreamBaseline, features };
}

export function loadContract(file, root) {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Unable to load fork contract ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return validateContract(value, root);
}

export function analyzeImpact(contract, root, base, target) {
  let output;
  try {
    output = execFileSync("git", ["diff", "--name-only", `${base}...${target}`, "--"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = error && typeof error === "object" && "stderr" in error ? String(error.stderr).trim() : "";
    throw new Error(`unable to compare ${base}...${target}${detail ? `: ${detail}` : ""}`);
  }
  const changedPaths = [...new Set(output.split(/\r?\n/).map((entry) => entry.trim().replaceAll("\\", "/")).filter(Boolean))].sort();
  const changedSet = new Set(changedPaths);
  const affected = contract.features
    .map((feature) => ({
      featureId: feature.id,
      paths: [...feature.ownedPaths, ...feature.integrationPaths].filter((entry) => changedSet.has(entry)).sort(),
    }))
    .filter((entry) => entry.paths.length > 0)
    .sort((a, b) => a.featureId.localeCompare(b.featureId));
  return { base, target, changedPaths, affected };
}

export function buildCommandPlan(mode, contract) {
  if (mode !== "quick" && mode !== "full") throw new Error(`Unknown verification mode: ${mode}`);
  const tests = [...new Set(contract.features.flatMap((feature) => feature.tests))]
    .map((entry) => entry.replace(/^packages\/cli\//, ""))
    .sort();
  /** @type {CommandStep[]} */
  const plan = [{ label: "fork tests", command: "corepack", args: ["pnpm", "--filter", "@mindfoldhq/trellis", "exec", "vitest", "run", ...tests] }];
  if (mode === "full") {
    plan.push(
      { label: "lint", command: "corepack", args: ["pnpm", "lint"] },
      { label: "typecheck", command: "corepack", args: ["pnpm", "typecheck"] },
      { label: "build", command: "corepack", args: ["pnpm", "build"] },
      { label: "all tests", command: "corepack", args: ["pnpm", "test"] },
    );
  }
  return plan;
}

export function runCommandPlan(plan, root, runner = spawnSync) {
  for (const step of plan) {
    const result = runner(step.command, step.args, { cwd: root, stdio: "inherit" });
    if (result.error) throw new Error(`${step.label} failed: ${result.error.message}`);
    if (result.signal) throw new Error(`${step.label} failed: terminated by ${result.signal}`);
    if (result.status !== 0) throw new Error(`${step.label} failed with exit code ${String(result.status)}`);
  }
}

function parseArgs(argv) {
  const mode = argv[0];
  if (mode !== "quick" && mode !== "full") throw new Error("Usage: fork-verifier.js <quick|full> [--base REF --target REF]");
  let base;
  let target;
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value || (flag !== "--base" && flag !== "--target")) throw new Error("Expected --base REF and --target REF");
    if (flag === "--base") base = value;
    else target = value;
  }
  if (Boolean(base) !== Boolean(target)) throw new Error("--base and --target must be provided together");
  return { mode, base, target };
}

function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(scriptDir, "../../..");
  const { mode, base, target } = parseArgs(process.argv.slice(2));
  const contract = loadContract(path.join(root, "fork-contract.json"), root);
  console.log(`Fork contract: ${contract.features.length} features validated`);
  if (base && target) {
    const impact = analyzeImpact(contract, root, base, target);
    if (impact.affected.length === 0) console.log("Fork impact: none");
    else for (const entry of impact.affected) console.log(`Fork impact: ${entry.featureId} <- ${entry.paths.join(", ")}`);
  }
  runCommandPlan(buildCommandPlan(mode, contract), root);
  console.log(`Fork verification (${mode}): PASS`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
