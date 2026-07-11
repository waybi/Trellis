#!/usr/bin/env python3
"""Playbook gates (fork: waybi/Trellis my-workflow).

Hard gates for complex tasks (those with a design.md):

- start gate:   ``task.py start`` requires per-layer adversarial-review
  evidence (``prd-review.md`` / ``design-review.md`` / ``implement-review.md``)
  before the task may enter Execute.
- archive gate: ``task.py archive`` requires harvest evidence
  (``harvest.md``) before the task may be archived.

Lightweight tasks (no design.md) are always exempt. Gates can be disabled
globally via ``playbook.gates: false`` in ``.trellis/config.yaml``, or
bypassed once via the ``PB_SKIP_GATE=1`` environment variable (prints a
yellow warning so the bypass leaves a trace).

The start gate validates *existence + structure* only, never semantic
quality: it is a floor that drives "a per-layer fusion review happened",
while the review's quality is owned by the ``pb-adversarial-review`` skill
flow (two premises + context pack + per-issue walkthrough), a cooperative
agent, and the human in the loop.

Migration grandfather: if the legacy single-round ``spec-review.md`` exists,
the start gate passes outright. Tasks created under the old single-round
system are not retroactively required to produce three files; new tasks
never produce ``spec-review.md`` (the new flow produces
``prd/design/implement-review.md``) so they are naturally bound by the
three-file floor. (A new task hand-crafting ``spec-review.md`` to bypass is
equivalent to ``PB_SKIP_GATE`` and is acceptable.)

Evidence file contracts (validated structurally, not semantically —
semantic quality is owned by the skill flows):

- ``prd-review.md`` / ``design-review.md`` / ``implement-review.md``: each
  non-empty, contains a ``review-level: L1|L2`` declaration line, and at
  least one resolution marker (``✅`` / ``❌`` / ``⏳`` or ``- [x]``).
  Template: ``pb-adversarial-review`` skill.
- ``spec-review.md`` (legacy): same structure; presence grandfathers the
  start gate for pre-migration tasks.
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
FILE_PRD_REVIEW = "prd-review.md"
FILE_DESIGN_REVIEW = "design-review.md"
FILE_IMPLEMENT_REVIEW = "implement-review.md"
FILE_HARVEST = "harvest.md"

_REVIEW_LEVEL_RE = re.compile(r"^review-level:\s*(L1|L2)\b", re.MULTILINE)
_RESOLUTION_RE = re.compile(r"[✅❌⏳]|-\s\[x\]", re.IGNORECASE)
_HARVEST_SECTION_RE = re.compile(r"^##\s*分拣", re.MULTILINE)

_START_HINT = (
    "\nFix: load the `pb-adversarial-review` skill and run the per-layer fusion"
    "\nreview to produce prd-review.md / design-review.md / implement-review.md"
    "\n(each with a `review-level: L1|L2` line plus per-issue resolutions) in the"
    "\ntask directory. The gate only checks these files exist and are"
    "\nstructurally shaped; review quality is owned by fusion + the human."
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


def _check_one_review(task_dir: Path, filename: str) -> str | None:
    """Structurally validate one review file.

    Returns None when the file exists, is non-empty, carries a
    ``review-level: L1|L2`` line and at least one resolution marker;
    otherwise a rejection reason (without the fix hint, which the caller
    appends once).
    """
    evidence = task_dir / filename
    if not evidence.is_file():
        return (
            "[pb:gate] Start blocked: complex task (design.md present) is "
            f"missing {filename} adversarial-review evidence."
        )
    content = _read_text(evidence)
    if content is None or not content.strip():
        return f"[pb:gate] Start blocked: {filename} is empty or unreadable."
    if not _REVIEW_LEVEL_RE.search(content):
        return (
            f"[pb:gate] Start blocked: {filename} lacks a "
            "`review-level: L1|L2` declaration line."
        )
    if not _RESOLUTION_RE.search(content):
        return (
            f"[pb:gate] Start blocked: {filename} has no resolution "
            "markers (✅/❌/⏳ or `- [x]`)."
        )
    return None


def check_start_gate(task_dir: Path, repo_root: Path | None = None) -> str | None:
    """Validate per-layer adversarial-review evidence before ``task.py start``.

    Complex tasks must carry three per-layer review files (prd/design/
    implement-review). This is an *existence + structure* floor, not a
    quality check — review quality is owned by the ``pb-adversarial-review``
    skill flow plus the human in the loop.

    Migration grandfather: if the legacy ``spec-review.md`` exists, the gate
    passes outright (pre-migration tasks are not retroactively required to
    produce three files).

    Returns None when the gate passes (or does not apply); otherwise a
    rejection reason string including fix guidance.
    """
    if not is_complex_task(task_dir) or not gates_enabled(repo_root):
        return None
    if _env_bypass("start"):
        return None

    # Grandfather: pre-migration tasks built under the old single-round system
    # carry spec-review.md and are not retroactively bound by the three-file
    # floor. New tasks never produce spec-review.md, so they are naturally
    # subject to the per-layer check below.
    if (task_dir / FILE_SPEC_REVIEW).is_file():
        return None

    for filename in (FILE_PRD_REVIEW, FILE_DESIGN_REVIEW, FILE_IMPLEMENT_REVIEW):
        reason = _check_one_review(task_dir, filename)
        if reason is not None:
            return reason + _START_HINT
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
