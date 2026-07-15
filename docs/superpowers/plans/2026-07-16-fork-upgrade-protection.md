# Trellis Fork Upgrade Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an extensible, executable contract that detects upstream impact and proves fork-owned Trellis features survive source merges and project template updates.

**Architecture:** A root JSON manifest indexes fork-owned paths, shared integration paths, and behavioral tests. A focused Node verifier validates that contract, computes Git overlap, and runs quick/full verification stages; Vitest covers verifier behavior and temporary-project generation/update preservation. Existing PB implementation remains unchanged except for the smallest update-analysis export needed by sandbox tests.

**Tech Stack:** Node.js ESM, TypeScript, Vitest, pnpm workspaces, Git CLI, existing Trellis template/update APIs.

---

## File Map

- Create `fork-contract.json` — versioned registry of fork features, ownership boundaries, integration surfaces, and test evidence.
- Create `packages/cli/scripts/fork-verifier.js` — manifest validation, Git impact analysis, deterministic reporting, and staged command runner.
- Create `packages/cli/test/scripts/fork-verifier.test.ts` — unit/integration tests for malformed contracts, missing paths, overlap mapping, and read-only behavior.
- Modify `packages/cli/test/templates/pb.test.ts` — generation assertions for complete PB assets and task lifecycle wiring.
- Create `packages/cli/test/commands/fork-update-preservation.test.ts` — temporary-project update analysis and keep/`.new` preservation regression.
- Modify `packages/cli/src/commands/update.ts` — export only the existing analysis/types needed by the sandbox regression; do not duplicate update logic.
- Modify `package.json` — add `verify:fork:quick` and `verify:fork` entry points.
- Modify `packages/cli/package.json` — add the direct fork test command used by the verifier.
- Keep `.trellis/tasks/07-13-reviewer-decouple/` untouched and never stage it.

### Task 1: Contract schema and validation

**Files:**
- Create: `fork-contract.json`
- Create: `packages/cli/scripts/fork-verifier.js`
- Create: `packages/cli/test/scripts/fork-verifier.test.ts`

- [ ] **Step 1: Write failing validation tests**

Create `packages/cli/test/scripts/fork-verifier.test.ts` with temporary manifests and repositories. Start with these cases:

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadContract, validateContract } from "../../scripts/fork-verifier.js";

const roots: string[] = [];

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fork-contract-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "packages/cli/test/templates"), { recursive: true });
  fs.writeFileSync(path.join(root, "owned.md"), "owned\n");
  fs.writeFileSync(path.join(root, "shared.md"), "shared\n");
  fs.writeFileSync(path.join(root, "packages/cli/test/templates/feature.test.ts"), "test\n");
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

const valid = {
  schemaVersion: 1,
  upstreamBaseline: "v0.6.6",
  features: [{
    id: "feature-a",
    description: "Feature A",
    ownedPaths: ["owned.md"],
    integrationPaths: ["shared.md"],
    tests: ["packages/cli/test/templates/feature.test.ts"],
  }],
};

