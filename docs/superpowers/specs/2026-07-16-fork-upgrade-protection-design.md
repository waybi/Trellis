# Trellis Fork Upgrade Protection Design

## Goal

Protect locally owned Trellis capabilities from semantic regressions when upstream releases are merged or generated project files are updated. The mechanism must be extensible: a new fork feature joins the protection boundary by declaring ownership and binding executable tests, without changing the verifier.

## Scope

Initial coverage includes the current PB customizations:

- `pb_gate` start/archive enforcement and its task lifecycle wiring
- layered `pb-adversarial-review` and fusion guidance
- `pb-harvest`
- `pb-find-precedent`
- workflow breadcrumb and playbook configuration wiring
- fork-specific safety clauses such as `llm --no-log`, impact-surface checks, and oracle reconciliation

This work does not merge upstream v0.6.7, redesign PB behavior, or convert PB into a standalone plugin.

## Architecture

### Fork contract manifest

Add a machine-readable manifest at the repository root. It contains a schema version, an upstream baseline, and feature entries. Each feature declares:

- stable feature identifier and description
- `ownedPaths`: fork-exclusive files or globs
- `integrationPaths`: shared upstream files containing minimal fork wiring
- `tests`: executable tests that prove behavior

Owned paths must exist and should remain isolated from upstream. Integration paths are overlap sensors: if an upstream comparison touches one, the corresponding feature is reported as affected. The manifest indexes boundaries; behavior remains defined by tests rather than duplicated as string assertions in configuration.

The initial baseline is v0.6.6. Callers may override the comparison base and target through command-line options so future upgrades do not require editing verifier code.

### Fork verifier

Add one Node entry point under the existing CLI scripts area. It has four stages:

1. **Contract validation**: parse the manifest; reject duplicate feature IDs, empty path/test sets, missing paths, unmatched globs, tests outside the test tree, and test files not covered by the requested test command.
2. **Impact analysis**: obtain changed paths with Git for `<base>...<target>`, intersect them with owned and integration paths, and print affected features. Missing refs or Git command failures are hard failures. An overlap is a warning plus mandatory targeted verification, not an automatic rejection.
3. **Behavior verification**: run all declared feature tests. Each feature must bind at least one test. Test failure blocks the command.
4. **Upgrade-path verification**: full mode runs repository quality checks and sandbox regressions for generated output.

The verifier must use argument arrays through `spawnSync`/`execFileSync`, never shell interpolation. It returns nonzero on malformed contracts, unavailable comparison refs, missing files, or failed checks.

### Command surface

Add root package scripts:

- `verify:fork:quick`: contract validation, optional upstream impact analysis, and declared fork tests
- `verify:fork`: quick checks plus lint, typecheck, build, full tests, and sandbox upgrade-path checks

Impact comparison options are forwarded to the verifier. With no explicit target, local development may validate the contract and tests without network access. Before an upstream merge, the operator supplies fetched refs such as `v0.6.6` and `upstream/v0.6.7`; the verifier never fetches or changes Git state itself.

## Data Flow

1. Developer fetches upstream refs separately.
2. `verify:fork` reads the contract manifest.
3. The verifier validates feature paths and tests.
4. If comparison refs are provided, Git returns the upstream changed-path set.
5. The verifier maps changed paths to feature ownership and prints a deterministic impact report.
6. Declared feature tests execute even when no overlap exists; affected features are highlighted in the summary.
7. Full mode runs repository checks and sandbox tests.
8. Any failed stage produces a nonzero exit code and prevents merge approval.

The verifier is read-only with respect to the working tree. Sandboxes use temporary directories and are removed in `finally` blocks.

## Sandbox Regression Design

### Init generation

Use production template/configurator APIs or the built CLI, following existing test conventions, to generate a temporary project. Assert that:

- PB skills and all required references are emitted
- `pb_gate.py` is emitted and wired into `task.py`
- workflow-state blocks retain PB routing
- playbook gate configuration is present
- generated gates exhibit the expected pass/block matrix

### Update preservation

Create an old-version fixture in a temporary directory with template hashes representing the previous generated state. Exercise the real update internals already covered by upstream tests, then assert:

- untouched managed files receive the fork template
- user-modified `workflow.md` is not silently overwritten
- the keep path preserves local content
- the `.new` path contains current fork functionality
- fork-owned newly introduced files are installed
- migrations do not delete PB assets or configuration

Interactive choices must be injected through existing update abstractions rather than terminal automation. If current code does not expose a stable test seam, add the smallest dependency injection boundary required by this regression; do not create a second update implementation.

## Failure Policy

The protection mechanism fails closed:

- Invalid or stale manifest: fail
- Declared path or test missing: fail
- Comparison ref unavailable: fail when comparison was requested
- Upstream overlap: report affected features and continue into mandatory tests
- Feature, sandbox, lint, typecheck, build, or full-test failure: fail
- Temporary cleanup failure after successful checks: report separately and fail only if it compromises test isolation evidence

No verifier mode automatically fetches, merges, resets, updates generated project files, or edits template hashes.

## Extensibility Rules

A new fork feature is protected only when all of the following are added in the same change:

1. Prefer fork-owned files for implementation.
2. Keep modifications to upstream-shared files to minimal wiring.
3. Register owned paths, integration paths, and tests in the manifest.
4. Add at least one behavioral test that fails when the feature is removed or disconnected.
5. Run `verify:fork` before merging.

Contract validation rejects feature entries without executable evidence, making forgotten tests visible immediately.

## Verification and Acceptance Criteria

Implementation is accepted when:

1. The manifest covers every current PB/fusion customization source path, excluding archived task evidence.
2. Removing or renaming a declared path makes quick verification fail.
3. Removing a feature's test binding makes contract validation fail.
4. A synthetic upstream comparison touching an integration path identifies the correct feature.
5. Existing `pb.test.ts` passes through the unified command.
6. Sandbox init proves PB assets and gate wiring are generated.
7. Sandbox update proves modified project files are preserved and current fork output remains available.
8. Full verification runs lint, typecheck, build, all tests, and sandbox checks with one command.
9. The verifier does not modify Git refs, source files, or real user projects.

## Rollout

Land the manifest, verifier, tests, and package scripts together on the fork branch. First run against the existing v0.6.6 baseline to establish green evidence. Then use the command on a temporary upstream-merge branch for v0.6.7. Only after full verification passes should that branch merge into `my-workflow`; project-level `trellis update` remains a separate, later operation performed first in an isolated project copy.
