# APK SAST Harness — 설계 문서

**버전**: 4.0  
**작성일**: 2026-04-15  
**상태**: 확정  
**변경 이력**: v1.0 초안 → v2.0 운영 아키텍처 → v3.0 전면 재설계 → **v4.0 Tool-First 심화 (Orchestrator 상태머신 전환, Correlator 도구화, Taint 엔진 내재화, ScanDB 기반 에이전트 통신, L1 범위 확장)**

---

## 1. 프로젝트 개요

AI 기반 자율 Android APK 정적 분석(SAST) 플랫폼.  
상태머신 Orchestrator + 티어 기반 멀티에이전트 아키텍처로 구성된다.

### 목표

- **분석 목적**: 취약점 탐지, 공격 체인 구성, 후속 에이전트(DAST·RedTeam·Reporting) 지원
- **상용 기준**: 기존 오픈소스(MobSF·QARK·AndroBugs) 대비 재현율 +20-30%p, 오탐율 동등(~10-15%) (InsecureBankv2 기준 L1 F1>83%, L2 F1>87% — §20 참조)
- **확장 방향**: 분석 결과를 소비하는 에이전트 추가 시 재분석 없이 바로 동작
- **자가 진화**: 스캔을 거듭할수록 도구가 축적되어 시스템이 점점 빨라지고 정확해짐
- **Tool-First 비율**: 전체 작업의 85-90%를 도구로, 나머지 10-15%만 LLM으로

### 입력 지원

APK / AAB / XAPK / Split APK / Instant App ZIP  
(포맷별 정규화 — §12 참조)

---

## 2. 용어 정의

프로젝트 전체에서 사용하는 핵심 용어를 통일한다.

| 용어 | 정의 | 비고 |
|---|---|---|
| **Vulnerability (취약점)** | 분석에서 탐지된 개별 보안 문제. 데이터 클래스 `Vulnerability`. | 심각도 무관 (info~critical 모두 포함) |
| **Rule (룰)** | 특정 취약점 패턴을 정의한 탐지 규칙. libsast YAML · YARA 등. | Rule Library에서 관리 |
| **Tool (도구)** | 실행 가능한 분석 함수. 결정론적이며 LLM 없이 동작. | Tool Registry에서 관리 |
| **Skill (스킬)** | 에이전트의 작업 절차서. "어떤 도구를 어떤 순서로 어떻게 판단하며 쓸지" 정의. | `.claude/skills/`에 정의 |
| **Agent (에이전트)** | 특정 분석 영역을 담당하는 자율 단위. 도구를 실행하고 필요 시 LLM으로 판단. | `.claude/agents/`에 정의 |
| **ScanDB (스캔 DB)** | 취약점·아티팩트·스캔 상태·에이전트 간 통신을 저장하는 영속 저장소. | Phase 1: SQLite, Phase 2: DynamoDB+S3 |
| **ScanResult (스캔 결과)** | 전체 스캔의 최종 출력 패키지. 취약점 목록 + 공격 체인 + 메타데이터. | Report Agent 출력 |
| **VulnGroup (취약점 그룹)** | 동일 원인에서 파생된 취약점들의 클러스터. | Correlator가 생성 |
| **AttackChain (공격 체인)** | 여러 취약점이 연결되어 구성된 실제 공격 시나리오. | Correlator가 생성 |
| **ChainTemplate (체인 템플릿)** | 알려진 공격 체인 패턴의 사전 정의. YAML로 관리. | 13개 기본 제공, 확장 가능 |
| **TaintPath (오염 경로)** | source에서 sink까지 데이터가 흐르는 코드 경로. | Taint 엔진이 추적 |
| **PropagationRule (전파 규칙)** | 메서드 호출 시 taint가 어떻게 전파되는지 정의한 규칙. | YAML DB로 관리 (74개) |

---

## 3. 설계 원칙

### 3.1 Tool-First (도구 우선)

```
핵심: 할 수 있는 것은 도구로, 도구로 안 되는 것만 LLM으로.

"LLM이 하는 일"을 분해하면 대부분이 도구로 가능하다:
  - "두 취약점이 연결되는가?" → 그래프 경로 탐색 (igraph)
  - "이 조합이 위험한 패턴인가?" → 체인 템플릿 매칭
  - "taint가 전파되는가?" → 레지스터/변수 추적 + 전파 규칙 DB
  - "confidence는 얼마인가?" → 역사적 TP/FP 통계 테이블
  - "다음에 뭘 할까?" → 상태머신 DAG

진짜 LLM이 필요한 것:
  - 난독화된 코드의 의미 해석 (자연어적 이해)
  - 콜백/리스너/필드를 통한 비정형 taint 추론
  - 완전히 새로운 탐지 도구 코드 생성 (자가 진화)
  - 비구조화 보안 리포트에서 패턴 추출
  - 경영진용 비즈니스 인사이트 생성

도구 (85-90%):
  ├── 결정론적 · 빠름 · 저비용 · 재현 가능
  ├── 패턴 매칭, taint 추적, 그래프 탐색, 체인 매칭, 통계 보정
  └── L1(Free)에서도 L2(Paid)에서도 동일하게 실행

LLM (10-15%):
  ├── 비정형 코드 이해 · 미지 패턴 발견 · 도구 생성
  └── L2(Paid) 전용
```

### 3.2 Self-Evolution (자가 진화)

```
에이전트가 새 패턴을 발견하면:
  1차: ToolCombiner가 기존 도구 조합으로 해결 시도
  2차: RegexGenerator가 패턴 → 정규표현식 자동 생성 시도
  3차: 불가 시 → LLM이 새 도구(Python 스크립트) 생성
  4. 도구를 검증 (기존 벤치마크에서 테스트)
  5. 검증 통과 → Tool Registry에 등록
  6. 다음 스캔부터: 이 패턴은 도구가 처리 (LLM 불필요)

→ 시간이 지날수록: 도구 증가, LLM 사용 감소, 스캔 속도 향상, 비용 절감
→ L1의 탐지 범위도 자동으로 확장 (새 도구가 L1에서도 실행되므로)
→ 체인 템플릿도 자가 진화 (L2에서 발견된 새 체인 → 템플릿 추가 → L1에서 사용)
```

### 3.3 Graceful Degradation (우아한 저하)

```
모든 기능은 실패해도 전체 스캔을 중단시키지 않는다.
  - 에이전트 실패 → 나머지 에이전트 결과로 부분 결과 출력
  - LLM 불가 → 도구 결과만으로 L1 수준 결과 출력
  - Code Graph 빌드 실패 → Graph 없이 진행 (체인 매칭 조건 완화, confidence 감소)
  - jadx 실패 → smali-only 모드 (코루틴 taint 제한)
  - 외부 DB 불가 → 로컬 캐시로 폴백

각 폴백 시의 F1 목표:
  - 정상 L1 (Graph 있음): F1 > 75%
  - L1 (Graph 없음): F1 > 65%
  - L2 deep (Graph 있음): F1 > 90%
  - L2 deep (Graph 없음): F1 > 80%
```

### 3.4 Local-First, Cloud-Ready (로컬 우선, 클라우드 전환 가능)

```
Phase 1 (개발·소규모): SQLite + 로컬 파일시스템
Phase 2 (운영·확장):   DynamoDB + S3 + ElastiCache

동일 인터페이스(ScanDB Protocol)로 백엔드만 교체.
```

---

## 4. 서비스 구조

```
L1 (Free) — 도구 기반 결정론적 파이프라인
  └── LLM 없음 · 5-15분 · 모든 등록 도구 고정 실행
  └── taint 추적 (smali/Java, 3-hop) · 완전 상관분석 (13개 체인 템플릿)
  └── 출력: JSON · HTML · SARIF

L2 (Paid) — 도구 + LLM 심층 분석
  └── L1 결과 이어받아 도구로 안 되는 것만 LLM 추론
  └── 15-60분 · 비정형 taint · 미지 체인 · PoC 힌트 · 도구 생성
  └── 출력: JSON · HTML · SARIF (+ 추후 Executive·Developer·Compliance)

공유 레이어 (양쪽 동일)
  └── Rule Library · Tool Registry · Taint Rule DB · Vulnerability Schema · Unpack Engine
```

### L1의 범위 (도구만으로)

L1은 LLM 없이도 다음을 모두 수행한다:

| 분석 영역 | L1에서 도구로 수행하는 것 |
|---|---|
| Manifest | 위험 권한 · exported 컴포넌트 · NSC · debuggable · allowBackup · task hijacking · tapjacking 설정 |
| 코드 | libsast 패턴 매칭 + 도구 실행 (하드코딩 키, 약한 암호화, SQL injection, XSS 등) |
| Taint | Dual-Engine taint 추적 (smali/Java, 74개 전파 규칙, 3-hop 메서드 간) |
| ICC | 명시적 Intent 추적 · putExtra/getExtra 매칭 · ContentProvider 흐름 |
| PII | PII source/sink 레지스트리 기반 탐지 + taint 경로 연결 |
| 바이너리 | YARA 스캔 (멀웨어·패커·취약 패턴) + ELF hardening 체크 |
| SCA | 패키지명 + 메서드 시그니처 핑거프린트 + 로컬 CVE DB 조회 + SBOM |
| 상관분석 | 도구 기반 완전 상관분석 (13개 체인 템플릿 + 그래프 경로 + 컴포넌트/데이터 흐름 연결) |
| 점수·매핑 | CVSS v3.1 자동 계산 + OWASP Mobile Top 10 + CWE + ConfidenceCalibrator(통계 보정) |
| 보고서 | JSON + SARIF + HTML (템플릿 기반) |

### L2가 추가하는 것

| 분석 영역 | L2에서 수행하는 것 |
|---|---|
| Taint 심층 | 콜백/리스너/필드/컬렉션을 통한 비정형 taint (LLM) · 5-hop 메서드 간 추적 (도구) |
| 미지 패턴 | 난독화·리플렉션·동적 로딩 코드의 의미 해석 (LLM) |
| 공격 체인 | 도구가 만든 체인에 자연어 설명 추가 · 비정형 체인 발견 · PoC 힌트 (LLM) |
| 도구 생성 | 새 패턴에 대한 탐지 도구 자동 생성 (LLM, 자가 진화) |
| 보고서 | 경영진용 비즈니스 인사이트 · 공격 시나리오 서술 (LLM) |
| SCA 심층 | 메서드 시그니처 핑거프린트 deep 매칭 (도구) |
| Compliance | MASVS 개별 항목 상세 매핑 (도구) |

### L1 → L2 전환

L1 `scan_id` 전달만으로 L2 시작. 언팩·Manifest·도구 스캔 재실행 없음.  
ScanDB를 이어받아 LLM이 필요한 추가 분석만 수행.

L1 결과에 L2 upsell 힌트 포함:
- "이 앱에서 난독화된 코드가 15% 감지됨. L2 분석으로 심층 추적 가능"
- "3개의 잠재적 공격 체인이 code_flow 검증 미완료. L2에서 검증 가능"

