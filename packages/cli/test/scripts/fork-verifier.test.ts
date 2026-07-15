import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  analyzeImpact,
  buildCommandPlan,
  loadContract,
  runCommandPlan,
  validateContract,
} from "../../scripts/fork-verifier.js";

const roots: string[] = [];

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fork-contract-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "packages/cli/test/templates"), { recursive: true });
  fs.writeFileSync(path.join(root, "owned.md"), "owned\n");
  fs.writeFileSync(path.join(root, "shared.md"), "shared\n");
  fs.writeFileSync(
    path.join(root, "packages/cli/test/templates/feature.test.ts"),
    "test\n",
  );
  return root;
}

const valid = {
  schemaVersion: 1 as const,
  upstreamBaseline: "v0.6.6",
  features: [
    {
      id: "feature-a",
      description: "Feature A",
      ownedPaths: ["owned.md"],
      integrationPaths: ["shared.md"],
      tests: ["packages/cli/test/templates/feature.test.ts"],
    },
  ],
};

function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("fork contract validation", () => {
  it("accepts a valid contract", () => {
    expect(validateContract(valid, makeRoot())).toEqual(valid);
  });

  it("rejects duplicate IDs", () => {
    expect(() =>
      validateContract(
        { ...valid, features: [valid.features[0], valid.features[0]] },
        makeRoot(),
      ),
    ).toThrow(/duplicate feature id: feature-a/);
  });

  it("rejects missing declared paths", () => {
    const contract = structuredClone(valid);
    contract.features[0].ownedPaths = ["missing.md"];
    expect(() => validateContract(contract, makeRoot())).toThrow(
      /missing path.*missing\.md/,
    );
  });

  it("requires executable test evidence", () => {
    const contract = structuredClone(valid);
    contract.features[0].tests = [];
    expect(() => validateContract(contract, makeRoot())).toThrow(
      /at least one test/,
    );
  });

  it("loads JSON from disk", () => {
    const root = makeRoot();
    const file = path.join(root, "fork-contract.json");
    fs.writeFileSync(file, JSON.stringify(valid));
    expect(loadContract(file, root).schemaVersion).toBe(1);
  });

  it("does not mutate the caller's contract", () => {
    const contract = structuredClone(valid);
    const before = structuredClone(contract);
    validateContract(contract, makeRoot());
    expect(contract).toEqual(before);
  });
});

describe("fork impact analysis", () => {
  it("maps changed integration paths to affected features", () => {
    const root = makeRoot();
    git(root, "init");
    git(root, "config", "user.email", "test@example.com");
    git(root, "config", "user.name", "Test");
    git(root, "add", ".");
    git(root, "commit", "-m", "base");
    git(root, "tag", "base");
    fs.writeFileSync(path.join(root, "shared.md"), "upstream change\n");
    git(root, "add", "shared.md");
    git(root, "commit", "-m", "target");

    const result = analyzeImpact(valid, root, "base", "HEAD");

    expect(result.changedPaths).toContain("shared.md");
    expect(result.affected).toEqual([
      { featureId: "feature-a", paths: ["shared.md"] },
    ]);
  });

  it("fails when a requested ref is unavailable", () => {
    const root = makeRoot();
    git(root, "init");
    expect(() => analyzeImpact(valid, root, "missing", "HEAD")).toThrow(
      /unable to compare missing\.\.\.HEAD/,
    );
  });
});

describe("fork command plans", () => {
  it("quick mode runs every distinct declared test once", () => {
    expect(buildCommandPlan("quick", valid)).toEqual([
      {
        label: "fork tests",
        command: "corepack",
        args: [
          "pnpm",
          "--filter",
          "@mindfoldhq/trellis",
          "exec",
          "vitest",
          "run",
          "test/templates/feature.test.ts",
        ],
      },
    ]);
  });

  it("full mode appends repository quality and sandbox checks", () => {
    const labels = buildCommandPlan("full", valid).map((step) => step.label);
    expect(labels).toEqual([
      "fork tests",
      "lint",
      "typecheck",
      "build",
      "all tests",
    ]);
  });

  it("stops at the first failed command", () => {
    const calls: string[] = [];
    const runner = (command: string) => {
      calls.push(command);
      return { status: 2, signal: null, error: undefined };
    };
    expect(() =>
      runCommandPlan(buildCommandPlan("quick", valid), makeRoot(), runner),
    ).toThrow(/fork tests failed/);
    expect(calls).toEqual(["corepack"]);
  });
});
