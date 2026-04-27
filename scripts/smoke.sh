#!/usr/bin/env bash
# smoke.sh — gate_5 (runtime smoke) auto-detect entry point for harness-boot self.
#
# scripts/gate/runner.py 의 gate_5 detect 우선순위에서 scripts/smoke.sh 가
# 가장 먼저 잡힘 (npm scripts 보다 우선). 본 레포는 self_check.sh 의 5 단계
# 검증이 곧 smoke 이므로 thin wrapper 로 위임한다. F-026 에서 도입.

exec bash "$(dirname "$0")/self_check.sh" "$@"