### 스캔 프로파일 (L2)

| 프로파일 | 소요 | 실행 범위 |
|---|---|---|
| quick | 5-15분 | L1 전체 + LLM 기반 결과 해석·보정 |
| deep | 15-60분 | 전체 파이프라인 + 심층 taint·비정형 체인 + 도구 생성 |
| compliance | 가변 | deep + OWASP MASVS 매핑 + CVSS 스코어링 |

---

## 5. 도구(Tool) 아키텍처 & 관리

### 5.1 도구란?

도구(Tool)는 **LLM 없이 독립 실행 가능한 분석 함수**다.  
입력과 출력이 명확하게 정의되어 있고, 동일 입력에 동일 출력을 보장한다(결정론적).

```python
@dataclass
class ToolDefinition:
    tool_id: str              # 고유 식별자 (예: "crypto_weak_aes_ecb")
    name: str                 # 사람이 읽는 이름 (예: "AES-ECB 사용 탐지")
    category: str             # manifest | code | binary | sca | crypto | network | taint | correlation | ...
    version: str              # 시맨틱 버전 (예: "1.2.0")
    status: str               # core | generated | experimental
    agent_scope: List[str]    # 이 도구를 사용할 수 있는 에이전트 목록
    input_type: str           # "source_file" | "smali_file" | "binary" | "manifest" | "vuln_list" | ...
    output_type: str          # "vulnerabilities" | "taint_paths" | "connections" | "chains" | "metadata" | ...
    script_path: str          # 실행 파일 경로
    created_by: str           # "human" | 에이전트 ID
    created_at: datetime
    accuracy: ToolAccuracy    # 정확도 통계 (TP/FP/FN)
    description: str          # 무엇을 탐지하는지
```

### 5.2 도구 생명주기

```
[human 작성] → core (핵심 도구)

[에이전트 생성] → experimental (미검증)
  → 벤치마크 테스트 + 사람 리뷰 → generated (검증 완료)
  → 누적 성공 (N≥20) + 팀 리뷰 → core 승격

[폐기] → archived (이력 보존)
```

### 5.3 Tool Registry (도구 등록소)

```
tool_registry/
├── core/                    # 팀이 직접 작성한 핵심 도구
│   ├── manifest/            # 10+ 도구
│   ├── code/                # 15+ 도구
│   ├── taint/               # Taint 엔진 도구 (신규)
│   ├── binary/              # 5+ 도구
│   ├── sca/                 # 5+ 도구
│   ├── correlation/         # 7개 Correlator 도구 (신규)
│   └── intelligence/        # 분류·변환 도구 (신규)
├── generated/               # 에이전트가 생성 + 검증 완료
├── experimental/            # 에이전트가 생성, 아직 미검증
├── archived/                # 폐기된 도구 (이력 보존)
└── registry.json            # 전체 도구 목록 + 메타데이터
```

### 5.4 도구 생성 흐름 (자가 진화)

```
1. 에이전트가 기존 도구로 탐지 불가한 새 패턴 발견
2. ToolCombiner가 기존 도구 조합으로 해결 시도 (도구)
3. RegexGenerator가 정규표현식 생성 시도 (도구)
4. 불가 시 → LLM이 패턴을 분석하고 탐지 도구(Python 함수) 생성
5. 생성 시점 검증: AST 검사 + 허용 모듈만 import + ToolTemplate 상속 강제
6. 벤치마크 앱에서 자동 테스트 (오탐율 체크)
7. 오탐율 < 20% → Tool Registry experimental/에 등록
8. 사람 리뷰 후 → generated/로 승격
9. 이후 L1에서도 자동 실행
```

### 5.5 도구 보안 (4-Layer 방어)

```
Layer 1 — 생성 시점:
  ├── AST 파싱: 허용 모듈만 import (re, os.path, hashlib, json, xml.etree)
  ├── 차단: os.system, subprocess, socket, requests, eval, exec
  ├── ToolTemplate 강제: 도구는 file_content(문자열)만 입력으로 받음
  └── 코드 길이 제한 (500줄 이하)

Layer 2 — 실행 시점 (experimental 도구):
  ├── seccomp 프로파일: open/connect/execve 차단
  ├── 리소스: CPU 30초, 메모리 256MB, 디스크 없음, 네트워크 없음
  └── 입력 주입: Orchestrator가 file_content를 stdin으로 전달

Layer 3 — 검증 시점:
  ├── 벤치마크 회귀 테스트 + Adversarial Test Suite
  └── Human Review Checklist

Layer 4 — 운영 시점:
  ├── 동일 입력/다른 출력 시 알림 (비결정론 감지)
  ├── 오탐율 30% 초과 시 자동 비활성화
  └── 롤백: archived로 이동 + 이전 버전 폴백
```

### 5.6 ToolTemplate (생성 도구 기반 클래스)

```python
class ToolTemplate(ABC):
    @abstractmethod
    def scan(self, file_content: str, file_path: str,
             file_type: str) -> List[Finding]:
        """
        도구가 직접 파일을 열 수 없다.
        file_content = 이미 읽힌 소스 텍스트.
        """
        ...
```

### 5.7 L1에서의 도구 실행

L1은 `core` + `generated` 상태의 모든 도구를 결정론적으로 실행한다.  
`experimental` 도구는 L1에서 실행하지 않는다 (미검증).

도구 실행 최적화:
- `input_type`으로 필터링 (Java 파일에는 Java 도구만)
- `category`로 필터링 (에이전트별 관련 카테고리만)
- 파일당 실제 실행 도구: ~10-15개
- ThreadPoolExecutor로 병렬 실행

---

## 6. 에이전트-스킬-도구 관계

### 6.1 세 개념의 구분

```
Agent (에이전트) = WHO — "누가 이 분석을 담당하나?"
  └── 역할 정의 · 책임 범위 · 다른 에이전트와의 관계

Skill (스킬) = HOW — "어떤 절차로 분석을 수행하나?"
  └── 도구 호출 순서 · 결과 해석 기준 · 판단 분기 · 에스컬레이션 조건

Tool (도구) = WHAT — "실제로 무엇을 실행하나?"
  └── 결정론적 함수 · 입출력 정의 · LLM 없이 독립 실행
```

**비유**: 의사(Agent)가 MRI 기계(Tool)를 쓰되, "언제 MRI를 찍고, 결과를 어떻게 읽고, 이상이 있으면 어떤 추가 검사를 할지"는 전문 지식(Skill)이다.

### 6.2 예시: Code Agent의 `taint-trace` 스킬

```markdown
## 스킬: taint-trace (Taint 추적) / 담당: Code Agent

### 절차:
1. jadx Java 소스 존재 여부 확인
2. 있으면 JavaSourceTaintTracer 사용 (코루틴 포함)
3. 없으면 IntraMethodTaintTracer 사용 (smali, 코루틴 제외)
4. Taint Propagation Rule DB (74개) 로드하여 적용
5. SourceSinkMatcher로 source-sink 쌍 검증
6. InterMethodTaintTracer로 메서드 간 추적 (3-hop)
7. 코루틴 감지 시 → limitations 기록 + L2 upsell 힌트

### L1 vs L2:
- L1: 위 절차를 그대로 (도구만, 3-hop)
- L2: 위 절차 + 5-hop + 콜백/필드/컬렉션 비정형 흐름을 LLM이 추론
```

---

## 7. Orchestrator & 에이전트 구성 (10개 + Orchestrator)

### Orchestrator — 상태머신 (LLM 없음)

```
구현: Python asyncio 상태머신 (LangGraph ReAct가 아님)
이유: 실행 순서가 DAG이고, 에스컬레이션은 조건 라우팅이고,
      에러 복구는 폴백 체인이다. LLM이 "다음에 뭘 할까" 고민할 이유가 없다.

실행 DAG:
  start → unpack → [manifest | code_phase1 | binary | sca] (병렬)
  manifest → code_phase2
  전체 Tier 2 완료 → correlator → report → end

에스컬레이션: ScanDB escalation_flags 테이블 기반 조건 라우팅
Human-in-the-Loop: 고위험 스크립트 실행 전, PoC 힌트 생성 전 (조건 체크)
체크포인트: ScanDB에 스캔 상태 기록 → 크래시 시 미완료 에이전트만 재실행
```

```python
class Orchestrator:
    EXECUTION_DAG = {
        "start": ["unpack"],
        "unpack": ["manifest", "code_phase1", "binary", "sca"],
        "manifest": ["code_phase2"],
        "code_phase1": ["tier2_join"],
        "code_phase2": ["tier2_join"],
        "binary": ["tier2_join"],
        "sca": ["tier2_join"],
        "tier2_join": ["correlator"],
        "correlator": ["report"],
        "report": ["end"],
    }

    ESCALATION_RULES = {
        "obfuscation_detected": "heuristic_agent",
        "reflection_heavy": "heuristic_agent",
        "dynamic_loading": "heuristic_agent",
        "unknown_pattern": "heuristic_agent",
    }
```

---

### Tier 0 — Intelligence (트리거 실행, 비동기)

#### Intel Agent

- **역할**: 외부 위협 인텔리전스 수집·평가·분류 라우팅
- **트리거**: 주 1회 스케줄 OR Code Agent 미지 패턴 이벤트
- **스킬**: `intel-crawl` · `intel-eval` · `intel-classify`
- **분류**: 패턴/룰 → Signature Agent pending/ · 스크립트 → Heuristic pending/ · 복합 → 둘 다
- **데이터 소스**: GitHub API · CVE/NVD · OWASP MASTG · 보안 블로그
- **도구 기반**: 구조화 소스(CVE/NVD/GitHub) → IntelClassifier(CWE 매핑 테이블 + API 필드 필터, LLM 불필요)
- **LLM**: 비구조화 소스(보안 블로그)에서 1차 키워드 필터 통과 후에만 Haiku로 분류 (전체의 ~20%)

#### Signature Agent

- **역할**: Rule Library(libsast/YARA 룰) 관리·진화
- **스킬**: `sig-compose` · `sig-convert` · `sig-evaluate` · `sig-version` · `sig-dedupe`
- **도구 기반**:
  - SemgrepToLibsastConverter: Semgrep YAML → libsast YAML 구조적 변환 (LLM 불필요)
  - RuleRefiner: 오탐 패턴 통계 분석 → 자동 패턴 좁히기 (LLM 불필요)
  - RuleDeduplicator: 벤치마크 실행 결과 비교로 중복 검사 (LLM 불필요)
- **LLM**: 비구조화 입력에서 새 룰 초안 작성, 의미적 오탐 판단 시에만 Haiku (전체의 ~40%)
- **품질 목표**: 오탐율 <15% · 재현율 >85%
- **Rule Library**: core/ · community/ · pending/ · archived/

#### Heuristic Agent

