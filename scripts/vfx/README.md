# 손그림풍 스킬 이펙트 만들기 (scripts/vfx)

Lim 2026-10-16 「스킬이펙트가 너무 허술」 → 64px 도트 (PXF) 대신 캔버스로 직접 그린 224px 이펙트. Lim 「손그림 이펙트 기능이 마음에드니 앞으로 다른 세션에서도 사용가능하게」.
전투 이펙트는 모두 이 방식이다 (Lim 2026-10-16 「다른 기타 이펙트도 손그림 이펙트로 (도트를 모두 제거)」): 직업 스킬 · 전투 공통 효과 `common-*` · 파티원 능력 `ally-*` (`common.mjs`).
보스 판 전체 공격 `boss-*`는 Codex 손그림 띠 `fx-wide-*`. PXF 도트 · 공방 도구는 모두 지웠다 (다시 만들지 않음).

## 한 바퀴

```
npx vite build                       # 검수 도구가 dist 미리보기를 씀 (게임 코드가 바뀌었을 때만 다시)
npm run fx:board                     # 실제 전투 판 사진 (이펙트 없음) → .sim/vfx-bg (처음 한 번, 판 화면이 바뀌면 다시)
npm run fx:bake -- warder --review .sim/vfx-review --contact .sim/vfx-review/_warder.png
npx vite build && npm run fx:shot -- warder --sheet .sim/vfx-shots/warder.png --every 3
```

- `fx:bake -- <이름|직업|all>`: `scripts/vfx/<직업>.mjs`를 Playwright 크로미움 캔버스로 프레임마다 그려 `src/art/fx-skill-<이름>.webp` (224px 프레임 격자, 한 줄 ⌈√장 수⌉장)로 저장.
  `--review <폴더>` = 이펙트마다 판 사진 위 게임 크기 시트 (탱커 칸 프레임마다 + 밝은 칸 4장 + 범위 · 파티 이펙트는 5인 · 20인 판 전체), `--contact <파일>` = 고른 것 한 줄씩 한눈에.
  출력의 「가장자리에 닿음」 경고가 없어야 함 (프레임 밖 빛이 네모로 잘림).
- `fx:shot -- <스킬 키 · 이펙트 이름 · 직업 | all>`: 실제 게임 전투에서 그 스킬 기록을 넣고 시계를 멈춰 프레임마다 찍음 (`--sheet` 스킬마다 한 줄, `--board 20` · `--w 412 --h 915` 폰 크기). 굽고 빌드한 뒤.
- 묶음 이름: `priest` `druid` `paladin` `shaman` `monk` `astrologer` `warder` `common` `ally` (`index.mjs` `HERO_FX`), 쉼표로 여럿.

## 이펙트 하나

`scripts/vfx/<직업>.mjs`의 `export default { '<직업>-<이름>': { frames, logical, scope, draw(g, k) } }`, 새 직업 파일은 `index.mjs`에 더함.

- `size` (선택): 프레임 크기, 기본 224. 작고 자주 뜨는 공통 효과는 192 (`battle/pxf.ts` `small()`). Codex 그림이 주인공이라 224에서 뭉개지면 320 · 384 (성기사 봉화 · 정화 · 봉화 고리, 2026-10-18 Lim 「불모양 이미지 퀄리티가 너무 낮다」), 띠 한 줄은 2048px 안 (`pxf.ts` `skill(…, { size })` · `loop(…, size)`).
- `loop` · `fps` (선택): 판 위 물건이 서 있는 동안 계속 도는 루프 (마지막 장 다음이 첫 장, 굽기가 마지막 장을 비우지 않음). `t` = 장 번호 ÷ 장 수라 사인 · 입자 시간은 한 바퀴에 정수 번 돌게 (`frac` · `wave`). 게임은 `pxf.ts` `loop(frames, logical, fps)` + `HERO_LOOP_FX` (그 직업 전투에서만 읽음), `board.ts` 선 물건 (`TOTEM_LOOK.loop`)이 그림 위 · 이름 아래에 그림. 예: 주술사 샘 · 대지 토템 `shaman-spring-loop` · `shaman-earth-loop` (토템 그림 크기 `TOTEM_STAND` = `shaman.mjs` `TOTEM`).
- 판 위 지속 그림 (쉼터 · 이끼 · 성역 · 바다 샘 · 안개 장판 · 성채 · 초신성 · 떠도는 안개 · 결계 · 별의 잠)도 그림만 두지 않고 루프를 겹친다 (2026-10-19 Lim 「지속 이펙트는 루프로 유지되게, 이미지만 유지되는 게 아닌」). `board.ts` `putArtLoop`: 그림 가운데 · 그림 한 변 × logical ÷ 62, 루프 좌표 1 = 그림 한 변의 반. 공통 도우미 `lib.mjs` `loopRise` (떠오르는 가루) · `loopGlints` (자리마다 반짝임) · `loopOrbit` (타원을 도는 빛 점). 새 지속 그림도 루프와 함께 (`HERO_LOOP_FX`에 등록).
- `gray` · `sample` (선택): 회색 단계로만 그림 → 게임이 종류 색을 곱함 (치유 빛 · 쓰러짐 · 디버프 · 장비 발동). 굽기가 색이 섞이면 멈추고, 검수 시트는 `sample` 색을 곱해 보여 줌.
- `frames`: 24fps 한 번 재생 장 수 (11–24). **첫 프레임 = 스킬이 들어간 순간**이라 0장째부터 크게 보여야 함 (서서히 나타나는 앞부분 없음). 마지막 장은 굽기가 비움.
- `logical`: 기준 칸 62일 때 그림 지름. 한 명 대상 80–100 (칸 밖까지 빛이 번짐), 범위 · 파티 · 칸마다 기록되는 것 70–84.
- `scope`: `battle/pxf.ts` `SKILL_PXF`의 재생 칸과 같게 (`target` · `area` · `party`).
- `draw(g, { t, f, n, px })`: 좌표는 **칸 가운데 (0, 0), 1 = 칸 반지름 (육각 꼭짓점), 위 = −y**. `t` 0–1 진행, `px` = 프레임 1px. 칸 글자는 아이콘 y ≈ −0.4, 이름 ≈ 0.13, 체력 ≈ 0.62라 가운데를 오래 덮지 말 것. 가장자리 14%는 자동으로 둥글게 지워짐.
- 손그림 그림 쓰기: 도형으로 모자란 디테일 (깃털 날개 등)은 Codex CLI로 그린 그림을 `scripts/vfx/assets/<이름>.webp` (512px 안팎)에 두고 `asset('<이름>')`로 `g.drawImage` (굽기가 읽어 둠, 없으면 null → 도형으로 대신). 원본 · 프롬프트는 `나혼자힐러/리소스/generated-ui-<날짜>-originals/`, `생성기록.csv` · `65`에 적음. 예: 사제 수호 영혼 날개 `guardian-wing` · 순간 치유 섬광 `priest-flash`.
- 도구 (`lib.mjs`): `glow` · `glowOval` (빛 번짐) · `glint` (네 갈래 반짝임) · `speck` (빛가루) · `comet` (꼬리 빛) · `lightStroke` (테 → 몸 → 흰 심 획) · `solid` (굵은 어두운 테 물체) · `energy` (빛 덩어리) · `bloom` (흐린 빛) · `leafAt` · `path.*` (별 · 잎 · 꽃잎 · 물방울 · 초승달 · 마름모 · 다각형) · `particles` (시드 고정 입자) · `E` (가속 곡선) · `seg` · `bell`.

