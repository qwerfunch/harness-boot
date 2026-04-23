# Adapter: game

**출처 샘플**: retro-jumper (v0.2)
**버전**: 0.1

## 1. 도메인 시그널

- "FPS 60", "게임 루프", "canvas", "스프라이트", "오디오", "팔레트"
- "무적 시간", "데미지", "히트박스", "점프 중력"
- "게임이 웹으로 돌아감" — P-10 핫스팟
- 프로토타이핑 기간 ≤ 4주 빈번 → `prototype_mode: true` 체크

## 2. 우선 체크 갭

1. **G-11 assets** — 스프라이트·오디오·팔레트·폰트
2. **G-12 tuning_constants** — 중력·속도·무적·데미지 계수
3. **G-13 non_goals** — 버전별 "v1 범위 밖", 장르 제한
4. **G-01 NFR** — FPS 안정성, 입력 latency
5. **P-10** — deliverable.type 정체성 손실(web vs game)

## 3. 권장 엔티티 원형

| 엔티티 | 역할 | 필수 불변식 |
|--------|------|-------------|
| Player | 조작 대상 | 위치·속도·상태(무적·피격) |
| Enemy | 장애물/적 | 타입별 행동 패턴 |
| Score | 점수/기록 | 로컬/리더보드 구분 |
| Level/Stage | 진행 단위 | 클리어 조건 |

## 4. 매핑 힌트

| 원본 패턴 | spec 필드 |
|-----------|----------|
| "중력 k=0.01, 점프 v0=8" | unrepresentable → G-12 `tuning_constants[]` |
| "무적 3초" | G-12 `tuning_constants[]` |
| "히트 시 무적 + 반짝임" | spec AC + G-12 |
| "스프라이트 시트 8x8" | unrepresentable → G-11 `assets[]` |
| "v1.5 에서 리더보드 검토" | unrepresentable → G-13 `non_goals[]` |
| "PWA 지원 / 오프라인 우선" | spec `constraints.tech_stack` |

## 5. 흔한 함정

- **튜닝 상수를 AC 자연어에 녹이기** — P-8 위반. 단일 값이면 tuning, 범위면 NFR.
- **"게임이라 deliverable.type=game 없음"** → web-service/static-site/cli 중 선택.
  정체성 소실을 P-10 에 따라 기록.
- **에셋을 features.modules 이름으로만 암시** — G-11 으로 승격.
- **짧은 기간(≤ 4주) 임에도 prototype_mode: false 둠** — P-9 조건 확인.

## 6. 체크리스트 확장

- [ ] 스프라이트·오디오·폰트 언급 있으면 G-11 엔트리
- [ ] 수치 계수가 2개 이상 원본에 명시되면 G-12 엔트리
- [ ] "v1 범위 밖" 또는 명시적 "비포함" 섹션 → G-13 엔트리
- [ ] deliverable.type 선정 시 P-10 정체성 소실 판정 문장 존재
- [ ] prototype_mode 설정 시 P-9 조건 충족 근거 기록