- **역할**: 시그니처 불가 케이스 — 행위·구조 기반 심층 분석
- **스킬**: `heuristic-sandbox` · `heuristic-promote`
- **도구**: 35개 / 8 카테고리 (난독화, 동적 로딩, 네이티브, 인터프로시저, 심층 스말리, 안티분석, 커스텀 암호화, 고급 검색)
- **도구 기반 전처리 (LLM 호출 전)**:
  - StringConstantPropagator: 리플렉션 대상 문자열을 smali에서 정적 추적
  - KnownReflectionMatcher: 프레임워크(Gson/Room/Dagger/Firebase) 리플렉션 자동 필터링
  - ToolCombiner: 기존 도구 조합으로 새 탐지 가능한지 시도
- **LLM**: 도구 전처리 후에도 미해결인 미지 패턴 분석 + 도구 생성에만 Sonnet (전체의 ~70%)
- **도구 승격**: 동일 패턴 N회(≥5) → Signature Agent에 룰 편입 제안

---

### Tier 1 — Preparation (순차, 블로킹)

#### Unpack Agent

- **역할**: 포맷 정규화 → 역컴파일 → 공유 레이어 빌드
- **스킬**: `format-normalize` · `apk-decompile` · `pkg-isolate` · `graph-build` · `index-build`
- **언팩**: §12 참조 (apktool+jadx → smali-only → unzip 폴백)
- **출력**: decompiled_path, smali_files, java_files, manifest_path, pkg_map, Code Graph, Code Index
- **LLM**: 없음

---

### Tier 2 — Analysis (부분 의존 병렬)

**실행**: Unpack 완료 후 4개 동시 시작. Code Agent는 2-Phase로 분리되어 Phase 1은 즉시, Phase 2는 Manifest 완료 후 시작. Manifest는 보통 10-30초면 완료되므로 실질 대기 시간은 0에 가깝다.

```
Unpack 완료
  ├── Manifest Agent (즉시) ──→ Code Agent Phase 2 (Manifest 완료 후)
  ├── Code Agent Phase 1 (즉시, Manifest 독립, 전체의 ~70%)
  ├── Binary Agent (즉시)
  └── SCA Agent (즉시)
```

#### Manifest Agent

- **역할**: AndroidManifest.xml 전담
- **스킬**: `manifest-audit` · `perm-score` · `attack-surface` · `flag-check`
- **탐지**: 위험 권한 · exported 컴포넌트(Android 12+ 기본값 처리) · NSC · debuggable · allowBackup · task hijacking(launchMode+taskAffinity) · tapjacking(filterTouchesWhenObscured) · custom permission protectionLevel
- **출력**: ScanDB에 취약점 적재 + agent_outputs에 exported_components 저장
- **LLM**: 없음

#### Code Agent

- **역할**: 소스코드 전담
- **2-Phase 설계**:
  - **Phase 1** (Manifest 독립, 즉시 시작): libsast 패턴 매칭 + Tool Registry 도구 실행 + 하드코딩 검출 + Dual-Engine Taint 추적
  - **Phase 2** (Manifest 완료 후): exported 컴포넌트 Intent 검증 + ContentProvider injection + BroadcastReceiver trust
- **Taint 엔진** (§7A 참조):
  - DualEngineTaintTracker: jadx Java 소스 우선, smali 폴백
  - Taint Propagation Rule DB: 74개 규칙 (StringBuilder, Collection, Bundle, JSON 등)
  - IntraMethodTaintTracer + InterMethodTaintTracer (L1: 3-hop, L2: 5-hop)
  - CoroutineDetector: Kotlin 코루틴 감지 → Java 엔진 사용 또는 limitations 기록
- **스킬**: `code-scan` · `taint-trace` · `icc-flow` · `pii-track` · `graph-query`
- **에스컬레이션**: 난독화·리플렉션·동적 로딩 감지 → ScanDB escalation_flags에 기록
- **LLM**: L2에서만 Sonnet (비정형 taint 추론 ~30%, 도구 생성)

#### Binary Agent

- **역할**: 바이너리 전담
- **스킬**: `yara-scan` · `elf-hardening` · `native-analyze`
- **탐지**: YARA(멀웨어·패커) · ELF(RELRO·PIE·NX·canary) · 바이너리 하드코딩
- **LLM**: 없음

#### SCA Agent

- **역할**: 서드파티 CVE + SBOM + 라이선스
- **스킬**: `lib-detect` · `sbom-generate` · `cve-lookup` · `license-audit` · `fingerprint-match`
- **탐지**: 패키지명 시그니처 → 폴백: 메서드 시그니처 핑거프린트(§7B 참조) → 폴백: YARA 시그니처
- **SBOM**: CycloneDX/SPDX
- **LLM**: 없음

---

### Tier 3 — Synthesis (순차)

#### Correlator — 도구 기반 파이프라인 (LLM 없이 공격 체인 구성)

```
입력: ScanDB의 전체 취약점 + Code Graph + 컴포넌트 목록

Step 1: 연결 수집 (3개 도구 병렬)                [~3초]
  ├── ChainGraphTracer    → code_flow 연결 (igraph shortest_path)
  ├── ChainComponentLinker → same_component 연결 (파일 경로 매칭)
  └── ChainDataflowLinker  → data_flow 연결 (변수명 교차 검사)

Step 2: 체인 매칭 (1개 도구)                      [~1초]
  └── ChainTemplateMatcher → 13개 템플릿 매칭

Step 3: 그룹핑 (1개 도구)                         [~1초]
  └── VulnGrouper → 동일 root cause 그룹핑

Step 4: 점수 계산 (1개 도구)                      [~0.5초]
  └── ChainScorer → 위험도 점수 + severity 결정

Step 5: 정리 (1개 도구)                           [~0.5초]
  └── ChainDedup → 중복 체인 제거 + 정렬

총 소요: ~5-10초, 비용: $0, 결정론적

[L2만] Step 6: LLM 보강 (선택적)
  ├── 완성된 체인에 자연어 설명 추가 (~3K 토큰)
  ├── 비정형 체인 탐색
  └── 고위험 체인에 PoC 힌트 생성
```

**Graph 부재 시 폴백**: ChainGraphTracer 스킵, ChainTemplateMatcher의 `code_flow` 조건을 `same_component`/`data_flow`로 대체 (confidence 0.2 감소 + limitation 표기).

**체인 템플릿 13개**: Intent Injection(T001) · Crypto Downgrade(T002) · MITM(T003) · Backup Leak(T004) · WebView Exploit(T005) · Deep Link Hijacking(T006) · Debug Exposure(T007) · IPC Privilege Escalation(T008) · Known CVE(T009) · PII Leak(T010) · StrandHogg(T011) · Tapjacking(T012) · Clipboard Leak(T013)

**체인 템플릿 자가 진화**: L2에서 LLM이 새 체인을 발견하면 ChainTemplate YAML로 변환 → 사람 리뷰 → templates/ 추가 → 다음 스캔부터 L1에서도 도구로 검출.

#### Report Agent

- **역할**: ScanDB → ScanResult 생성
- **스킬**: `summary-build` · `final-dedup` · `cross-dedup` · `sarif-export`
- **도구 기반**:
  - SummaryTemplateEngine: 통계 집계 + Jinja2 템플릿 (LLM 불필요)
  - VulnDescriptionBuilder: 룰 메타데이터 + 위치 정보 조합 (LLM 불필요)
  - Cross-agent dedup: location + category 기반 중복 제거 (LLM 불필요)
- **LLM**: L2에서만 Haiku (경영진용 비즈니스 인사이트 + 공격 시나리오 서술)
- **출력**: ScanResult + JSON + SARIF + HTML

---

## 7A. Taint 엔진 (신규)

### 아키텍처

```
DualEngineTaintTracker
  ├── jadx Java 소스가 있으면 → JavaSourceTaintTracer (코루틴 포함)
  ├── 없으면 → IntraMethodTaintTracer (smali, 코루틴 제외)
  └── 양쪽 모두 → Taint Propagation Rule DB (74개) 적용

IntraMethodTaintTracer (smali 기반)
  ├── 레지스터 직접 할당 추적 (move 계열)
  ├── invoke 시 Propagation Rule DB 조회 → taint 전파 판단
  ├── Source/Sink DB 매칭
  └── 단일 메서드 내 완전 추적

JavaSourceTaintTracer (jadx Java 기반)
  ├── 변수명 기반 추적 (smali보다 직관적)
  ├── 동일 Propagation Rule DB 적용
  ├── Kotlin 코루틴 복원 코드에서도 동작
  └── jadx 실패 시 사용 불가 (smali 폴백)

InterMethodTaintTracer (Code Graph 기반)
  ├── IntraMethodTaintTracer가 "tainted 변수를 다른 메서드에 전달"을 감지
  ├── Code Graph에서 호출 대상 메서드를 찾아 재귀 추적
  ├── 깊이 제한: L1=3-hop, L2=5-hop
  └── confidence: depth에 따라 감소 (0.85 × 0.9^depth)

CoroutineDetector
  ├── smali에서 ContinuationImpl/invokeSuspend 패턴 감지
  ├── Java 소스 사용 시: 무시 (Java에서 코루틴 복원됨)
  └── smali만 사용 시: 코루틴 메서드를 limitations에 기록
```

### Taint Propagation Rule DB (74개)

YAML 기반, 코드 변경 없이 규칙 추가/수정 가능.

| 카테고리 | 규칙 수 | 예시 |
|---|---|---|
| 문자열 조작 | 18 | StringBuilder.append, String.format, concat, substring, trim |
| 컬렉션 | 12 | List.add/get, Map.put/get, Set.add, Iterator.next, Arrays.asList |
| Android Bundle/Intent | 10 | Bundle.putString/getString, Intent.putExtra/getStringExtra, Uri.parse |
| I/O + 인코딩 | 10 | Base64.decode/encode, URLEncoder, BufferedReader.readLine |
| JSON 처리 | 8 | JSONObject.put/get/getString, Gson.fromJson |
| SharedPreferences | 5 | Editor.putString, SP.getString/getAll |
| ContentProvider/Cursor | 6 | ContentResolver.query, Cursor.getString/getBlob |
| 타입 변환 | 5 | Integer.parseInt, Long.parseLong, Object.toString |

### Source/Sink DB

**Source** (외부 입력):
- Intent 파라미터: getStringExtra, getData, getExtras
- ContentProvider: ContentResolver.query
- User Input: EditText.getText
- Network: HttpURLConnection.getInputStream
- File: FileInputStream, SharedPreferences.getString

**Sink** (위험 실행점):
- SQL: rawQuery, execSQL
- Command: Runtime.exec, ProcessBuilder
- WebView: loadUrl, evaluateJavascript
- Log: Log.d/i/w/e
- Network: HttpURLConnection.getOutputStream, OkHttp
- File: FileOutputStream, SharedPreferences.Editor.putString

---

## 7B. SCA 메서드 시그니처 핑거프린팅 (신규)

