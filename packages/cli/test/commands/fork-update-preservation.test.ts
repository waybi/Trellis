import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  analyzeChanges,
  collectTemplateFiles,
} from "../../src/commands/update.js";
import { computeHash } from "../../src/utils/template-hash.js";

let root: string;

function write(relativePath: string, content: string): void {
  const target = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "fork-update-"));
  fs.mkdirSync(path.join(root, ".trellis"), { recursive: true });
  fs.mkdirSync(path.join(root, ".claude"), { recursive: true });
  write(".trellis/.version", "0.6.6\n");
  write(".trellis/config.yaml", "playbook:\n  gates: true\n");
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("fork update preservation", () => {
  it("classifies pristine, customized, and new fork templates safely", async () => {
    const templates = await collectTemplateFiles(root);
    const workflowPath = ".trellis/workflow.md";
    const currentWorkflow = templates.get(workflowPath);
    expect(currentWorkflow).toContain("pb-adversarial-review");

    const oldWorkflow = "# Previous Trellis workflow\n";
    write(workflowPath, oldWorkflow);
    const hashes = { [workflowPath]: computeHash(oldWorkflow) };

    let changes = analyzeChanges(root, hashes, templates);
    expect(changes.autoUpdateFiles.map((file) => file.relativePath)).toContain(
      workflowPath,
    );

    write(workflowPath, `${oldWorkflow}USER CUSTOMIZATION\n`);
    changes = analyzeChanges(root, hashes, templates);
    const changed = changes.changedFiles.find(
      (file) => file.relativePath === workflowPath,
    );
    expect(changed).toBeDefined();
    expect(changes.autoUpdateFiles.map((file) => file.relativePath)).not.toContain(
      workflowPath,
    );

    fs.writeFileSync(`${changed?.path}.new`, changed?.newContent ?? "", "utf8");
    expect(fs.readFileSync(changed?.path ?? "", "utf8")).toContain(
      "USER CUSTOMIZATION",
    );
    expect(fs.readFileSync(`${changed?.path}.new`, "utf8")).toContain(
      "pb-adversarial-review",
    );

    expect(changes.newFiles.map((file) => file.relativePath)).toContain(
      ".trellis/scripts/common/pb_gate.py",
    );

    write(".trellis/tasks/user-task/prd.md", "user data\n");
    changes = analyzeChanges(root, hashes, templates);
    const allManaged = [
      ...changes.newFiles,
      ...changes.autoUpdateFiles,
      ...changes.changedFiles,
      ...changes.unchangedFiles,
      ...changes.userDeletedFiles,
    ].map((file) => file.relativePath);
    expect(allManaged).not.toContain(".trellis/tasks/user-task/prd.md");
  });
});
