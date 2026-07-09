#!/usr/bin/env python3
"""Playbook gates (fork: waybi/Trellis my-workflow).

Hard gates for complex tasks (those with a design.md):

- start gate:   ``task.py start`` requires adversarial-review evidence
  (``spec-review.md``) before the task may enter Execute.
- archive gate: ``task.py archive`` requires harvest evidence
  (``harvest.md``) before the task may be archived.

Lightweight tasks (no design.md) are always exempt. Gates can be disabled
globally via ``playbook.gates: false`` in ``.trellis/config.yaml``, or
bypassed once via the ``PB_SKIP_GATE=1`` environment variable (prints a
yellow warning so the bypass leaves a trace).

Evidence file contracts (validated structurally, not semantically —
semantic quality is owned by the skill flows):

- ``spec-review.md``: non-empty, contains a ``review-level: L1|L2``
  declaration line, and at least one resolution marker
  (``✅`` / ``❌`` / ``⏳`` or ``- [x]``). Template: ``pb-adversarial-review``
  skill, ``references/evidence-format.md``.
- ``harvest.md``: non-empty and contains a ``## 分拣`` section (an explicit
  "no harvest" verdict inside it is a legal conclusion). Template:
  ``pb-harvest`` skill, ``references/harvest-format.md``.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from .config import _is_true_config_value, _load_config
from .log import Colors, colored

DEFAULT_PLAYBOOK_GATES = True

FILE_SPEC_REVIEW = "spec-review.md"
FILE_HARVEST = "harvest.md"

_REVIEW_LEVEL_RE = re.compile(r"^review-level:\s*(L1|L2)\b", re.MULTILINE)
_RESOLUTION_RE = re.compile(r"[✅❌⏳]|-\s\[x\]", re.IGNORECASE)
_HARVEST_SECTION_RE = re.compile(r"^##\s*分拣", re.MULTILINE)

_START_HINT = (
    "\nFix: load the `pb-adversarial-review` skill to run the spec adversarial"
    "\nreview and produce spec-review.md (a `review-level: L1|L2` line plus"
    "\nper-issue resolutions) in the task directory."
    "\nEscape hatch: PB_SKIP_GATE=1 (one-off) or `playbook.gates: false` in"
    "\n.trellis/config.yaml (global)."
)

_ARCHIVE_HINT = (
    "\nFix: load the `pb-harvest` skill to run the retrospective harvest and"
    "\nproduce harvest.md (with a `## 分拣` section; an explicit no-harvest"
    "\nverdict is acceptable) in the task directory."
    "\nEscape hatch: PB_SKIP_GATE=1 (one-off) or `playbook.gates: false` in"
    "\n.trellis/config.yaml (global)."
)


def is_complex_task(task_dir: Path) -> bool:
    """A task is complex when design.md exists (upstream artifact tiering)."""
    return (task_dir / "design.md").is_file()


def gates_enabled(repo_root: Path | None = None) -> bool:
    """Whether playbook gates are enabled (``playbook.gates`` in config.yaml).

    Default: ``True``. Accepts native YAML booleans and the string aliases
    ``true / false / yes / no / 1 / 0 / on / off`` (case-insensitive).
    Invalid values fall back to ``True`` with a stderr warning.
    """
    config = _load_config(repo_root)
    playbook = config.get("playbook")
    if not isinstance(playbook, dict) or "gates" not in playbook:
        return DEFAULT_PLAYBOOK_GATES
    raw = playbook["gates"]
    if _is_true_config_value(raw):
        return True
    if isinstance(raw, bool):
        return raw
    s = str(raw).strip().lower()
    if s in ("yes", "1", "on"):
        return True
    if s in ("false", "no", "0", "off"):
        return False
    print(
        f"[WARN] invalid playbook.gates value: {raw!r}; using true (default)",
        file=sys.stderr,
    )
    return DEFAULT_PLAYBOOK_GATES


def _env_bypass(gate: str) -> bool:
    """Return True when PB_SKIP_GATE=1 requests an emergency bypass."""
    if os.environ.get("PB_SKIP_GATE") == "1":
        print(
            colored(
                f"[pb:gate] WARNING: PB_SKIP_GATE=1 — {gate} gate bypassed "
                "(emergency escape hatch; this bypass is intentionally noisy).",
                Colors.YELLOW,
            ),
            file=sys.stderr,
        )
        return True
    return False


def _read_text(path: Path) -> str | None:
    """Read a UTF-8 text file, returning None on any error."""
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return None


def check_start_gate(task_dir: Path, repo_root: Path | None = None) -> str | None:
    """Validate adversarial-review evidence before ``task.py start``.

    Returns None when the gate passes (or does not apply); otherwise a
    rejection reason string including fix guidance.
    """
    if not is_complex_task(task_dir) or not gates_enabled(repo_root):
        return None
    if _env_bypass("start"):
        return None

    evidence = task_dir / FILE_SPEC_REVIEW
    if not evidence.is_file():
        return (
            "[pb:gate] Start blocked: complex task (design.md present) has no "
            f"{FILE_SPEC_REVIEW} adversarial-review evidence." + _START_HINT
        )
    content = _read_text(evidence)
    if content is None or not content.strip():
        return (
            f"[pb:gate] Start blocked: {FILE_SPEC_REVIEW} is empty or unreadable."
            + _START_HINT
        )
    if not _REVIEW_LEVEL_RE.search(content):
        return (
            f"[pb:gate] Start blocked: {FILE_SPEC_REVIEW} lacks a "
            "`review-level: L1|L2` declaration line." + _START_HINT
        )
    if not _RESOLUTION_RE.search(content):
        return (
            f"[pb:gate] Start blocked: {FILE_SPEC_REVIEW} has no resolution "
            "markers (✅/❌/⏳ or `- [x]`)." + _START_HINT
        )
    return None


def check_archive_gate(task_dir: Path, repo_root: Path | None = None) -> str | None:
    """Validate harvest evidence before ``task.py archive``.

    Returns None when the gate passes (or does not apply); otherwise a
    rejection reason string including fix guidance.
    """
    if not is_complex_task(task_dir) or not gates_enabled(repo_root):
        return None
    if _env_bypass("archive"):
        return None

    evidence = task_dir / FILE_HARVEST
    if not evidence.is_file():
        return (
            "[pb:gate] Archive blocked: complex task (design.md present) has no "
            f"{FILE_HARVEST} harvest evidence." + _ARCHIVE_HINT
        )
    content = _read_text(evidence)
    if content is None or not content.strip():
        return (
            f"[pb:gate] Archive blocked: {FILE_HARVEST} is empty or unreadable."
            + _ARCHIVE_HINT
        )
    if not _HARVEST_SECTION_RE.search(content):
        return (
            f"[pb:gate] Archive blocked: {FILE_HARVEST} lacks a `## 分拣` section."
            + _ARCHIVE_HINT
        )
    return None