### 문제

R8/ProGuard 난독화 → 패키지명 변경 → 패키지명 기반 탐지율 ~30%로 하락.

### 해결

난독화는 이름을 바꾸지만 구조는 보존한다. 메서드의 파라미터 타입 수/순서, 리턴 타입, 클래스의 메서드/필드 수 등을 조합하면 난독화에 강인한 핑거프린트가 된다.

### 핑거프린트 DB

```
lib_fingerprint_db/
├── index.json              # 라이브러리 목록 + 메타데이터
├── fingerprints/           # 라이브러리별 핑거프린트 (500개 × 10버전 = 5,000)
└── lsh_index.bin           # LSH 인덱스 (빠른 후보 검색)

크기: ~300MB (로컬 저장 충분)
```

### 매칭

- Stage 1 (빠른 필터): class_count + avg_method_count 벡터 → LSH 후보 검색
- Stage 2 (정밀 매칭): ClassFingerprint 1:1 매칭 (헝가리안 알고리즘), 매칭 비율 > 60% → 확정
- Stage 3 (문자열 확인): unique_string_literals로 버전 핀포인트

---

## 8. 공유 레이어

| 레이어 | 구현 | 역할 |
|---|---|---|
| Code Graph | igraph (.pickle) | 콜그래프, 3-Tier 서브그래프 전략 (§16 참조) |
| Code Index | JSON 인덱스 | 클래스·메서드·문자열 검색 |
| ScanDB | SQLite → DynamoDB+S3 | 취약점 · 아티팩트 · 상태 · 에이전트 통신 (§14 참조) |
| Tool Registry | 로컬 파일시스템 | 도구 목록·메타·실행파일 |
| Rule Library | 로컬 파일시스템 | libsast YAML · YARA 룰 |
| Taint Rule DB | YAML | 74개 전파 규칙 + Source/Sink DB |
| Chain Template DB | YAML | 13개 체인 템플릿 |
| Fingerprint DB | JSON + LSH | SCA 라이브러리 핑거프린트 |
| Benchmark DB | 다중 벤치마크 | 오탐/미탐 기준 + Calibration (§20 참조) |

---

## 9. 취약점 스키마 (vulnerability.py)

```python
@dataclass
class Vulnerability:
    # ── 식별 ──
    vuln_id: str
    scan_id: str
    agent_id: str
    rule_id: str
    tool_id: str
    analysis_depth: str       # L1 | L2-quick | L2-deep | L2-compliance
    detected_at: datetime

    # ── 핵심 ──
    title: str
    description: str
    risk: str
    attack_scenario: str

    # ── 위치 ──
    file_path: str
    line_start: int
    line_end: int
    method_signature: str
    class_name: str
    code_snippet: str

    # ── 심각도 ──
    severity: str             # critical | high | medium | low | info
    confidence: float         # 0.0 ~ 1.0
    cvss_vector: str
    cvss_score: float

    # ── 분류 ──
    category: str             # crypto | network | storage | ipc | auth | taint | ...
    owasp_mobile: str         # M1 ~ M10
    cwe_id: str

    # ── 관계 ──
    related_vulns: List[str]
    chain_id: Optional[str]
    group_id: Optional[str]
    is_group_primary: bool

    # ── Taint 정보 (신규) ──
    taint_source: Optional[str]
    taint_sink: Optional[str]
    taint_path: Optional[List[str]]
    propagation_rules_used: Optional[List[str]]

    # ── 증거·한계 ──
    evidence: List[str]
    limitations: List[str]

    # ── 조치 ──
    remediation: str
    remediation_effort: str
    references: List[str]

    # ── DAST 연계 (후속용) ──
    testable_endpoints: List[str]
    input_vectors: List[str]
    trigger_condition: str
    auth_required: bool
    network_required: bool

    # ── RedTeam 연계 (후속용) ──
    exploitability: str
    prerequisites: List[str]
    privilege_required: str
    impact_scope: str
    tool_hints: List[str]
    poc_scaffold: str

    # ── 내부 라우팅 ──
    escalate_to: Optional[str]
```

### 9.1 VulnGroup

```python
@dataclass
class VulnGroup:
    group_id: str
    root_cause: str
    primary_vuln: Vulnerability
    affected_locations: List[Location]
    member_count: int
    aggregate_severity: str
```

그룹핑 기준: Same Rule+Source / Call-chain Propagation / Configuration Root Cause

### 9.2 AgentResult (신규 — 에이전트 표준 출력)

```python
@dataclass
class AgentResult:
    agent_id: str
    scan_id: str
    status: str                     # COMPLETED | PARTIAL | FAILED | SKIPPED
    vulnerabilities_count: int
    elapsed_seconds: float
    limitations: List[str]
    escalation_flags: List[EscalationFlag]
    output_keys: List[str]          # ScanDB agent_outputs에 저장된 키 목록

@dataclass
class EscalationFlag:
    flag_type: str          # obfuscation_detected | reflection_heavy | ...
    target_agent: str       # heuristic_agent | signature_agent | ...
    priority: str           # high | medium | low
    context: dict           # 에스컬레이션 컨텍스트
```

### 9.3 ScanResult

```python
@dataclass
class ScanResult:
    scan_id: str
    apk_info: ApkInfo
    input_format: str
    analysis_depth: str
    config_snapshot: str
    started_at: datetime
    completed_at: datetime
    status: str               # COMPLETED | PARTIAL | FAILED | DEGRADED

    vulnerabilities: List[Vulnerability]
    vuln_groups: List[VulnGroup]
    vuln_count: VulnCount
    attack_chains: List[AttackChain]

    classes_analyzed: int
    smali_files: int
    sdk_excluded: List[str]
    limitations: List[str]
    sbom: Optional[str]
    upgrade_hint: Optional[str]

    scan_metrics: ScanMetrics
    tools_used: List[str]
    tools_generated: List[str]
    taint_stats: TaintStats   # 신규: taint 엔진 통계
    chain_stats: ChainStats   # 신규: 체인 통계
```

---

## 10. 룰셋 전략

| 포맷 | 역할 | 담당 |
|---|---|---|
| libsast YAML | 코어 패턴 룰 (Java·Kotlin·XML) | Signature Agent |
| YARA | 바이너리 패턴 룰 (DEX·ELF·.so) | Signature Agent + Binary Agent |
| Semgrep YAML | 참조만 — SemgrepToLibsastConverter(도구)로 변환 | Signature Agent |
| Taint Propagation YAML | 메서드별 taint 전파 규칙 (74개) | Code Agent Taint 엔진 |
| Chain Template YAML | 공격 체인 패턴 정의 (13개) | Correlator |

**Semgrep 변환**: 패턴 매칭·regex·단순 조건 → SemgrepToLibsastConverter(도구)로 자동 변환. taint·join·metavariable → 변환 불가, Heuristic 위임.

**Rule Library**: core/ · community/ · pending/ · archived/

---

## 11. 에이전트 간 메시지 흐름

```
모든 에이전트 간 데이터 교환은 ScanDB(agent_outputs 테이블)을 통해 수행.
Orchestrator LLM 컨텍스트를 경유하지 않으므로 토큰 제한과 무관.

Intel Agent     → ScanDB → Signature/Heuristic Agent (신규 발견물)
Unpack Agent    → ScanDB agent_outputs → Manifest Agent (manifest_path)
Unpack Agent    → ScanDB agent_outputs → Code Agent (smali_files, java_files, decompiled_path)
Manifest Agent  → ScanDB agent_outputs → Code Agent Phase 2 (exported_components)
Signature Agent → ScanDB → Code·Manifest·Binary Agent (최신 룰셋)
Code Agent      → ScanDB escalation_flags → Heuristic Agent (미탐 에스컬레이션)
Heuristic Agent → ScanDB → Signature Agent (룰 승격 제안)
Heuristic Agent → Tool Registry (새 도구 등록)
모든 분석 에이전트 → ScanDB vulnerabilities (취약점 적재)
Correlator      → ScanDB (공격 체인 + 취약점 그룹)
```

장점: 메시지가 ScanDB에 영속되므로 크래시 후 재개 시 손실 없음, 디버깅 시 추적 가능.

---

## 12. 입력 포맷 & 언팩 프로세스

(v3.0과 동일 — §12.1~12.5 변경 없음)

### 12.1 지원 포맷

| 포맷 | 정규화 전략 |
|---|---|
| **APK** | 그대로 역컴파일 |
| **AAB** | bundletool → universal.apk. 불가 시 base+feature 개별 추출 머지. |
| **XAPK** | ZIP 해제 → 내부 APK 추출. OBB는 asset으로 별도 보관. |
| **Split APK** | base.apk primary + config/feature에서 추가 DEX·lib·resources 머지. |
| **Instant App** | 각 feature APK 추출 → 전체 머지. |

### 12.2 언팩 파이프라인 (2단계 폴백)

```
APK 확보됨
  │
  ═══ Stage 1: apktool + jadx ═══
  │
  ├── apktool decode --no-src → resources + manifest (XML)
  ├── jadx → DEX → Java 소스
  ├── 성공 → smali + java + manifest + resources 확보 → 완료
  ├── jadx 실패 → smali-only 모드 (apktool smali 출력 사용, Java 없음)
  │   → Taint 엔진이 smali 모드로 전환 (코루틴 추적 제한)
  └── apktool 실패 → Stage 2로
  │
  ═══ Stage 2: unzip 폴백 ═══
  │
  ├── unzip APK → raw 파일 추출
  ├── AndroidManifest.xml → androguard → AXMLPrinter2 → aapt2 (3단계 폴백)
  ├── classes*.dex → baksmali → smali / dex2jar → jadx (선택적)
  ├── resources.arsc → aapt2 dump resources
  ├── assets/ → .dex 발견 시 baksmali, .so 발견 시 Binary 대상 추가
  ├── lib/{abi}/*.so → Binary Agent 대상
  └── META-INF/ → 서명 정보 추출
```

### 12.3~12.5

(v3.0과 동일 — 바이너리 XML 디코딩, 인코딩 처리, 머지 규칙)

---

## 13. 피드백 루프 & 자가 진화

```
스캔 중 (즉시):
  Code Agent 에스컬레이션 → ScanDB escalation_flags → Heuristic Agent
  에이전트 새 패턴 발견 → ToolCombiner 시도 → 불가 시 LLM 도구 생성 → experimental/
  L2 Correlator가 새 체인 발견 → ChainTemplate YAML 생성 → templates/ pending

스캔 간 (사람 리뷰):
  오탐 확인 → RuleRefiner(도구) 자동 보정 + Signature Agent 검증
  미탐 확인 → Signature Agent → 신규 룰
  도구 리뷰 → experimental → generated 승격
  체인 템플릿 리뷰 → pending → active 승격

주기적:
  Intel Agent → IntelClassifier(도구)로 1차 분류 → pending/ 큐 투입
  ConfidenceCalibrator → 누적 TP/FP 통계로 calibration_table 업데이트

누적:
  Heuristic 반복 패턴 N회(≥5) → Signature 룰 승격
  generated 도구 성공 N회(≥20) → core 승격 검토
  generated 체인 템플릿 매치 N회(≥10) → core 승격 검토
```

