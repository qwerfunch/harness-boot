#!/usr/bin/env python3
"""
gate_runner.py — Gate 0~5 자동 실행 (v0.3.1 시작: Gate 0 test runner 우선).

v0.3.1 범위:
  - Gate 0 (tests) 만 자동 실행. Gate 1~5 는 후속 patch 에서 확장.
  - 명령 자동 감지 (pytest → unittest discover → 사용자 프롬프트) + harness.yaml override.
  - 실행 결과 + stdout/stderr 앞부분을 구조화해 반환.

사용 (library):
  from gate_runner import run_gate_0, GateRunResult
  result = run_gate_0(project_root=Path("."))
  print(result.result)      # "pass" | "fail" | "skipped"

CLI:
  python3 scripts/gate_runner.py --gate gate_0                  # 자동 감지
  python3 scripts/gate_runner.py --gate gate_0 --cwd ./scratch
  python3 scripts/gate_runner.py --gate gate_0 --command "pytest tests/unit"
  python3 scripts/gate_runner.py --gate gate_0 --json

CQS 경계:
  이 스크립트 자체는 외부 process (pytest 등) 를 실행하므로 "부작용 있음" 분류.
  다만 harness-boot 내부 파일은 수정하지 않음 (state.yaml · harness.yaml 등).
  상태 기록은 호출 측 (/harness:work) 의 책임.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class GateRunResult:
    gate: str
    result: str                # "pass" | "fail" | "skipped"
    reason: str = ""
    command: list[str] = field(default_factory=list)
    exit_code: int | None = None
    stdout_tail: str = ""
    stderr_tail: str = ""
    duration_sec: float = 0.0

    def as_dict(self) -> dict:
        return {
            "gate": self.gate,
            "result": self.result,
            "reason": self.reason,
            "command": self.command,
            "exit_code": self.exit_code,
            "stdout_tail": self.stdout_tail,
            "stderr_tail": self.stderr_tail,
            "duration_sec": round(self.duration_sec, 3),
        }


def _tail(text: str, n_lines: int = 30) -> str:
    """text 의 마지막 n_lines 줄만 보존 (대량 출력 압축)."""
    if not text:
        return ""
    lines = text.splitlines()
    if len(lines) <= n_lines:
        return "\n".join(lines)
    return "\n".join(["... (earlier output elided)"] + lines[-n_lines:])


def detect_gate_0_command(project_root: Path) -> list[str] | None:
    """Gate 0 테스트 러너 자동 감지.

    우선순위:
      1. pyproject.toml 에 `[tool.pytest]` 섹션 → pytest
      2. `tests/` 디렉터리 + pytest binary 있음 → pytest
      3. `tests/` 디렉터리 → python -m unittest discover
      4. package.json 에 `scripts.test` → `npm test`
      5. Makefile 에 `test:` 타겟 → `make test`
      6. 감지 실패 → None
    """
    # 1+2. pyproject.toml
    pyproject = project_root / "pyproject.toml"
    if pyproject.is_file():
        try:
            text = pyproject.read_text(encoding="utf-8")
            if "[tool.pytest" in text:
                if shutil.which("pytest"):
                    return ["pytest"]
        except OSError:
            pass

    tests_dir = project_root / "tests"
    if tests_dir.is_dir():
        if shutil.which("pytest"):
            return ["pytest"]
        return [sys.executable, "-m", "unittest", "discover", "-s", "tests"]

    # 4. npm test
    pkg = project_root / "package.json"
    if pkg.is_file():
        try:
            data = json.loads(pkg.read_text(encoding="utf-8"))
            if isinstance(data.get("scripts"), dict) and "test" in data["scripts"]:
                if shutil.which("npm"):
                    return ["npm", "test"]
        except (OSError, json.JSONDecodeError):
            pass

    # 5. Makefile
    makefile = project_root / "Makefile"
    if makefile.is_file():
        try:
            for line in makefile.read_text(encoding="utf-8").splitlines():
                if line.strip().startswith("test:"):
                    if shutil.which("make"):
                        return ["make", "test"]
                    break
        except OSError:
            pass

    return None


def _harness_yaml_override(harness_dir: Path | None, gate: str) -> list[str] | None:
    """harness.yaml 에 `gate_commands.<gate>` 가 있으면 사용."""
    if harness_dir is None:
        return None
    path = harness_dir / "harness.yaml"
    if not path.is_file():
        return None
    try:
        import yaml
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    cmds = data.get("gate_commands") or {}
    if not isinstance(cmds, dict):
        return None
    val = cmds.get(gate)
    if isinstance(val, list) and all(isinstance(x, str) for x in val):
        return val
    if isinstance(val, str) and val.strip():
        return val.split()
    return None


def _execute(
    gate: str,
    cmd: list[str],
    project_root: Path,
    timeout_sec: int,
) -> GateRunResult:
    """gate 명령을 subprocess 로 실행 + 결과 포장. 공통 헬퍼."""
    import time
    t0 = time.monotonic()
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(project_root),
            capture_output=True,
            text=True,
            timeout=timeout_sec,
        )
    except subprocess.TimeoutExpired as e:
        return GateRunResult(
            gate=gate,
            result="fail",
            reason=f"timeout after {timeout_sec}s",
            command=cmd,
            stdout_tail=_tail(e.stdout or ""),
            stderr_tail=_tail(e.stderr or ""),
            duration_sec=timeout_sec,
        )
    except FileNotFoundError:
        return GateRunResult(
            gate=gate,
            result="skipped",
            reason=f"command not found: {cmd[0]}",
            command=cmd,
        )

    elapsed = time.monotonic() - t0
    result = "pass" if proc.returncode == 0 else "fail"
    return GateRunResult(
        gate=gate,
        result=result,
        reason="" if result == "pass" else f"exit {proc.returncode}",
        command=cmd,
        exit_code=proc.returncode,
        stdout_tail=_tail(proc.stdout or ""),
        stderr_tail=_tail(proc.stderr or ""),
        duration_sec=elapsed,
    )


def _resolve_command(
    gate: str,
    project_root: Path,
    override_command: list[str] | None,
    harness_dir: Path | None,
    detect_fn,
) -> list[str] | None:
    """우선순위 override → harness.yaml → auto-detect 로 명령 해석."""
    cmd = override_command
    if cmd is None:
        cmd = _harness_yaml_override(harness_dir, gate)
    if cmd is None:
        cmd = detect_fn(project_root)
    return cmd


def detect_gate_1_command(project_root: Path) -> list[str] | None:
    """Gate 1 타입 체커 자동 감지.

    우선순위:
      1. Python: pyproject.toml + mypy → mypy
      2. Python: pyproject.toml + pyright → pyright
      3. TypeScript: tsconfig.json + tsc → tsc --noEmit
      4. TypeScript: tsconfig.json + npx → npx tsc --noEmit
      5. Rust: Cargo.toml + cargo → cargo check
      6. Go: go.mod + go → go vet ./...
      7. 감지 실패 → None
    """
    pyproject = project_root / "pyproject.toml"
    if pyproject.is_file():
        if shutil.which("mypy"):
            return ["mypy", "--no-incremental", "."]
        if shutil.which("pyright"):
            return ["pyright"]

    tsconfig = project_root / "tsconfig.json"
    if tsconfig.is_file():
        if shutil.which("tsc"):
            return ["tsc", "--noEmit"]
        if shutil.which("npx"):
            return ["npx", "tsc", "--noEmit"]

    if (project_root / "Cargo.toml").is_file():
        if shutil.which("cargo"):
            return ["cargo", "check"]

    if (project_root / "go.mod").is_file():
        if shutil.which("go"):
            return ["go", "vet", "./..."]

    return None


def detect_gate_2_command(project_root: Path) -> list[str] | None:
    """Gate 2 린터 자동 감지.

    우선순위:
      1. Python: pyproject.toml + ruff     → ruff check .
      2. Python: pyproject.toml + flake8   → flake8 (legacy fallback)
      3. TypeScript/JS: package.json + eslint → eslint .
      4. TypeScript/JS: .eslintrc.* + npx  → npx eslint .
      5. Rust: Cargo.toml + cargo clippy   → cargo clippy --all-targets -- -D warnings
      6. Go: go.mod + golangci-lint        → golangci-lint run
      7. 감지 실패 → None
    """
    pyproject = project_root / "pyproject.toml"
    if pyproject.is_file():
        if shutil.which("ruff"):
            return ["ruff", "check", "."]
        if shutil.which("flake8"):
            return ["flake8"]

    if (project_root / "package.json").is_file():
        if shutil.which("eslint"):
            return ["eslint", "."]
        if shutil.which("npx"):
            return ["npx", "eslint", "."]

    eslintrc_candidates = [".eslintrc", ".eslintrc.json", ".eslintrc.yml", ".eslintrc.js", "eslint.config.js", "eslint.config.mjs"]
    if any((project_root / c).is_file() for c in eslintrc_candidates):
        if shutil.which("eslint"):
            return ["eslint", "."]
        if shutil.which("npx"):
            return ["npx", "eslint", "."]

    if (project_root / "Cargo.toml").is_file():
        if shutil.which("cargo"):
            return ["cargo", "clippy", "--all-targets", "--", "-D", "warnings"]

    if (project_root / "go.mod").is_file():
        if shutil.which("golangci-lint"):
            return ["golangci-lint", "run"]

    return None


def detect_gate_3_command(project_root: Path) -> list[str] | None:
    """Gate 3 커버리지 자동 감지.

    우선순위:
      1. Python: pyproject.toml + pytest → pytest --cov (pytest-cov 있으면 작동)
      2. Python: coverage + pytest 각각 → coverage run -m pytest 후 coverage report
      3. JS/TS: package.json.scripts.coverage → npm run coverage
      4. JS/TS: package.json + nyc bin → npx nyc npm test
      5. Rust: Cargo.toml + cargo-tarpaulin → cargo tarpaulin
      6. Rust: Cargo.toml + cargo-llvm-cov → cargo llvm-cov
      7. Go: go.mod + go → go test -cover ./...
      8. 감지 실패 → None

    **threshold**: 도구 자체 설정 (pyproject `[tool.coverage]` · package.json
    scripts · etc.) 을 따름. harness 는 tool 만 선택 · exit code 로 pass/fail 판정.
    """
    pyproject = project_root / "pyproject.toml"
    if pyproject.is_file():
        if shutil.which("pytest"):
            try:
                text = pyproject.read_text(encoding="utf-8")
                if "pytest-cov" in text or "[tool.coverage" in text:
                    return ["pytest", "--cov"]
            except OSError:
                pass
        if shutil.which("coverage") and shutil.which("pytest"):
            return ["sh", "-c", "coverage run -m pytest && coverage report"]

    pkg = project_root / "package.json"
    if pkg.is_file():
        try:
            data = json.loads(pkg.read_text(encoding="utf-8"))
            scripts = data.get("scripts", {}) if isinstance(data.get("scripts"), dict) else {}
            if "coverage" in scripts and shutil.which("npm"):
                return ["npm", "run", "coverage"]
        except (OSError, json.JSONDecodeError):
            pass
        if shutil.which("npx"):
            return ["npx", "nyc", "npm", "test"]

    if (project_root / "Cargo.toml").is_file():
        if shutil.which("cargo-tarpaulin"):
            return ["cargo", "tarpaulin"]
        if shutil.which("cargo-llvm-cov"):
            return ["cargo", "llvm-cov"]

    if (project_root / "go.mod").is_file():
        if shutil.which("go"):
            return ["go", "test", "-cover", "./..."]

    return None


def run_gate_0(
    project_root: Path,
    *,
    override_command: list[str] | None = None,
    harness_dir: Path | None = None,
    timeout_sec: int = 300,
) -> GateRunResult:
    """Gate 0 (tests) 실행. override > harness.yaml > auto-detect 우선순위."""
    cmd = _resolve_command(
        "gate_0", project_root, override_command, harness_dir, detect_gate_0_command
    )
    if cmd is None:
        return GateRunResult(
            gate="gate_0",
            result="skipped",
            reason="no test command detected (pyproject.toml · tests/ · package.json · Makefile 모두 부재)",
        )
    return _execute("gate_0", cmd, project_root, timeout_sec)


def run_gate_1(
    project_root: Path,
    *,
    override_command: list[str] | None = None,
    harness_dir: Path | None = None,
    timeout_sec: int = 300,
) -> GateRunResult:
    """Gate 1 (type check) 실행. override > harness.yaml > auto-detect."""
    cmd = _resolve_command(
        "gate_1", project_root, override_command, harness_dir, detect_gate_1_command
    )
    if cmd is None:
        return GateRunResult(
            gate="gate_1",
            result="skipped",
            reason="no type checker detected (pyproject.toml · tsconfig.json · Cargo.toml · go.mod 모두 부재 또는 tool 미설치)",
        )
    return _execute("gate_1", cmd, project_root, timeout_sec)


def run_gate_2(
    project_root: Path,
    *,
    override_command: list[str] | None = None,
    harness_dir: Path | None = None,
    timeout_sec: int = 300,
) -> GateRunResult:
    """Gate 2 (lint) 실행. override > harness.yaml > auto-detect."""
    cmd = _resolve_command(
        "gate_2", project_root, override_command, harness_dir, detect_gate_2_command
    )
    if cmd is None:
        return GateRunResult(
            gate="gate_2",
            result="skipped",
            reason="no linter detected (pyproject/ruff · package.json/eslint · Cargo/clippy · go.mod/golangci-lint 모두 부재)",
        )
    return _execute("gate_2", cmd, project_root, timeout_sec)


def run_gate_3(
    project_root: Path,
    *,
    override_command: list[str] | None = None,
    harness_dir: Path | None = None,
    timeout_sec: int = 600,
) -> GateRunResult:
    """Gate 3 (coverage) 실행. override > harness.yaml > auto-detect.

    v0.3.5 에서 신규. 기본 timeout 600s (커버리지 실행이 테스트 실행보다 길 수 있음).
    """
    cmd = _resolve_command(
        "gate_3", project_root, override_command, harness_dir, detect_gate_3_command
    )
    if cmd is None:
        return GateRunResult(
            gate="gate_3",
            result="skipped",
            reason="no coverage tool detected (pytest-cov · nyc · scripts.coverage · tarpaulin · go -cover 모두 부재)",
        )
    return _execute("gate_3", cmd, project_root, timeout_sec)

def run_gate(
    gate: str,
    project_root: Path,
    *,
    override_command: list[str] | None = None,
    harness_dir: Path | None = None,
    timeout_sec: int = 300,
) -> GateRunResult:
    """디스패처. 현재는 gate_0 (tests) · gate_1 (type check) · gate_2 (lint) 지원."""
    if gate == "gate_0":
        return run_gate_0(
            project_root,
            override_command=override_command,
            harness_dir=harness_dir,
            timeout_sec=timeout_sec,
        )
    if gate == "gate_1":
        return run_gate_1(
            project_root,
            override_command=override_command,
            harness_dir=harness_dir,
            timeout_sec=timeout_sec,
        )
    if gate == "gate_2":
        return run_gate_2(
            project_root,
            override_command=override_command,
            harness_dir=harness_dir,
            timeout_sec=timeout_sec,
        )
    if gate == "gate_3":
        return run_gate_3(
            project_root,
            override_command=override_command,
            harness_dir=harness_dir,
            timeout_sec=timeout_sec,
        )
    return GateRunResult(
        gate=gate,
        result="skipped",
        reason=f"{gate} auto-run not yet supported (v0.3.5 shipped gate_0~gate_3)",
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run a harness gate automatically")
    parser.add_argument("--gate", default="gate_0", help="gate name (currently only gate_0)")
    parser.add_argument("--cwd", type=Path, default=Path.cwd(), help="project root")
    parser.add_argument("--harness-dir", type=Path, default=None)
    parser.add_argument("--command", default=None, help="override command (space-separated)")
    parser.add_argument("--timeout", type=int, default=300)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    override = args.command.split() if args.command else None
    res = run_gate(
        args.gate,
        args.cwd,
        override_command=override,
        harness_dir=args.harness_dir,
        timeout_sec=args.timeout,
    )

    if args.json:
        json.dump(res.as_dict(), sys.stdout, indent=2, ensure_ascii=False)
        print()
    else:
        print(f"[{res.gate}] {res.result.upper()}" + (f" — {res.reason}" if res.reason else ""))
        if res.command:
            print(f"  cmd: {' '.join(res.command)}")
        if res.exit_code is not None:
            print(f"  exit: {res.exit_code}  duration: {res.duration_sec:.2f}s")
        if res.stdout_tail:
            print("  stdout tail:")
            for line in res.stdout_tail.splitlines():
                print(f"    {line}")
        if res.stderr_tail:
            print("  stderr tail:")
            for line in res.stderr_tail.splitlines():
                print(f"    {line}")

    return 0 if res.result == "pass" else (7 if res.result == "fail" else 0)


if __name__ == "__main__":
    sys.exit(main())