describe("fork contract validation", () => {
  it("accepts a valid contract", () => {
    expect(validateContract(valid, makeRoot())).toEqual(valid);
  });

  it("rejects duplicate IDs", () => {
    expect(() => validateContract({ ...valid, features: [valid.features[0], valid.features[0]] }, makeRoot()))
      .toThrow(/duplicate feature id: feature-a/);
  });

  it("rejects missing declared paths", () => {
    const contract = structuredClone(valid);
    contract.features[0].ownedPaths = ["missing.md"];
    expect(() => validateContract(contract, makeRoot())).toThrow(/missing path.*missing\.md/);
  });

  it("requires executable test evidence", () => {
    const contract = structuredClone(valid);
    contract.features[0].tests = [];
    expect(() => validateContract(contract, makeRoot())).toThrow(/at least one test/);
  });

  it("loads JSON from disk", () => {
    const root = makeRoot();
    const file = path.join(root, "fork-contract.json");
    fs.writeFileSync(file, JSON.stringify(valid));
    expect(loadContract(file, root).schemaVersion).toBe(1);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
pnpm --filter @mindfoldhq/trellis exec vitest run test/scripts/fork-verifier.test.ts
```

Expected: FAIL because `packages/cli/scripts/fork-verifier.js` does not exist.

- [ ] **Step 3: Implement minimal contract validation**

Create `packages/cli/scripts/fork-verifier.js` with ESM exports `loadContract(file, root)` and `validateContract(value, root)`. Validate plain-object shape, `schemaVersion === 1`, non-empty baseline, unique IDs, non-empty descriptions, non-empty `ownedPaths`, non-empty `tests`, optional `integrationPaths`, repository-relative paths without `..`, file existence, and tests under `packages/cli/test/` ending in `.test.ts`. Error messages must include feature ID and offending path.

Use this interface in JSDoc so TypeScript tests get stable names:

```js
/**
 * @typedef {{
 *   id: string,
 *   description: string,
 *   ownedPaths: string[],
 *   integrationPaths: string[],
 *   tests: string[]
 * }} ForkFeature
 * @typedef {{schemaVersion: 1, upstreamBaseline: string, features: ForkFeature[]}} ForkContract
 */
```

`loadContract` must use `JSON.parse(fs.readFileSync(file, "utf8"))` and immediately call `validateContract`.

- [ ] **Step 4: Add the real manifest**

Create `fork-contract.json` with these initial features and exact boundaries:

```json
{
  "schemaVersion": 1,
  "upstreamBaseline": "v0.6.6",
  "features": [
    {
      "id": "pb-gates",
      "description": "Start and archive gates for complex playbook tasks",
      "ownedPaths": [
        "packages/cli/src/templates/trellis/scripts/common/pb_gate.py"
      ],
      "integrationPaths": [
        "packages/cli/src/templates/trellis/scripts/task.py",
        "packages/cli/src/templates/trellis/scripts/common/task_store.py",
        "packages/cli/src/templates/trellis/index.ts",
        "packages/cli/src/templates/trellis/config.yaml"
      ],
      "tests": ["packages/cli/test/templates/pb.test.ts"]
    },
    {
      "id": "pb-review-and-harvest",
      "description": "Layered fusion review, precedent search, and harvest skills",
      "ownedPaths": [
        "packages/cli/src/templates/common/bundled-skills/pb-adversarial-review/SKILL.md",
        "packages/cli/src/templates/common/bundled-skills/pb-adversarial-review/references/attack-checklist.md",
        "packages/cli/src/templates/common/bundled-skills/pb-adversarial-review/references/delivery-gerrit-example.md",
        "packages/cli/src/templates/common/bundled-skills/pb-adversarial-review/references/draft-template.md",
        "packages/cli/src/templates/common/bundled-skills/pb-adversarial-review/references/fusion-howto.md",
        "packages/cli/src/templates/common/bundled-skills/pb-adversarial-review/references/l2-channel-review.md",
        "packages/cli/src/templates/common/bundled-skills/pb-adversarial-review/references/review-record-template.md",
        "packages/cli/src/templates/common/bundled-skills/pb-adversarial-review/references/round-protocol.md",
        "packages/cli/src/templates/common/bundled-skills/pb-harvest/SKILL.md",
        "packages/cli/src/templates/common/bundled-skills/pb-harvest/references/harvest-format.md",
        "packages/cli/src/templates/common/bundled-skills/pb-harvest/references/precedent-report.md",
        "packages/cli/src/templates/common/bundled-skills/pb-harvest/references/skill-extraction.md",
        "packages/cli/src/templates/common/skills/pb-find-precedent.md"
      ],
      "integrationPaths": [
        "packages/cli/src/configurators/shared.ts",
        "packages/cli/src/templates/trellis/workflow.md"
      ],
      "tests": ["packages/cli/test/templates/pb.test.ts"]
    }
  ]
}
```

- [ ] **Step 5: Run validation tests and confirm GREEN**

Run the focused Vitest command from Step 2. Expected: all tests PASS.

- [ ] **Step 6: Commit only Task 1 files**

```bash
git add fork-contract.json packages/cli/scripts/fork-verifier.js packages/cli/test/scripts/fork-verifier.test.ts
git commit -m "test(fork): define executable feature contract"
```

Do not stage `.trellis/tasks/07-13-reviewer-decouple/`.

### Task 2: Upstream impact analysis

**Files:**
- Modify: `packages/cli/scripts/fork-verifier.js`
- Modify: `packages/cli/test/scripts/fork-verifier.test.ts`

- [ ] **Step 1: Write failing Git overlap tests**

Add tests that initialize a temporary Git repository, commit `shared.md`, create refs `base` and `target`, modify `shared.md`, and assert:

```ts
import { execFileSync } from "node:child_process";
import { analyzeImpact } from "../../scripts/fork-verifier.js";

function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

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
  expect(result.affected).toEqual([{ featureId: "feature-a", paths: ["shared.md"] }]);
});

it("fails when a requested ref is unavailable", () => {
  const root = makeRoot();
  git(root, "init");
  expect(() => analyzeImpact(valid, root, "missing", "HEAD")).toThrow(/unable to compare/);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Expected: FAIL because `analyzeImpact` is not exported.

- [ ] **Step 3: Implement deterministic impact analysis**

Add `analyzeImpact(contract, root, base, target)` using:

```js
execFileSync("git", ["diff", "--name-only", `${base}...${target}`, "--"], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});
```

Normalize output to forward slashes, remove blanks, sort paths, and map exact declared paths to features. Return:

```js
{ base, target, changedPaths, affected: [{ featureId, paths }] }
```

Sort affected entries by feature ID and each path list lexicographically. Wrap Git errors with `unable to compare <base>...<target>`.

- [ ] **Step 4: Add CLI argument parsing and impact report**

Support:

```text
node packages/cli/scripts/fork-verifier.js quick
node packages/cli/scripts/fork-verifier.js quick --base v0.6.6 --target upstream/v0.6.7
node packages/cli/scripts/fork-verifier.js full --base v0.6.6 --target HEAD
```

Require `--base` and `--target` together. Print `Fork impact: none` or one line per feature, for example `Fork impact: pb-gates <- packages/.../task.py`. Do not fetch or mutate Git state.

Guard CLI execution with an `import.meta.url === pathToFileURL(process.argv[1]).href` check so tests can import functions without running the command.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run the Task 1 Vitest command. Expected: all tests PASS.

- [ ] **Step 6: Manually verify the real baseline comparison**

Run:

```bash
node packages/cli/scripts/fork-verifier.js quick --base v0.6.6 --target main
```

Expected: contract validation succeeds and the impact report is deterministic. At this point command execution may still print a clearly labeled “test runner not wired” failure; do not claim quick mode complete until Task 3.

- [ ] **Step 7: Commit Task 2 files**

```bash
git add packages/cli/scripts/fork-verifier.js packages/cli/test/scripts/fork-verifier.test.ts
git commit -m "feat(fork): detect upstream impact on custom features"
```

### Task 3: Quick and full command runners

**Files:**
- Modify: `packages/cli/scripts/fork-verifier.js`
- Modify: `packages/cli/test/scripts/fork-verifier.test.ts`
- Modify: `packages/cli/package.json`
- Modify: `package.json`

- [ ] **Step 1: Write failing command-plan tests**

Add an exported `buildCommandPlan(mode, contract)` test:

```ts
it("quick mode runs every distinct declared test once", () => {
  expect(buildCommandPlan("quick", valid)).toEqual([
    {
      label: "fork tests",
      command: "pnpm",
      args: ["--filter", "@mindfoldhq/trellis", "exec", "vitest", "run", "test/templates/feature.test.ts"]
    }
  ]);
});

it("full mode appends repository quality and sandbox checks", () => {
  const labels = buildCommandPlan("full", valid).map((step) => step.label);
  expect(labels).toEqual(["fork tests", "lint", "typecheck", "build", "all tests", "fork sandbox tests"]);
});
```

Also inject a fake runner into `runCommandPlan` and assert the first nonzero status stops execution and throws with the failed label.

- [ ] **Step 2: Run tests and confirm RED**

Expected: FAIL because command-plan functions do not exist.

- [ ] **Step 3: Implement command planning and execution**

Export:

```js
buildCommandPlan(mode, contract)
runCommandPlan(plan, root, runner = spawnSync)
```

Deduplicate declared tests, convert repository paths from `packages/cli/test/...` to CLI-package paths `test/...`, and use argument arrays. Full mode appends exact root commands:

```text
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm --filter @mindfoldhq/trellis exec vitest run test/templates/fork-generation.test.ts test/commands/fork-update-preservation.test.ts
```

Stream subprocess output with `stdio: "inherit"`. Reject `result.error`, signal termination, or nonzero status.

- [ ] **Step 4: Add package scripts**

In `packages/cli/package.json` add:

```json
"test:fork": "vitest run test/templates/pb.test.ts test/scripts/fork-verifier.test.ts test/templates/fork-generation.test.ts test/commands/fork-update-preservation.test.ts"
```

In root `package.json` add:

```json
"verify:fork:quick": "node packages/cli/scripts/fork-verifier.js quick",
"verify:fork": "node packages/cli/scripts/fork-verifier.js full"
```

The verifier itself remains responsible for choosing declared tests; `test:fork` is a direct diagnostic convenience.

- [ ] **Step 5: Run focused tests and quick verification**

Run:

```bash
pnpm --filter @mindfoldhq/trellis exec vitest run test/scripts/fork-verifier.test.ts
pnpm verify:fork:quick
```

Expected: verifier tests PASS; quick command validates the real manifest and passes declared PB tests.

- [ ] **Step 6: Commit Task 3 files**

```bash
git add package.json packages/cli/package.json packages/cli/scripts/fork-verifier.js packages/cli/test/scripts/fork-verifier.test.ts
git commit -m "feat(fork): add unified verification commands"
```

### Task 4: Generated-project PB regression

**Files:**
- Create: `packages/cli/test/templates/fork-generation.test.ts`
- Modify: `packages/cli/test/templates/pb.test.ts`

- [ ] **Step 1: Write the failing generation test**

Create a temporary output tree by writing `getAllScripts()`, `workflowMdTemplate`, `configYamlTemplate`, `getSkillTemplates()`, and `getBundledSkillTemplates()` to their production-relative destinations. Assert emitted files and wiring, not only source discovery:

```ts
expect(read(".trellis/scripts/common/pb_gate.py")).toContain("check_start_gate");
expect(read(".trellis/scripts/task.py")).toContain("check_start_gate");
expect(read(".trellis/scripts/task.py")).toContain("check_archive_gate");
expect(read(".trellis/workflow.md")).toContain("pb-adversarial-review");
expect(read(".trellis/config.yaml")).toMatch(/^playbook:$/m);
expect(read(".claude/skills/pb-adversarial-review/references/fusion-howto.md")).toContain("--no-log");
expect(read(".claude/skills/pb-harvest/SKILL.md")).toContain("pb-harvest");
```

Use a local `write(relativePath, content)` helper and remove the temp tree in `afterEach`. Derive bundled skill destinations through the same platform-template collector used by production configurators; do not hard-code a second skill mapping if `collectPlatformTemplates("claude")` already exposes it.

- [ ] **Step 2: Run the new test and confirm RED**

Run:

```bash
pnpm --filter @mindfoldhq/trellis exec vitest run test/templates/fork-generation.test.ts
```

Expected: at least one assertion fails until destination collection/writing is correctly wired.

- [ ] **Step 3: Implement the minimal generation harness**

Complete the test harness using `collectPlatformTemplates("claude")` and Trellis template exports. No production code change is expected. If a production collector omits a fork asset, fix only the missing registration in `packages/cli/src/configurators/shared.ts` and add that file to this task’s commit.

- [ ] **Step 4: Strengthen existing PB invariants**

In `pb.test.ts`, add explicit assertions that:

- `taskScript` imports and calls both gate functions
- fusion guidance includes literal `llm --no-log`
- attack checklist contains impact-surface enumeration and oracle reconciliation language
- every owned PB reference listed by the manifest is discovered

Read the manifest in the test instead of duplicating the owned file list.

- [ ] **Step 5: Run PB and generation tests**

```bash
pnpm --filter @mindfoldhq/trellis exec vitest run test/templates/pb.test.ts test/templates/fork-generation.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit Task 4 files**

```bash
git add packages/cli/test/templates/pb.test.ts packages/cli/test/templates/fork-generation.test.ts packages/cli/src/configurators/shared.ts
git commit -m "test(fork): verify generated playbook assets and wiring"
```

Only include `shared.ts` if it actually changed.

### Task 5: Update preservation sandbox

**Files:**
- Modify: `packages/cli/src/commands/update.ts`
- Create: `packages/cli/test/commands/fork-update-preservation.test.ts`

- [ ] **Step 1: Export the existing analysis seam**

Change only visibility, not behavior:

```ts
export interface FileChange { ... }
export interface ChangeAnalysis { ... }
export function analyzeChanges(...) { ... }
```

If `collectTemplateFiles` is required by the test, export it as well. Do not copy its implementation into test code.

- [ ] **Step 2: Write failing modified-template classification test**

Build a temporary `.trellis` project with:

- `.version` set to `0.6.6`
- `.trellis/workflow.md` containing the old generated content plus `USER CUSTOMIZATION`
- `.template-hashes.json` storing the hash of the pristine old content
- current templates collected from production

Call exported update analysis and assert `workflow.md` lands in `changedFiles`, not `autoUpdateFiles`. Then emulate existing `create-new` behavior using the analyzed `newContent` and assert:

```ts
expect(fs.readFileSync(workflowPath, "utf8")).toContain("USER CUSTOMIZATION");
expect(fs.readFileSync(`${workflowPath}.new`, "utf8")).toContain("pb-adversarial-review");
```

Also assert new fork-owned PB files appear in `newFiles` when absent.

- [ ] **Step 3: Run the update regression and confirm RED**

```bash
pnpm --filter @mindfoldhq/trellis exec vitest run test/commands/fork-update-preservation.test.ts
```

Expected: FAIL until the production analysis seam is exported and fixture hashes match the expected format.

- [ ] **Step 4: Complete the real-analysis fixture**

Use `computeHash`, `saveHashes`/the exact `TemplateHashes` JSON shape, and production template collection. Do not invoke network version checks. Cover three cases:

1. pristine tracked workflow → `autoUpdateFiles`
2. user-modified tracked workflow → `changedFiles`, local content retained
3. create-new result → `.new` contains current PB workflow

Add one assertion that `.trellis/tasks/user-task/prd.md` is never included in changes.

- [ ] **Step 5: Run update and upstream update-internals tests**

```bash
pnpm --filter @mindfoldhq/trellis exec vitest run test/commands/fork-update-preservation.test.ts test/commands/update-internals.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit Task 5 files**

```bash
git add packages/cli/src/commands/update.ts packages/cli/test/commands/fork-update-preservation.test.ts
git commit -m "test(fork): preserve custom templates across updates"
```

### Task 6: Full verification, negative proof, and final integration

**Files:**
- Modify if required by failures: only files introduced in Tasks 1–5

- [ ] **Step 1: Run quick verification with upstream impact analysis**

After ensuring local refs exist, run:

```bash
pnpm verify:fork:quick -- --base v0.6.6 --target main
```

Expected: manifest validation PASS, deterministic affected-feature report, and declared PB tests PASS. This command must not fetch or change refs.

- [ ] **Step 2: Prove missing-path protection fails closed**

Temporarily rename one declared owned path, run quick verification, and expect nonzero status with the missing path named. Restore the file immediately using a reversible filesystem rename, not Git reset/checkout. Re-run quick verification and expect PASS.

- [ ] **Step 3: Prove behavioral regression detection**

Temporarily remove one required PB marker from a test fixture/source copy used by the focused test, run the relevant test and expect FAIL, then restore the exact content. Re-run and expect PASS. Do not commit the temporary mutation.

- [ ] **Step 4: Run full verification**

```bash
pnpm verify:fork
```

Expected sequence and result:

```text
fork tests: PASS
lint: PASS
typecheck: PASS
build: PASS
all tests: PASS
fork sandbox tests: PASS
```

All subprocesses must exit 0.

- [ ] **Step 5: Check working tree scope**

Run:

```bash
git status --short
git diff --check
git diff --stat v0.6.6...HEAD
```

Expected: `.trellis/tasks/07-13-reviewer-decouple/` remains untracked and untouched; no temporary sandbox files or test mutations remain; no whitespace errors.

- [ ] **Step 6: Commit any verification-only corrections**

Stage only explicit changed files. If no corrections were needed, do not create an empty commit. If needed:

```bash
git add fork-contract.json package.json packages/cli/package.json packages/cli/scripts/fork-verifier.js packages/cli/test/scripts/fork-verifier.test.ts packages/cli/test/templates/pb.test.ts packages/cli/test/templates/fork-generation.test.ts packages/cli/test/commands/fork-update-preservation.test.ts packages/cli/src/commands/update.ts
git commit -m "fix(fork): close upgrade verification gaps"
```

- [ ] **Step 7: Record upgrade usage**

In the final report, provide these exact operational commands:

```bash
git fetch upstream --tags
pnpm verify:fork:quick -- --base v0.6.6 --target upstream/v0.6.7
# merge on an isolated upgrade branch
pnpm verify:fork -- --base v0.6.6 --target HEAD
```

Do not run fetch, merge, push, `trellis update`, or modify a real user project as part of this implementation.