---

## 14. 데이터 저장소 (ScanDB)

### 14.1 인터페이스

```python
class ScanDB(Protocol):
    # 취약점
    async def save_vulnerability(self, vuln: Vulnerability) -> str: ...
    async def get_vulnerabilities(self, scan_id: str, **filters) -> List[Vulnerability]: ...
    async def check_duplicate(self, scan_id: str, dedup_key: str) -> bool: ...

    # 체크포인트
    async def save_checkpoint(self, checkpoint: ScanCheckpoint) -> None: ...
    async def get_checkpoint(self, scan_id: str) -> Optional[ScanCheckpoint]: ...

    # 아티팩트
    async def save_artifact(self, scan_id: str, name: str, data: bytes) -> str: ...
    async def get_artifact(self, scan_id: str, name: str) -> bytes: ...

    # 결과
    async def save_result(self, result: ScanResult) -> None: ...
    async def get_result(self, scan_id: str) -> Optional[ScanResult]: ...

    # 에이전트 간 통신 (신규)
    async def save_agent_output(self, scan_id: str, agent_id: str,
                                output_type: str, output_json: str) -> None: ...
    async def get_agent_output(self, scan_id: str, agent_id: str,
                               output_type: str) -> Optional[str]: ...

    # 에스컬레이션 (신규)
    async def save_escalation(self, scan_id: str, source_agent: str,
                              target_agent: str, flag_type: str,
                              context: Optional[dict] = None) -> None: ...
    async def get_pending_escalations(self, scan_id: str,
                                      target_agent: str) -> List[dict]: ...
    async def mark_escalation_done(self, escalation_id: int) -> None: ...

    # Confidence Calibration (신규)
    async def get_calibration_table(self) -> Dict[str, dict]: ...
    async def update_calibration(self, rule_id: str, is_true_positive: bool) -> None: ...
```

### 14.2 Phase 1: SQLite + 로컬

```
scan_data/
├── db/sast.db           # vulnerabilities, scan_state, tool_registry,
│                        # agent_outputs, escalation_flags, calibration (신규 3개)
├── artifacts/{scan_id}/ # 역컴파일, 그래프, SBOM, SARIF
└── cache/               # CVE 캐시, SDK 필터, 핑거프린트 캐시
```

**agent_outputs 테이블**:
```sql
CREATE TABLE agent_outputs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id     TEXT NOT NULL,
    agent_id    TEXT NOT NULL,
    output_type TEXT NOT NULL,
    output_json TEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(scan_id, agent_id, output_type)
);
```

**escalation_flags 테이블**:
```sql
CREATE TABLE escalation_flags (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id       TEXT NOT NULL,
    source_agent  TEXT NOT NULL,
    target_agent  TEXT NOT NULL,
    flag_type     TEXT NOT NULL,
    context_json  TEXT,
    status        TEXT DEFAULT 'pending',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**dedup**: `SHA256(rule_id + file_path + line_start + method_signature)` → UNIQUE 제약.  
**Cross-agent dedup**: 같은 file_path + category + 라인 범위 겹침 → confidence 높은 것 선택, 나머지는 related_vulns.

### 14.3 Phase 2: AWS 마이그레이션

SQLite → DynamoDB, 로컬 파일 → S3, 캐시 → ElastiCache. `ScanDB` 구현체만 교체.

---

## 15. 실행 환경 (Docker)

(v3.0과 동일)

에이전트 자체가 Docker 컨테이너에서 실행 = 컨테이너가 곧 샌드박스.

```
Docker Container (per-scan):
  ├── Orchestrator + 에이전트 + 분석 도구 전부 포함
  ├── 네트워크: LLM API·ScanDB 접근만 허용
  ├── 파일시스템: /work만 쓰기, 나머지 read-only
  ├── 리소스: CPU 4 / RAM 8GB / disk 20GB
  ├── seccomp 기본 프로파일 + no-new-privileges
  └── 이미지: python:3.11-slim + 분석 도구 고정 버전
```

고위험 스크립트(experimental, pending): §5.5 4-Layer 방어 적용.

---

## 16. Code Graph (igraph)

```python
class CodeGraphAdapter(Protocol):
    def get_callers(self, method_sig: str) -> List[str]: ...
    def get_callees(self, method_sig: str) -> List[str]: ...
    def shortest_path(self, source: str, sink: str) -> Optional[List[str]]: ...
    def subgraph(self, node_sigs: List[str]) -> 'CodeGraphAdapter': ...

class IGraphCodeGraph(CodeGraphAdapter): ...   # 기본 (C 기반, 빠름)
class NetworkXCodeGraph(CodeGraphAdapter): ... # 소형/디버깅용
```

### 3-Tier 서브그래프 전략 (대형 앱 대응)

```
Tier A — SDK 제거 (항상 적용):
  pkg_map에서 앱/SDK 분리 → SDK 노드 제거 (경계 노드 보존)
  효과: 200K → ~40K 노드 (80% 감소)

Tier B — Entry/Sink 기반 (40K+ 노드 시):
  entry_points(exported 컴포넌트, JS Bridge, Deep Link 등) ∩ sink_points(SQL, exec, WebView 등)
  → 양쪽에서 도달 가능한 노드만 추출
  효과: 40K → ~5-15K 노드

Tier C — 온디맨드 확장:
  Correlator가 특정 경로 검증 시 N-hop 이웃 확장 로드

캐싱: full_graph.pickle (Tier A 후) + attack_surface_graph.pickle (Tier B)
```

---

## 17. 장애 내성

**Tier 1** (블로킹): jadx 실패→smali-only(코루틴 제한), apktool 실패→unzip 폴백, Graph 실패→없이 진행(체인 조건 완화)  
**Tier 2** (개별 허용): 에이전트 실패→스킵+limitations, 전체 타임아웃→partial 결과로 Tier 3  
**Tier 3** (부분 허용): Correlator 실패→체인 없이 출력, Report 실패→raw JSON+SARIF  
**LLM 폴백** (L2만): Retry 2회 → Fallback Model → 전체 불가 시 L1 수준 결과 (status=DEGRADED)

**체크포인트**: ScanDB에 스캔 상태 기록 → 크래시 시 미완료 에이전트만 재실행.

**타임아웃**: LLM 60초, 에이전트 5~30분, 전체 L1 20분/L2 120분, 외부 DB 15초, jadx 10분, apktool 5분.

---

## 18. LLM 전략 (AWS Bedrock)

| 에이전트 | LLM 사용 | 도구 처리 비율 | Primary | Fallback |
|---|---|---|---|---|
| Orchestrator | 없음 (상태머신) | 100% | — | — |
| Code Agent | L2만 (비정형 taint) | ~75% | Sonnet 4 | Haiku 4 |
| Correlator | L2만 (설명+PoC) | ~95% | Sonnet 4 | Haiku 4 |
| Heuristic | L2만 (미지 패턴+도구 생성) | ~30% | Sonnet 4 | Haiku 4 |
| Intel | L2만 (비구조화 분류) | ~80% | Haiku 4 | Llama 3.1 8B |
| Signature | L2만 (시맨틱 룰 작성) | ~60% | Haiku 4 | Llama 3.1 8B |
| Report | L2만 (인사이트) | ~70% | Haiku 4 | Llama 3.1 8B |
| Manifest/Binary/SCA/Unpack | 없음 | 100% | — | — |

### 비용 추정 (중형 앱 30MB deep 스캔)

```
L1: $0 (LLM 없음)
L2 deep: ~$0.74
  - Code Agent: ~$0.45 (비정형 taint ~90K 토큰)
  - Heuristic: ~$0.25 (미지 패턴 ~42K 토큰)
  - Correlator: ~$0.02 (체인 설명 ~3K 토큰)
  - Report: ~$0.015 (인사이트 ~10K 토큰)
  - 기타: ~$0.005

앱 규모별:
  소형 (5MB):   L1 $0, L2 deep ~$0.30
  중형 (30MB):  L1 $0, L2 deep ~$0.74
  대형 (80MB):  L1 $0, L2 deep ~$1.50
  슈퍼앱:       L1 $0, L2 deep ~$2-4
```

---

## 19. 구성(Configuration) 관리

(v3.0과 동일)

4-레이어: system_defaults.yaml → organization.yaml → project.yaml → scan_request.json  
우선순위: 요청 > 프로젝트 > 조직 > 기본값. 스캔 시작 전 검증 + 스냅샷 저장.

---

## 20. 테스트 & 벤치마크

**벤치마크 앱**: InsecureBankV2, DIVA, PIVAA, InjuredAndroid, MASTG CrackMe/UnCrackable, GoatDroid, 오픈소스 앱(FP 측정), R8 앱(난독화 내성)

### 20.1 최종 목표

```
"기존 오픈소스 도구(MobSF, QARK, AndroBugs)보다 더 많은 취약점을 찾되,
 오탐율은 비슷하거나 더 낮은 수준을 유지한다."

정량 목표:
  - 재현율(Recall): 기존 도구 대비 +20-30%p 향상
  - 오탐율(FPR): 기존 도구와 동등 (~10-15%)
  - F1 Score: 기존 도구 대비 +15-20%p 향상

차별화 근거:
  기존 도구가 놓치는 것을 우리가 잡는 이유:
  1. Taint 엔진 (74개 전파 규칙) → Intent 미검증→SQL injection 체인
  2. 체인 템플릿 (13개) → 복합 취약점 조합 탐지
  3. 메서드 시그니처 핑거프린트 → 난독화 앱 SCA
  4. Cross-agent 상관분석 → 에이전트 간 결과 연결

  오탐이 비슷한 이유:
  1. ConfidenceCalibrator → 역사적 TP/FP 통계 기반 자동 보정
  2. Cross-agent dedup → 중복 탐지 제거
  3. 도구 기반(결정론적) → LLM 비결정론적 오탐 없음
  4. 벤치마크 사전 보정 → rule별 오탐 패턴 학습
