// pb: fork-owned tests (waybi/Trellis my-workflow) — playbook assets and gates.
// Kept in a separate file so upstream test files stay untouched (L1 isolation).
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getBundledSkillTemplates,
  getSkillTemplates,
} from "../../src/templates/common/index.js";
import {
  configYamlTemplate,
  getAllScripts,
  workflowMdTemplate,
} from "../../src/templates/trellis/index.js";

const pythonCmd = process.platform === "win32" ? "python" : "python3";

describe("pb templates: asset discovery", () => {
  it("getSkillTemplates discovers pb-find-precedent", () => {
    const names = getSkillTemplates().map((t) => t.name);
    expect(names).toContain("pb-find-precedent");
  });

  it("getBundledSkillTemplates discovers pb-adversarial-review with 5 files", () => {
    const skill = getBundledSkillTemplates().find(
      (s) => s.name === "pb-adversarial-review",
    );
    expect(skill).toBeDefined();
    const paths = (skill?.files ?? []).map((f) => f.relativePath).sort();
    expect(paths).toEqual([
      "SKILL.md",
      "references/attack-checklist.md",
      "references/delivery-gerrit-example.md",
      "references/evidence-format.md",
      "references/l2-channel-review.md",
    ]);
  });

  it("getBundledSkillTemplates discovers pb-harvest with 4 files", () => {
    const skill = getBundledSkillTemplates().find((s) => s.name === "pb-harvest");
    expect(skill).toBeDefined();
    const paths = (skill?.files ?? []).map((f) => f.relativePath).sort();
    expect(paths).toEqual([
      "SKILL.md",
      "references/harvest-format.md",
      "references/precedent-report.md",
      "references/skill-extraction.md",
    ]);
  });

  it("getAllScripts registers common/pb_gate.py", () => {
    const scripts = getAllScripts();
    expect(scripts.has("common/pb_gate.py")).toBe(true);
    expect(scripts.get("common/pb_gate.py")).toContain("check_start_gate");
  });
});

describe("pb templates: config.yaml playbook section", () => {
  it("contains the pb-marked playbook.gates section", () => {
    expect(configYamlTemplate).toContain("# pb:begin");
    expect(configYamlTemplate).toContain("# pb:end");
    expect(configYamlTemplate).toMatch(/^playbook:$/m);
    expect(configYamlTemplate).toMatch(/^\s+gates:\s*true/m);
  });
});

describe("pb templates: workflow.md pointer insertions", () => {
  // Same block syntax as inject-workflow-state.py (backreferenced close tag).
  const blockRe = /\[workflow-state:([A-Za-z0-9_-]+)\]([\s\S]*?)\[\/workflow-state:\1\]/g;

  function extractBlocks(): Map<string, string> {
    const blocks = new Map<string, string>();
    for (const m of workflowMdTemplate.matchAll(blockRe)) {
      blocks.set(m[1], m[2]);
    }
    return blocks;
  }

  it("all six workflow-state blocks still parse with the backreference regex", () => {
    const blocks = extractBlocks();
    for (const status of [
      "no_task",
      "planning",
      "planning-inline",
      "in_progress",
      "in_progress-inline",
      "completed",
    ]) {
      expect(blocks.has(status), `block ${status} must parse`).toBe(true);
    }
  });

  it("planning blocks point to pb-adversarial-review and pb-find-precedent", () => {
    const blocks = extractBlocks();
    for (const status of ["planning", "planning-inline"]) {
      expect(blocks.get(status)).toContain("pb-adversarial-review");
      expect(blocks.get(status)).toContain("pb-find-precedent");
    }
  });

  it("in_progress blocks insert pb-harvest into Flow and delivery discipline", () => {
    const blocks = extractBlocks();
    for (const status of ["in_progress", "in_progress-inline"]) {
      const body = blocks.get(status) ?? "";
      expect(body).toMatch(/`trellis-update-spec` -> `pb-harvest` -> commit/);
      expect(body).toContain(".trellis/spec/guides/delivery.md");
    }
  });

  it("no_task and completed blocks stay pb-free", () => {
    const blocks = extractBlocks();
    for (const status of ["no_task", "completed"]) {
      expect(blocks.get(status)).not.toMatch(/pb-/);
    }
  });

  it("phase step bodies mention the start and archive gates", () => {
    expect(workflowMdTemplate).toContain("PB_SKIP_GATE=1");
    expect(workflowMdTemplate).toMatch(/archive.*会校验|会校验.*archive/s);
  });
});

