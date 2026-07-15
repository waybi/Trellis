import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectPlatformTemplates } from "../../src/configurators/index.js";
import {
  configYamlTemplate,
  getAllScripts,
  workflowMdTemplate,
} from "../../src/templates/trellis/index.js";

let root: string;

function write(relativePath: string, content: string): void {
  const target = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf8");
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "fork-generation-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("fork project generation", () => {
  it("emits PB assets and lifecycle wiring through production collectors", () => {
    for (const [relativePath, content] of getAllScripts()) {
      write(`.trellis/scripts/${relativePath}`, content);
    }
    write(".trellis/workflow.md", workflowMdTemplate);
    write(".trellis/config.yaml", configYamlTemplate);

    const platformTemplates = collectPlatformTemplates("claude-code");
    expect(platformTemplates).toBeDefined();
    for (const [relativePath, content] of platformTemplates ?? []) {
      write(relativePath, content);
    }

    expect(read(".trellis/scripts/common/pb_gate.py")).toContain(
      "check_start_gate",
    );
    expect(read(".trellis/scripts/task.py")).toContain("check_start_gate");
    expect(read(".trellis/scripts/common/task_store.py")).toContain(
      "check_archive_gate",
    );
    expect(read(".trellis/workflow.md")).toContain("pb-adversarial-review");
    expect(read(".trellis/config.yaml")).toMatch(/^playbook:$/m);
    expect(
      read(
        ".claude/skills/pb-adversarial-review/references/fusion-howto.md",
      ),
    ).toContain("--no-log");
    expect(read(".claude/skills/pb-harvest/SKILL.md")).toContain("pb-harvest");
    expect(
      read(".claude/skills/trellis-pb-find-precedent/SKILL.md"),
    ).toContain("trellis-pb-find-precedent");
  });
});