## 게임에 걸기

1. `src/battle/pxf.ts` `PXF`에 `'<이름>': skill(frames, logical)` (공통 효과는 `small(frames, logical, gray)`, 그리기 코드와 같은 값, 다르면 `tests/pxf.test.ts`가 실패), 스킬이면 `SKILL_PXF`에 `<스킬 키>: { fx: '<이름>', scope }` (공통 효과는 `COMMON_PXF` · `ALLY_PXF`, 늘 읽어 둠 `ALWAYS_FX`).
2. `src/art/pxf/requests.md` 「모양 표」에 한 줄 (이펙트마다 다른 모양, 표에 없는 모양으로).
3. `npx vitest run tests/pxf.test.ts` · `tsc` · 빌드, 화면은 `fx:shot`으로 바꾼 스킬만 (S25 · 울트라 · 플립). e2e는 `E2E_ONLY="직업별 스킬 PXF,사제 치유 반짝이"`.

게임은 부드럽게 늘려 그리고 (`board.ts` `smoothFrame`), 띠가 하나에 2–5MB라 전투마다 지금 직업 것만 미리 읽음 (`heroSkillFx`, 공통 효과 · 파티원 능력은 늘). 설정 「시각 효과 줄이기」가 켜져 있으면 안 그림.

## 그림 결 (검수 기준)

- `58` 「황금빛 서사」: 빛은 흰 심 + 자기 색 몸 + 어두운 자기 색 테 (밝은 칸에서도 보이게), 단단한 물체 (깃털 · 돌 · 꽃잎 · 찻잔)는 굵은 거의 검은 테. 글자 · 피 · 개그 없음.
- 직업 색: 사제 흰빛 · 연금 + 하늘빛 (치유 · 소생은 초록) · 드루이드 풀빛 · 나무 갈색 · 들꽃 분홍 · 성기사 금빛 + 호박 · 주황 (희생 진홍) · 주술사 깊은 물빛 · 돌 · 영혼 남빛 · 수도사 비취 · 흰 안개 · 붓 획 · 점성술사 호박 별 + 밤하늘 남보라 · 결계사 맑은 노랑 발광 (Lim 「흰색이라서 퀄리티가 더 떨어져보인다. 노란 발광의 빛이나게」), 막 · 장막 · 결계는 각지지 않게 둥글게 · 스킬 이름에서 모양을 따옴 (Lim 「각지게 하지말고 이름을 따와서」), 인장 · 정화만 곧은 선.
- 하지 말 것: 어두운 테를 두른 불투명 흰 구슬 (진주처럼 보임) · 흐림 필터만 쓴 안개 (너무 옅음, 방사 그라데이션 덩어리 + 아래쪽 진한 그늘) · 막힌 네모 안 X (상자처럼 보임) · 이름 · 체력 줄을 가로지르는 선 (취소선처럼 보임) · 다른 스킬과 같은 모양.
- 검수는 `--contact` 시트와 `fx:shot` 시트로 직접 보고, 어울리지 않으면 고쳐 다시 굽기. 한 스킬에서 세 번을 넘기면 두고 다음으로.