describe("pb gates: behavior matrix (python)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pb-gate-"));
    const scriptsDir = path.join(tmpDir, ".trellis", "scripts");
    for (const [relativePath, content] of getAllScripts()) {
      const absPath = path.join(scriptsDir, relativePath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, "utf-8");
    }
    const runnerPath = path.join(tmpDir, "run-gate.py");
    fs.writeFileSync(
      runnerPath,
      [
        "import sys",
        "from pathlib import Path",
        "sys.path.insert(0, str(Path.cwd() / '.trellis' / 'scripts'))",
        "from common.pb_gate import check_start_gate, check_archive_gate",
        "fn = check_start_gate if sys.argv[1] == 'start' else check_archive_gate",
        "reason = fn(Path(sys.argv[2]), Path.cwd())",
        "print('GATE_PASS' if reason is None else 'GATE_BLOCK\\n' + reason)",
        "",
      ].join("\n"),
      "utf-8",
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeTask(name: string, files: Record<string, string>): string {
    const taskDir = path.join(tmpDir, ".trellis", "tasks", name);
    fs.mkdirSync(taskDir, { recursive: true });
    for (const [file, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(taskDir, file), content, "utf-8");
    }
    return taskDir;
  }

  function writeConfig(gates: string | null): void {
    const configPath = path.join(tmpDir, ".trellis", "config.yaml");
    if (gates === null) {
      fs.rmSync(configPath, { force: true });
      return;
    }
    fs.writeFileSync(configPath, `playbook:\n  gates: ${gates}\n`, "utf-8");
  }

  function runGate(
    gate: "start" | "archive",
    taskDir: string,
    env: Record<string, string> = {},
  ): string {
    const cleanEnv = { ...process.env, ...env };
    if (!("PB_SKIP_GATE" in env)) {
      delete cleanEnv.PB_SKIP_GATE;
    }
    return execSync(
      `${pythonCmd} run-gate.py ${gate} ${JSON.stringify(taskDir)}`,
      { cwd: tmpDir, env: cleanEnv, encoding: "utf-8" },
    );
  }

  const VALID_REVIEW =
    "review-level: L2\nproviders: claude\n\n## 决议\n- ✅ chain 隔离 — 已在 §3 收紧\n";
  const VALID_HARVEST = "## 分拣\n- skill: 无\n- lore-or-spec: 一条坑\n";

  it("lightweight task (no design.md) passes both gates without evidence", () => {
    const taskDir = makeTask("light", { "prd.md": "goal" });
    writeConfig("true");
    expect(runGate("start", taskDir)).toContain("GATE_PASS");
    expect(runGate("archive", taskDir)).toContain("GATE_PASS");
  });

  it("complex task without evidence is blocked on both gates", () => {
    const taskDir = makeTask("complex", { "prd.md": "goal", "design.md": "d" });
    writeConfig("true");
    expect(runGate("start", taskDir)).toContain("GATE_BLOCK");
    expect(runGate("start", taskDir)).toContain("spec-review.md");
    expect(runGate("archive", taskDir)).toContain("GATE_BLOCK");
    expect(runGate("archive", taskDir)).toContain("harvest.md");
  });

  it("complex task with valid evidence passes both gates", () => {
    const taskDir = makeTask("complex-ok", {
      "prd.md": "goal",
      "design.md": "d",
      "spec-review.md": VALID_REVIEW,
      "harvest.md": VALID_HARVEST,
    });
    writeConfig("true");
    expect(runGate("start", taskDir)).toContain("GATE_PASS");
    expect(runGate("archive", taskDir)).toContain("GATE_PASS");
  });

  it("structural violations are rejected individually", () => {
    writeConfig("true");
    const noLevel = makeTask("no-level", {
      "design.md": "d",
      "spec-review.md": "## 决议\n- ✅ ok\n",
    });
    expect(runGate("start", noLevel)).toContain("review-level");

    const noResolution = makeTask("no-resolution", {
      "design.md": "d",
      "spec-review.md": "review-level: L1\n## 决议\n(空)\n",
    });
    expect(runGate("start", noResolution)).toContain("resolution");

    const noSection = makeTask("no-section", {
      "design.md": "d",
      "harvest.md": "learned things\n",
    });
    expect(runGate("archive", noSection)).toContain("分拣");
  });

  it("gates: false disables both gates; missing config defaults to enabled", () => {
    const taskDir = makeTask("complex-off", { "design.md": "d" });
    writeConfig("false");
    expect(runGate("start", taskDir)).toContain("GATE_PASS");
    expect(runGate("archive", taskDir)).toContain("GATE_PASS");

    writeConfig(null);
    expect(runGate("start", taskDir)).toContain("GATE_BLOCK");
  });

  it("config value tolerates inline comments; invalid value falls back to enabled", () => {
    const taskDir = makeTask("complex-cfg", { "design.md": "d" });
    // Inline-comment form (spec: cli/backend/script-conventions.md config
    // fixtures MUST include `key: value  # comment`). If the comment were not
    // stripped, the value would be invalid and fall back to enabled (BLOCK).
    writeConfig("false  # opt out — gitignored .trellis/");
    expect(runGate("start", taskDir)).toContain("GATE_PASS");

    // Invalid value → default (enabled) with a stderr warning, never a crash.
    writeConfig("maybe");
    expect(runGate("start", taskDir)).toContain("GATE_BLOCK");
  });

  it("PB_SKIP_GATE=1 bypasses with a noisy warning", () => {
    const taskDir = makeTask("complex-skip", { "design.md": "d" });
    writeConfig("true");
    const out = runGate("start", taskDir, { PB_SKIP_GATE: "1" });
    expect(out).toContain("GATE_PASS");
  });
});
