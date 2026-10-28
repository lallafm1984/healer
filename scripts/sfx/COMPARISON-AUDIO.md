# 전투 효과음 첫 비교 — 2026-10-21

타격·치유·보호막 3종을 Agent Audio의 로컬 Stable Audio 3 Small SFX와
Medium으로 각각 생성했다. 유료 API 호출은 없다. 청음 페이지에는 기존 게임
음원 3개와 검수를 통과한 새 후보 6개가 있다.

- 실행: `http://127.0.0.1:5173/scripts/sfx/audio-comparison/20261021/index.html`
- 보관: `scripts/sfx/audio-comparison/20261021/` (2026-10-28 APK에서 빼려고 public에서 옮김)
- 상세 프롬프트·시드·신호·CLAP 점수·해시: 위 폴더의 `review.json`
- 원본·탈락 후보·중간 계산: `.sfx-raw/comparison-20261021/` (Git 제외)

## 생성과 판정

초기 후보는 같은 프롬프트, 3초 원본 길이, 시드, 8스텝, CFG 1로 생성했다.
각 모델은 서로 다른 DiT와 디코더를 쓴다. 런타임은 TFLite CPU이며 모델을
텍스트 인코딩·확산·오디오 변환 단계별로 로드한다.

- Agent Audio 런타임 리비전: `779434a908193105335fd8d833418603625b2859`
- 공식 최적화 가중치 리비전: `da6edc54ddba10bfd79a077102ded687f80e882b`
- Small SFX: `sa3-sm-sfx/dit_fp32.tflite`, `same-s/dec_w8a8.tflite`
- Medium: `sa3-m/dit_fp32.tflite`, `same-l/dec_w8a8.tflite`
- 두 모델은 공통 T5Gemma 인코더를 사용한다.

총 8개를 생성했다. Medium 치유음 첫 후보와 Small SFX 보호막 첫 후보는
완전히 감쇠하기 전 소리가 잘려 불합격 처리했다. 감쇠 지시와 시드를 바꿔
각각 한 번 재생성한 결과 통과했다. 기준을 완화하지 않았다.

| 효과음 | Small SFX 선택 | 길이 | Medium 선택 | 길이 |
| --- | --- | --- | --- | --- |
| 근접 타격 | 첫 후보 | 0.075초 | 첫 후보 | 0.245초 |
| 치유 | 첫 후보 | 0.850초 | 두 번째 후보 | 0.850초 |
| 보호막 | 두 번째 후보 | 0.500초 | 첫 후보 | 0.230초 |

무음·클리핑·폰 스피커 대역·잘린 잔향을 검사하고, 로컬 CLAP으로 소리 설명
일치도와 음성·음악·잡음 혼입 가능성을 평가했다. **직접 청음 평가는 하지
않았다.** 이 수치로 모델의 미학적 우열을 확정하지 않는다. 재생성된 후보는
프롬프트가 달라졌으므로 최종 후보 모음은 통제된 성능 벤치마크가 아니다.

## 재현

각 모델에는 별도 작업 폴더와 `manifest.json`을 사용한다. manifest 항목은
`name`, `ko`, `gen`, `keep`, `prompt`, `match`이며, 원본 폴더에 보관되어 있다.
생성 스크립트는 모델 프로필을 기록하고 다른 모델의 캐시 재사용을 거부한다.
기본 프로필은 기존과 동일한 Medium이다.

```powershell
& E:/claude/agent-audio/.venv/Scripts/python.exe scripts/sfx/generate-combat.py --home E:/claude/.agent-audio --manifest .sfx-raw/comparison-20261021/small-sfx/manifest.json --profile small-sfx
& E:/claude/comfyui/.venv/Scripts/python.exe scripts/sfx/review-combat.py .sfx-raw/comparison-20261021/small-sfx/manifest.json --model .sfx-raw/combat-20261020/models/models--laion--clap-htsat-unfused/snapshots/8fa0f1c6d0433df6e97c127f64b2a1d6c0dcda8a
```

Medium은 경로와 `--profile`을 `medium`으로 바꾼다. 재생성은
`--round 2 --names heal-priest`처럼 대상만 지정한다. 두 모델의 검수가 끝나면
새 출력 폴더로 청음 페이지를 발행한다. 기존 출력 폴더는 덮어쓰지 않는다.

```powershell
& E:/claude/agent-audio/.venv/Scripts/python.exe scripts/sfx/publish-comparison.py .sfx-raw/comparison-20261021 scripts/sfx/audio-comparison/another-review
```

## 확인한 내용

- 두 모델에서 실제 오디오 생성 및 신호·CLAP 검사 통과: 6개
- 브라우저 재생 시작·디코딩: 기존 3개와 신규 6개 모두 오류 없음
- Python 문법 검사 및 신호 처리 회귀 테스트 5개 통과
- 다른 모델 캐시 재사용 거부 확인
- TypeScript 검사와 배포 빌드 통과 (기존 대형 번들 경고는 남아 있음)
- 브라우저 기록: `tests/e2e/shots/audio-comparison-20261021.json`, 같은 이름 PNG