```

### 20.2 InsecureBankv2 Ground Truth

InsecureBankv2 공식 취약점 25개 중 SAST 탐지 가능 21개(must_detect), 부분 탐지 2개, DAST 전용 2개.

카테고리별: IPC/컴포넌트 5개, 암호화/저장 6개, 네트워크 3개, 코드/설정 5개, 복합/심층 6개.

앱별 YAML로 관리: id, title, category, cwe, owasp, severity, sast_detectable, must_detect, detection_method, expected_chains, false_positives.

### 20.3 기존 도구 대비 탐지 비교 (InsecureBankv2 기준 추정)

| 영역 | GT 건수 | MobSF | QARK | AndroBugs | Ours(L1) | Ours(L2) |
|---|---|---|---|---|---|---|
| Manifest | 5 | 4-5 | 3-4 | 3-4 | **5** | **5** |
| 하드코딩/암호화 | 4 | 2-3 | 1-2 | 2-3 | **4** | **4** |
| 네트워크 | 3 | 2-3 | 1-2 | 2 | **3** | **3** |
| IPC/Injection | 4 | 2 | 2-3 | 1-2 | **4** | **4** |
| 저장소/로깅 | 3 | 1-2 | 1 | 1-2 | **3** | **3** |
| WebView/복합 | 2 | 1 | 0-1 | 0-1 | **2** | **2** |
| **합계 TP** | **21** | **~12-15** | **~8-12** | **~9-12** | **~21** | **~21** |
| **FP** | — | ~5-8 | ~3-5 | ~5-8 | ~4-6 | ~3-5 |
| **Recall** | — | ~57-71% | ~38-57% | ~43-57% | **≥90%** | **≥95%** |
| **FPR** | — | ~10-15% | ~8-12% | ~10-15% | ~10-13% | ~8-12% |
| **F1** | — | ~60-73% | ~47-66% | ~49-63% | **≥83%** | **≥87%** |

### 20.4 기존 도구가 놓치고 우리가 잡는 8가지

1. **Intent 미검증 → SQL injection 체인** — Taint 엔진(getStringExtra → rawQuery 경로 추적)
2. **하드코딩 키 + ECB 모드 조합** — 체인 템플릿 T002(Crypto Downgrade)
3. **SharedPref 평문 + allowBackup 조합** — 체인 템플릿 T004(Backup Leak)
4. **ContentProvider SQL injection** — exported CP + rawQuery에 taint 도달
5. **Log에 민감정보** — Taint source(password 변수) → Log.d sink
6. **Clipboard 비밀번호 유출** — ChainDataflowLinker + 체인 템플릿 T013
7. **Developer Backdoor** — 엔트로피 분석 + "devadmin" 하드코딩 패턴
8. **비밀번호 변경 시 기존 PW 미검증** — 인증 흐름 패턴 룰

### 20.5 공격 체인 Ground Truth (6개)

| 체인 ID | 체인 | 심각도 | 구성 취약점 |
|---|---|---|---|
| GT_CHAIN_001 | Exported Activity → Intent Injection → SQL Injection | Critical | GT_004 + GT_002 + GT_005 |
| GT_CHAIN_002 | MITM: 평문 HTTP + 인증서 미검증 + Pinning 없음 | Critical | GT_012 + GT_013 + GT_014 |
| GT_CHAIN_003 | Backup → SharedPref 평문 → 하드코딩 자격증명 유출 | Critical | GT_011 + GT_008 + GT_009 |
| GT_CHAIN_004 | WebView JS + 외부 URL → XSS | High | GT_020 |
| GT_CHAIN_005 | Debug 빌드 + 민감 로깅 → 정보 노출 | High | GT_015 + GT_010 |
| GT_CHAIN_006 | 약한 암호화 + 하드코딩 키 → 로컬 데이터 복호화 | Critical | GT_006 + GT_009 |

### 20.6 F1 목표 (모드별)

| 모드 | InsecureBankv2 F1 | 전체 벤치마크 F1 | 오탐율 |
|---|---|---|---|
| L1 (Graph 있음) | > 83% | > 75% | < 13% |
| L1 (Graph 없음) | > 75% | > 65% | < 15% |
| L2 quick | > 85% | > 80% | < 12% |
| L2 deep (Graph 있음) | > 87% | > 90% | < 10% |
| L2 deep (Graph 없음) | > 82% | > 80% | < 12% |

### 20.7 벤치마크 자동화

**CI/CD**: PR 머지 시 L1 quick 통과 필수, 주간 전체 deep + MobSF 비교 리포트 자동 생성.

**ConfidenceCalibrator**: 벤치마크 사전 보정(cold start) → 운영 중 누적 TP/FP로 정밀화.

---

## 21. Compliance 매핑

(v3.0과 동일)

현재: CVSS v3.1 자동 계산 + OWASP Mobile Top 10 + CWE 매핑.  
미래: Compliance Agent가 MASVS·PCI-DSS·HIPAA 상세 매핑.

---

## 22. 에이전트 프로파일링

ROI 추적(시간·토큰·취약점·비용), Adaptive Quick(APK 특성별 도구 선택), Confidence Calibration(ConfidenceCalibrator 도구 — 역사적 TP/FP 통계 기반 자동 보정).

---

## 23. 관측성

Phase 1: JSON logging + SQLite 메트릭. Phase 2: CloudWatch + X-Ray.

핵심: 스캔 소요시간·상태·비용, 에이전트별 성능·폴백·도구생성, Taint 엔진 통계(경로 수·엔진 선택·코루틴 감지), 체인 통계(매칭 수·Graph 사용 여부), 실시간 진행률(WebSocket/SSE).

---

## 24. SaaS 프론트엔드 아키텍처

### 24.1 서비스 흐름

```
사용자 → [Web UI] → [API Gateway] → [Scan Worker] → [ScanDB]
                                          ↓
                                    [분석 결과]
                                          ↓
                              [결과 대시보드 / 보고서 다운로드]
```

### 24.2 프론트엔드 구성 (3-Screen)

MobSF의 UX 패턴을 기반으로 하되, SaaS 차별화를 적용한다.

```
Screen 1: Upload (파일 업로드)
  ├── 드래그 & 드롭 영역 (APK / AAB / XAPK / Split APK)
  ├── 지원 포맷 표시 + 최대 200MB
  ├── L1(무료) / L2(유료) 티어 선택
  ├── 최근 스캔 히스토리 (보안 점수 포함)
  └── API Key 기반 CI/CD 연동 안내

Screen 2: Analysis (분석 진행)
  ├── 실시간 진행률 바 (WebSocket/SSE)
  ├── 분석 단계 로그 (15단계 시각화)
  │   → 포맷 감지 → 디컴파일 → 패키지 맵 → Graph → Manifest
  │   → 코드 스캔 → Taint → 바이너리 → SCA → 상관분석 → 보고서
  ├── 현재 단계 하이라이트 + 예상 잔여 시간
  └── 에러 시 Graceful 메시지 (부분 결과로 진행)

Screen 3: Dashboard (분석 결과)
  ├── 보안 점수 링 (0-100)
  ├── 심각도 분포 바 차트
  ├── 탭 기반 상세 뷰:
  │   ├── 개요: 점수 + 통계 + 앱 정보 + 공격 체인 미리보기
  │   ├── 취약점: 심각도 필터 + 확장형 카드 (코드 스니펫 + 조치 방안)
  │   ├── 공격 체인: 시각적 흐름 (V001 → V009 → V005) + L2 upsell
  │   ├── Manifest: Exported 컴포넌트 그리드
  │   └── 권한: dangerous/normal 분류 테이블
  ├── 보고서 다운로드 (PDF · SARIF · JSON)
  └── L2 심층 분석 업그레이드 버튼
```

### 24.3 기술 스택

```
프론트엔드: React + TypeScript + Tailwind CSS
  ├── 파일 업로드: react-dropzone (드래그 & 드롭)
  ├── 실시간 진행: WebSocket (ScanDB checkpoint 구독)
  ├── 차트: Recharts (심각도 분포, 카테고리 비율)
  ├── 코드 하이라이팅: Prism.js (취약점 코드 스니펫)
  └── 보고서: 서버사이드 PDF 생성 (WeasyPrint)

백엔드 API: FastAPI (Python 3.11)
  ├── POST /api/v1/upload         → 파일 업로드 + 스캔 시작
  ├── GET  /api/v1/scan/{id}      → 스캔 상태 조회
  ├── WS   /api/v1/scan/{id}/ws   → 실시간 진행률 스트림
  ├── GET  /api/v1/scan/{id}/result → 분석 결과 조회
  ├── GET  /api/v1/scan/{id}/report/{format} → PDF/SARIF/JSON 다운로드
  ├── GET  /api/v1/scans          → 스캔 히스토리 목록
  ├── POST /api/v1/scan/{id}/upgrade → L1→L2 업그레이드
  └── DELETE /api/v1/scan/{id}    → 스캔 삭제

인프라:
  ├── Phase 1: 단일 서버 (FastAPI + 분석 Docker per-scan + SQLite)
  ├── Phase 2: AWS (ALB + ECS Fargate + DynamoDB + S3 + SQS)
  └── 인증: Auth0/Cognito → JWT 기반

파일 처리:
  ├── 업로드: S3 presigned URL (대용량) 또는 직접 업로드 (소용량)
  ├── 크기 제한: L1 200MB / L2 500MB
  ├── 저장: 업로드 파일 → S3 (30일 보존) → 자동 삭제
  └── 보안: 업로드 시 MIME 타입 검증 + 바이러스 스캔
```

### 24.4 실시간 진행률 프로토콜

```python
# WebSocket 메시지 형식
{
    "type": "progress",
    "scan_id": "abc-123",
    "step": 7,
    "total_steps": 15,
    "step_label": "코드 패턴 스캔 (libsast)",
    "percent": 46.7,
    "elapsed_seconds": 125,
    "estimated_remaining": 147,
    "vulns_found_so_far": 23,  # 중간 결과
}

# 에러 메시지
{
    "type": "warning",
    "message": "jadx 부분 실패 — smali-only 모드로 전환",
    "impact": "Kotlin 코루틴 taint 추적이 제한될 수 있습니다",
}

# 완료 메시지
{
    "type": "complete",
    "scan_id": "abc-123",
    "status": "COMPLETED",
    "security_score": 28,
    "total_vulns": 47,
    "redirect_url": "/scan/abc-123/dashboard",
}
```

### 24.5 L1 → L2 upsell UX

```
L1 결과 대시보드에 자연스러운 L2 upsell 포인트:

1. 공격 체인 카드 하단:
   "🧠 L2 분석으로 이 체인의 PoC 힌트와 상세 공격 시나리오를 확인할 수 있습니다"

2. 취약점 목록에서 confidence < 0.7인 항목:
   "🔍 L2 심층 분석으로 이 탐지의 정확도를 높일 수 있습니다"

3. limitations 섹션:
   "난독화 코드 15% 감지 · 코루틴 3개 메서드 미추적 → L2에서 해결 가능"

4. 헤더의 L2 업그레이드 버튼:
   scan_id 전달만으로 L2 시작 (재업로드 불필요)
```

### 24.6 멀티테넌트 & 조직 관리

```
인증·권한:
  ├── 사용자 → 조직 소속 (1:N)
  ├── 역할: admin · analyst · viewer
  ├── 스캔 결과는 조직 내에서만 공유
  └── API Key: 조직별 발급 (CI/CD용)

