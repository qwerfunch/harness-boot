"""Axis query vocabularies for the Mode B BM25 classifier.

``AXES`` is a mapping ``axis_name -> [query_token, ...]``. Each axis key
corresponds to a top-level concept in ``spec.yaml`` (``feature``,
``entity``, ``business_rule``, ``non_functional``, etc.). Mode B scores a
candidate plan.md section against every axis and routes it to the top
scorer.

Token hygiene:

- Already normalized (lowercase, NFC). Tokens in this file should match
  the output of ``scripts.mode_b_extract.tokenize`` verbatim.
- Korean particles are **not** listed here — the tokenizer's
  ``KR_PARTICLES_SUFFIX`` stripping runs before lookup, so ``기능`` (not
  ``기능을``) is the match key.
- Add domain-specific jargon via config later (v0.8+), not by editing
  this file per-project.
"""

from __future__ import annotations

AXES: dict[str, list[str]] = {
    "feature": [
        "기능", "feature", "구현", "동작", "사용자", "이벤트", "페이지", "화면",
        "플로우", "flow", "scenario", "시나리오", "request", "요청", "응답",
    ],
    "entity": [
        "엔티티", "entity", "필드", "속성", "attribute", "schema", "모델", "스키마",
        "field", "column", "데이터", "data", "record", "object",
    ],
    "business_rule": [
        "규칙", "rule", "정책", "policy", "must", "should", "제약", "invariant",
        "반드시", "금지", "허용", "불변", "원칙",
    ],
    "non_functional": [
        "p95", "p99", "성능", "가용성", "availability", "latency", "throughput",
        "응답시간", "처리량", "slo", "sla", "response", "time",
    ],
    "non_goals": [
        "비목표", "non-goal", "범위", "밖", "out", "scope", "지원",
        "제외", "exclude", "v1", "미지원",
    ],
    "tuning_constants": [
        "초", "ms", "seconds", "threshold", "임계", "계수", "timeout", "backoff",
        "delay", "interval", "retry", "rate", "limit", "coefficient",
    ],
    "open_questions": [
        "미결", "tbd", "논의", "검토", "unclear", "추후", "나중",
        "open", "question", "확정", "미정", "고민",
    ],
    "stakeholder": [
        "stakeholder", "고객", "운영", "devops", "보안팀", "legal", "개발팀",
        "customer", "admin", "operator", "팀", "이해관계자", "담당",
    ],
    "entry_points": [
        "명령", "command", "cron", "매일", "매시간", "endpoint", "http",
        "schedule", "cli", "api", "route", "실행", "trigger",
    ],
    "external_deps": [
        "stripe", "twilio", "aws", "openai", "azure", "gcp", "saas", "vendor",
        "api", "external", "thirdparty", "외부", "서비스",
    ],
    "failure_policies": [
        "재시도", "retry", "dlq", "backoff", "timeout", "circuit", "breaker",
        "exponential", "fail", "error", "예외", "실패",
    ],
    "assets": [
        "스프라이트", "sprite", "font", "팔레트", "audio", "image", "assets",
        "texture", "sound", "오디오", "이미지", "폰트", "리소스",
    ],
}