요금제:
  ├── Free: L1 스캔, 월 10건, 200MB, 30일 보존
  ├── Pro: L1 + L2, 월 100건, 500MB, 90일 보존, API 접근
  └── Enterprise: 무제한, SSO, 전용 인프라, SLA

사용량 추적:
  ├── 스캔 수 · LLM 토큰 · 저장소 · API 호출
  └── 대시보드에 사용량 표시 + 임계값 알림
```

---

## 25. 프로젝트 구조

```
apk_sast_harness/
├── CLAUDE.md · DESIGN.md
├── config/ (system_defaults.yaml · bedrock_config.py · organizations/ · projects/)
├── .claude/agents/ (10개) · .claude/skills/ (27개+)
├── schemas/ (vulnerability.py · scan_result.py · tool_definition.py ·
│            agent_result.py · escalation.py · config_validator.py)
├── lib/ (scan_db.py · graph_adapter.py · tool_registry.py · bedrock_client.py ·
│        cvss_calculator.py · owasp_mapper.py · axml_decoder.py · config_loader.py ·
│        taint_engine.py · propagation_db.py · confidence_calibrator.py ·
│        orchestrator.py)
├── api/ (신규 — SaaS 백엔드)
│   ├── main.py              # FastAPI 앱
│   ├── routes/ (upload.py · scan.py · report.py · auth.py · org.py)
│   ├── ws/ (progress.py)    # WebSocket 진행률
│   ├── services/ (scan_service.py · report_service.py · billing_service.py)
│   └── middleware/ (auth.py · rate_limit.py · cors.py)
├── frontend/ (신규 — React SPA)
│   ├── src/
│   │   ├── pages/ (Upload.tsx · Analysis.tsx · Dashboard.tsx · History.tsx)
│   │   ├── components/ (SecurityScoreRing · SeverityBadge · VulnCard · ChainFlow ·
│   │   │               FileDropzone · AnalysisLog · PermissionTable)
│   │   ├── hooks/ (useScanProgress.ts · useScanResult.ts)
│   │   └── api/ (client.ts)
│   ├── public/
│   └── package.json
├── tool_registry/ (core/ · generated/ · experimental/ · archived/ · registry.json)
│   └── core/ (manifest/ · code/ · taint/ · binary/ · sca/ ·
│              correlation/ · intelligence/)
├── taint_rules/ (propagation.yaml · sources.yaml · sinks.yaml)
├── chain_templates/ (T001-T013 YAML)
├── rule_library/ (core/ · community/ · pending/ · archived/)
├── lib_fingerprint_db/ (index.json · fingerprints/ · lsh_index.bin)
├── scan_data/ (db/ · artifacts/ · cache/)
├── tests/ (unit/ · integration/ · benchmark/ · e2e/ · frontend/)
│   └── benchmark/ (ground_truth/ · graph_comparison.yaml)
├── docker/ (Dockerfile.api · Dockerfile.worker · Dockerfile.frontend)
├── tools/bin/ (apktool · jadx · baksmali · dex2jar · bundletool)
├── docker-compose.yaml · docker-compose.prod.yaml
└── pyproject.toml
```

---

## 26. 외부 의존성

**백엔드**: apktool≥2.9.3 · jadx≥1.5.0 · baksmali≥2.5.2 · dex2jar · bundletool≥1.15.0 · androguard · yara-python · libsast · igraph · cyclonedx-python-lib · cvss · langgraph(L2 에이전트 내부용) · langchain(L2) · boto3 · FastAPI · uvicorn · python-jose(JWT) · Docker≥24.0 · Python≥3.11 · Jinja2 · WeasyPrint(PDF)

**프론트엔드**: React≥18 · TypeScript · Tailwind CSS · react-dropzone · Recharts · Prism.js · WebSocket API

---

## 27. 개발 순서

```
Phase 1 (뼈대):
  schemas + AgentResult/EscalationFlag + config + SQLiteScanDB(agent_outputs·escalation_flags 포함)
  + Tool Registry + Orchestrator 상태머신 + Docker + logging
  + FastAPI 기본 구조 + 업로드/스캔 API + React 업로드 페이지

Phase 2 (Tier 1 — Unpack):
  전 포맷 + 2단계 폴백 + axml 디코딩 + igraph(3-Tier 전략) + Code Index
  + WebSocket 진행률 스트림 + React 분석 진행 페이지

Phase 3 (Tier 2 — 분석):
  Phase 3a (3주): Taint 엔진 + 핵심 도구
    Taint Propagation Rule DB (74개 YAML) + IntraMethodTaintTracer(smali)
    + JavaSourceTaintTracer(jadx) + DualEngineTaintTracer + CoroutineDetector
    + SourceSinkMatcher + PII_SourceRegistry + PII_SinkRegistry
  Phase 3b (2주): Manifest + Binary + SCA + ExplicitIntentTracer + IntentExtraLinker
  Phase 3c (1주): Code Agent Phase 1/2 통합 + Tier 2 병렬 실행 검증 + 벤치마크 F1 측정
  + React 결과 대시보드 (개요 + 취약점 + 권한 + Manifest 탭)

Phase 4 (Intelligence):
  Signature(SemgrepToLibsastConverter·RuleRefiner·RuleDeduplicator)
  + Heuristic(StringConstantPropagator·KnownReflectionMatcher·ToolCombiner)
  + Intel(IntelClassifier) + 도구 생성 파이프라인

Phase 5 (Tier 3 — 합성):
  Correlator 도구 기반(ChainGraphTracer·ChainTemplateMatcher(13개)·ChainComponentLinker
  ·ChainDataflowLinker·VulnGrouper·ChainScorer·ChainDedup)
  + InterMethodTaintTracer + ConfidenceCalibrator(cold start bootstrap)
  + Report(SummaryTemplateEngine·VulnDescriptionBuilder·SARIF·HTML·PDF)
  + React 공격 체인 탭 + 보고서 다운로드

Phase 6 (품질 + SaaS):
  CVSS + OWASP + SCA 핑거프린트 DB 구축 + 벤치마크(Graph 유/무·코루틴 유/무)
  + 프로파일링 + org/project 구성
  + 인증(Auth0/Cognito) + 멀티테넌트 + 요금제 + API Key 관리 + 스캔 히스토리

Phase 7 (E2E):
  전 포맷 · L1→L2 · 장애 시나리오 · 오탐/재현율 · SARIF · 비용 실측
  + 프론트엔드 E2E 테스트 (Playwright) · CI/CD 연동 · 부하 테스트
```

---

## 28. 미래 확장

**Phase 2 추가**: APKiD 통합(패커/컴파일러 감지), 인증서 상세 분석(X.509 체인, 약한 알고리즘)

**Phase 6 추가**: Exodus Tracker DB 통합, 악성 도메인 DB, VirusTotal API 연동(선택적)

**장기 확장**: Compliance Agent · DAST Agent(Docker 앱 실행 환경 + Frida + mitmproxy) · RedTeam Agent · Incremental Scan · SDK Fingerprint 자동 관리 · ScanDB AWS 마이그레이션 · 코루틴 전용 smali 추적기 · 체인 템플릿 자동 생성 파이프라인 · iOS IPA 지원

모든 후속 에이전트는 ScanResult만으로 동작 가능.

---

## 부록 A: Heuristic Agent 35개 도구 스펙

| 카테고리 | 도구 수 | 도구 목록 |
|---|---|---|
| 난독화 탐지 | 5 | obf_class_name_entropy · obf_string_encryption · obf_control_flow · obf_reflection_heavy · obf_packer_detect |
| 동적 로딩 | 4 | dynload_dexclassloader · dynload_asset_dex · dynload_network_dex · dynload_native_load |
| 네이티브 코드 | 5 | native_jni_registration · native_crypto_custom · native_anti_debug · native_root_check · native_ssl_bypass |
| 인터프로시저 | 4 | ipc_implicit_intent · ipc_pending_intent_mutable · ipc_deep_link_hijack · ipc_broadcast_sensitive |
| 심층 Smali | 5 | smali_taint_simple · smali_unsafe_reflection · smali_thread_unsafe_crypto · smali_exception_leak · smali_serialization_vuln |
| 안티분석 | 4 | anti_emulator_detect · anti_frida_detect · anti_tamper_check · anti_debug_java |
| 커스텀 암호화 | 4 | crypto_xor_simple · crypto_custom_base64 · crypto_hardcoded_iv · crypto_weak_random |
| 고급 검색 | 4 | search_url_sensitive · search_firebase_misconfig · search_api_endpoint · search_webview_js_bridge |

---

## 부록 B: 전체 도구 목록 (83개)

기존 35개 (Heuristic) + 신규 24개 (Tool-First 전환) + 기존 24개 (Manifest/Code/Binary/SCA 내장) = 83개

신규 24개:
- **Taint (7)**: IntraMethodTaintTracer · JavaSourceTaintTracer · DualEngineTaintTracker · InterMethodTaintTracer · CoroutineDetector · SourceSinkMatcher · TaintPropagationDB
- **Correlation (7)**: ChainGraphTracer · ChainTemplateMatcher · ChainComponentLinker · ChainDataflowLinker · VulnGrouper · ChainScorer · ChainDedup
- **Intelligence (7)**: IntelClassifier · SemgrepToLibsastConverter · RuleRefiner · RuleDeduplicator · StringConstantPropagator · KnownReflectionMatcher · ToolCombiner
- **Report (2)**: SummaryTemplateEngine · VulnDescriptionBuilder
- **Common (1)**: ConfidenceCalibrator

---

## 부록 C: MobSF 대비 기능 비교 & 갭 분석

MobSF v4.4 (2026.03 기준)와 모듈별 1:1 비교. MobSF가 강한 부분은 벤치마킹하고, 우리가 우위인 부분은 유지·강화한다.

### C.1 분석 파이프라인 비교

| 분석 단계 | MobSF | APK SAST Harness | 차이 |
|---|---|---|---|
| **Unpack** | apktool + jadx, 단일 경로 | apktool+jadx → smali-only → unzip 3단계 폴백 | 우리 우위: 폴백으로 실패율 감소 |
| **Manifest** | XML 파싱 + 룰 매칭 | 동일 + task hijacking + tapjacking + Android 12 기본값 | 우리 우위: 더 넓은 커버리지 |
| **Code** | libsast(regex) + semgrep | libsast + semgrep + Taint 엔진(74규칙) + 83개 도구 | **핵심 차별**: taint 추적 |
| **Binary** | YARA + ELF basic | YARA + ELF(RELRO·PIE·NX·canary) + Heuristic 35도구 | 우리 우위: native 심층 분석 |
| **SCA** | 패키지명 기반 | 패키지명 + 메서드 시그니처 핑거프린트 + CVE DB | 우리 우위: 난독화 앱 SCA |
| **상관분석** | 없음 (개별 발견만) | 7개 도구 + 13개 체인 템플릿 + 그래프 경로 | **핵심 차별**: 공격 체인 구성 |
| **인증서** | SHA1/SHA256 + 서명 검증 | 동일 | 동등 |
| **악성코드** | VirusTotal API + APKiD | YARA 커스텀 + APKiD (VirusTotal은 SaaS에서) | MobSF 우위: VT 통합 기본 |
| **트래커** | Exodus tracker DB | 미구현 (Phase 2) | **갭**: 트래커 탐지 추가 필요 |
| **도메인 검사** | Malware domain check | 미구현 (Phase 2) | **갭**: 도메인 평판 체크 추가 필요 |
| **보고서** | PDF + JSON | JSON + SARIF + HTML + PDF (L2: 인사이트) | 우리 우위: SARIF CI/CD 연동 |
| **DAST** | Frida + mitmproxy | 미구현 (미래) | MobSF 우위: DAST 내장 |

### C.2 MobSF가 하지만 우리가 안 하는 것 (갭)

```
GAP-1: Tracker 탐지 (Exodus Privacy DB)
  중요도: 중 (개인정보 관련)
  해결: Phase 2에서 Exodus tracker DB 통합
  구현: tracker_detect 도구 추가 (패키지명 매칭)
  → SCA Agent에 추가

GAP-2: 악성 도메인 검사
  중요도: 중 (멀웨어 관련)
  해결: Phase 2에서 로컬 악성 도메인 DB 통합
  구현: domain_reputation 도구 추가
  → Code Agent에 추가 (URL 추출 후 검사)

GAP-3: APKiD (패커/컴파일러 감지)
  중요도: 높 (난독화 대응)
  해결: Phase 2에서 APKiD 통합
  구현: Unpack Agent의 포맷 감지 단계에서 실행
  → obf_packer_detect 도구에서 이미 일부 커버, APKiD로 강화

GAP-4: VirusTotal 연동
  중요도: 낮 (SaaS에서는 자체 스캔 우선)
  해결: Phase 6에서 선택적 통합
  구현: API Key 기반 옵션, VT 사용 불가 시 YARA 폴백

GAP-5: 인증서 상세 분석 (서명 체인, 만료일, 약한 알고리즘)
  중요도: 높 (기본 보안 체크)
  해결: Phase 3에서 추가
  구현: cert_analyzer 도구 (X.509 파싱 + 약한 알고리즘 체크)
  → Unpack Agent 또는 별도 단계
```

### C.3 우리가 하지만 MobSF가 안 하는 것 (핵심 차별화)

```
DIFF-1: Taint 분석 엔진
  MobSF: 없음 (패턴 매칭만)
  우리: 74개 전파 규칙 + Dual-Engine + 메서드 간 추적
  영향: Intent→SQL injection, source→log leak 등 MobSF가 놓치는 경로 탐지

DIFF-2: 공격 체인 구성
  MobSF: 없음 (개별 취약점만 나열)
  우리: 13개 체인 템플릿 + 그래프 경로 검증 + 점수 계산
  영향: "이 취약점들이 조합되면 실제 공격이 가능하다"를 보여줌

DIFF-3: Code Graph (igraph)
  MobSF: 없음
  우리: igraph 콜그래프 + 3-Tier 서브그래프 + entry/sink 경로 탐색
  영향: 메서드 간 관계 분석, 공격 표면 정밀 매핑

DIFF-4: 자가 진화
  MobSF: 수동 룰 업데이트
  우리: LLM 도구 생성 + 자동 벤치마크 + 승격 파이프라인
  영향: 시간이 지날수록 탐지력 자동 향상

DIFF-5: SCA 핑거프린트
  MobSF: 패키지명만
  우리: 메서드 시그니처 핑거프린트 (난독화 내성)
  영향: R8/ProGuard 앱에서도 라이브러리 탐지

DIFF-6: Confidence Calibration
  MobSF: 없음 (룰 severity 고정)
  우리: 역사적 TP/FP 통계 기반 자동 보정
  영향: 오탐율 지속 개선

DIFF-7: Cross-agent dedup
  MobSF: 없음 (같은 취약점이 여러 번 보고될 수 있음)
  우리: location + category 기반 지능형 중복 제거
  영향: 리포트 품질 향상, 오탐율 감소

DIFF-8: L1/L2 티어 분리
  MobSF: 단일 모드
  우리: L1(무료, 도구만) + L2(유료, LLM 심층) + scan_id 이어받기
  영향: SaaS 비즈니스 모델 + 단계적 분석
```

### C.4 MobSF 벤치마크 자동 비교

```python
# tests/benchmark/mobsf_comparison.py

class MobSFComparator:
    """
    동일 APK를 MobSF와 우리 시스템으로 각각 스캔하고 결과를 비교.
    CI/CD에서 주간 실행.
    """

    def compare(self, apk_path: str, ground_truth: dict) -> ComparisonReport:
        # 1. MobSF API로 스캔
        mobsf_result = self._scan_with_mobsf(apk_path)

        # 2. 우리 시스템으로 L1 스캔
        our_result = self._scan_with_ours(apk_path, depth="L1")

        # 3. Ground Truth와 비교
        mobsf_metrics = evaluate_scan(mobsf_result, ground_truth)
        our_metrics = evaluate_scan(our_result, ground_truth)

        # 4. 차이 분석
        only_ours = our_metrics["tp_vulns"] - mobsf_metrics["tp_vulns"]
        only_mobsf = mobsf_metrics["tp_vulns"] - our_metrics["tp_vulns"]

        return ComparisonReport(
            mobsf_f1=mobsf_metrics["f1"],
            ours_f1=our_metrics["f1"],
            mobsf_recall=mobsf_metrics["recall"],
            ours_recall=our_metrics["recall"],
            mobsf_fpr=mobsf_metrics["fp_rate"],
            ours_fpr=our_metrics["fp_rate"],
            only_ours_found=only_ours,      # 우리만 찾은 것
            only_mobsf_found=only_mobsf,    # MobSF만 찾은 것 → 갭!
            delta_f1=our_metrics["f1"] - mobsf_metrics["f1"],
        )

    # CI/CD 통합
    # 결과: delta_f1 > 0이면 PASS, < 0이면 ALERT
    # only_mobsf_found > 0이면 갭 분석 → 새 룰/도구 개발 이슈 자동 생성
```

### C.5 갭 해소 계획

| 갭 | Phase | 구현체 | 영향 |
|---|---|---|---|
| GAP-1: Tracker DB | Phase 6 | tracker_detect (SCA Agent) | 개인정보 커버리지 |
| GAP-2: 악성 도메인 | Phase 6 | domain_reputation (Code Agent) | 멀웨어 커버리지 |
| GAP-3: APKiD | Phase 2 | Unpack Agent 통합 | 난독화 대응 |
| GAP-5: 인증서 상세 | Phase 3 | cert_analyzer (Unpack Agent) | 기본 보안 |
| GAP-4: VirusTotal | Phase 6 | 옵션 (SaaS 연동) | 멀웨어 스코어링 |

---

## 부록 D: 설계 검증 체크리스트

설계가 탄탄한지 확인하는 최종 체크리스트.

### D.1 기능 완전성

```
[✓] Manifest 분석: exported(Android 12 기본값), permission, NSC, debuggable,
    allowBackup, taskAffinity, tapjacking, custom permission — 커버
[✓] 코드 분석: libsast + 커스텀 도구 + Taint(74규칙) + ICC + PII — 커버
[✓] 바이너리: YARA + ELF hardening + native 심층(35도구) — 커버
[✓] SCA: 패키지명 + 핑거프린트 + CVE + SBOM — 커버
[✓] 상관분석: 7도구 + 13템플릿 + Graph 경로 — 커버
[✓] 보고서: JSON + SARIF + HTML + PDF — 커버
[△] 인증서: 기본 분석 (GAP-5로 강화 예정)
[△] 트래커: 미구현 (GAP-1로 Phase 6에서 추가)
[△] 악성 도메인: 미구현 (GAP-2로 Phase 6에서 추가)
[✗] DAST: 미래 확장 (설계 범위 외)
```

### D.2 품질 보장

```
[✓] Ground Truth 정의: InsecureBankv2 25개 전수 분류 (21개 must_detect)
[✓] F1 목표: L1>83%, L2>87% (InsecureBankv2), 전체>75%/90%
[✓] 오탐 제어: ConfidenceCalibrator + Cross-agent dedup + 벤치마크 사전 보정
[✓] MobSF 비교: 자동화된 경쟁 벤치마크 (주간 CI/CD)
[✓] Graph 폴백: Graph 없이도 F1>65% (조건 완화 + confidence 감소)
[✓] 코루틴 대응: Dual-Engine(Java 우선) + CoroutineDetector + limitation 기록
[✓] 난독화 대응: Heuristic 35도구 + SCA 핑거프린트 + R8 벤치마크 앱
```

### D.3 아키텍처 건전성

```
[✓] Tool-First: 85-90% 도구, 10-15% LLM — 비용 $0.74/deep
[✓] Orchestrator: LLM 없는 상태머신 — DAG + 조건 라우팅
[✓] 에이전트 통신: ScanDB agent_outputs — 토큰 무관, 영속, 디버깅 가능
[✓] 에스컬레이션: ScanDB escalation_flags — 조건 기반 자동 라우팅
[✓] Graceful Degradation: 5단계 폴백 (jadx → smali → unzip, Graph → 없이, LLM → L1)
[✓] 체크포인트: ScanDB 기반 — 크래시 후 재개
[✓] 도구 보안: 4-Layer (AST검사 + seccomp + 벤치마크 + 모니터링)
[✓] 자가 진화: ToolCombiner → RegexGen → LLM — 3단계 도구 생성
[✓] L1/L2 차별화: L2 = 비정형 taint + PoC + 인사이트 + 자가 진화
```

### D.4 운영 준비

```
[✓] SaaS: 3-Screen UI + FastAPI + WebSocket + 멀티테넌트
[✓] Docker: per-scan 컨테이너 + seccomp + 리소스 제한
[✓] 관측성: JSON logging + 메트릭 + 실시간 진행률
[✓] 비용: L1 $0, L2 $0.30-4.00 (앱 크기별)
[✓] CI/CD: PR 머지 시 quick 통과 필수 + 주간 deep + MobSF 비교
[✓] 확장: ScanResult 기반 후속 에이전트 호환
```

### D.5 개발 리스크 (관리 중)

```
[관리중] Taint Propagation Rule DB: 74개 정의 완료, 테스트 필요
[관리중] Kotlin 코루틴: Dual-Engine 설계 완료, Java 엔진 구현 필요
[관리중] SCA 핑거프린트 DB: Top 500 라이브러리 구축 필요 (Phase 6)
[관리중] 체인 템플릿 13개: InsecureBankv2 6개 체인 커버 확인, 야생 앱 테스트 필요
[관리중] ConfidenceCalibrator cold start: 벤치마크 사전 보정 설계 완료
[낮음]   Heuristic 도구 35개 중 일부는 Phase 4에서 구현 (전체 필수 아님)
```
