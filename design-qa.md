# 상점 1안 · 임무 시안 Mac 로컬 검수

검수일: 2026-10-22T11:25:18.587760+00:00
기준 main: `1800cda2d0dfa7a5fbecaf6136c5688d063a68e9`
작업본: `/Users/lim/Desktop/프로젝트/healer/worktrees/shop-mission-local-20261022`
로컬 브랜치: `codex/shop-mission-local-20261022` (미커밋 변경, 원격 쓰기 없음)

## 범위 · 실제 적용

- 상점 ZIP을 공식 Library materialize 도우미로 내려받았다. ZIP SHA256 `a4917f3b0a2d43557ea1ef7990d2d01c2ea7b022980c228f2ef576eff049ef46`, 패치 SHA256 `5160cd70dac3896f2bba7d1af0174895c965846174939941506cc28fe0880f35` 일치.
- ZIP의 일반 파일 5개를 검토했고 경로 이탈, 심볼릭 링크, 실행 파일 없음. README와 코드 diff를 읽고 `git apply --check` 성공 후 적용. 적용 직후 5개 파일 해시 모두 manifest 일치. 이 보고서는 번들의 Linux 검수 주장을 대체하는 실제 Mac 결과이며, 원본 보고서는 inputs에 보존했다.
- 상점/행상인 새 문장 WebP 2개, 기존 이동·행상인 Lv 10 제한 유지. 실제 상점 내부 상품 경제는 변경하지 않음.
- 임무 일일/주간 탭, 큰 완료 상자, 실제 수령 수에 따른 방패, 원형 임무 그림, 녹색 진행 바, 공통 재화 아이콘과 실제 보상. 기본 진입 일일, 키보드 좌우/Home/End로 탭 전환.
- 새 임무 상자 배경 1개를 내장 image_gen으로 생성. 프롬프트 `/Users/lim/Desktop/프로젝트/healer/나혼자힐러/리소스/shop-mission-local-20261022/originals/ui-mission-reward-v1.prompt.txt`, 원본 같은 폴더 PNG. 원본 2172×724, 앱 PNG 2,147,434 bytes.
- 시안의 무료 교체 안내 문구는 제거. 기존 코드에는 실제 `swapMission` 경로가 있어 그 조건부 버튼과 동작을 보존. 교체나 보상 기능을 새로 만들지 않았다.
- 경제·임무 정의·저장·보상 함수는 변경하지 않았다. 시안의 2541/508 같은 수치는 제품에 하드코딩하지 않음. 테스트 픽스처 Lv 40에서는 기존 계산값 상자 495, 일일 99, 주간 1485가 표시된다. Lv 1 실제 4개 임무/방패도 검증.

## 비교 증거 · 조건

- 원본 시안: `/Users/lim/Desktop/프로젝트/healer/나혼자힐러/리소스/shop-mission-local-20261022/inputs/a5c8c932-991d-4779-9ff5-59d08fedbee8.png` (853×1844).
- 최종 일일: `/Users/lim/Desktop/프로젝트/healer/나혼자힐러/리소스/shop-mission-local-20261022/qa/mission-daily-390.png` (390×844, CSS 390×844, DPR 1).
- 최종 주간: `/Users/lim/Desktop/프로젝트/healer/나혼자힐러/리소스/shop-mission-local-20261022/qa/mission-weekly-390.png`; 잠김: `/Users/lim/Desktop/프로젝트/healer/나혼자힐러/리소스/shop-mission-local-20261022/qa/mission-weekly-locked-390.png`.
- 상점: `/Users/lim/Desktop/프로젝트/healer/나혼자힐러/리소스/shop-mission-local-20261022/qa/local-lobby-390.png`; 320/360/430 캡처도 같은 폴더.
- 전체 비교: `/Users/lim/Desktop/프로젝트/healer/나혼자힐러/리소스/shop-mission-local-20261022/qa/mission-reference-comparison-390.png`. 원본을 390px 폭(약 843px 높이)으로 정규화하고 구현 390×844와 같은 입력 안에 나란히 렌더해 직접 확인.
- 집중 비교: `/Users/lim/Desktop/프로젝트/healer/나혼자힐러/리소스/shop-mission-local-20261022/qa/mission-reference-detail-390.png` (상자·수령·임무 행).
- 상태: 일일 1개 수령, 1개 수령 가능, 나머지 진행 중. 화면의 금액은 실제 코드 기준. 원본과 데이터 값 자체는 일치시키지 않음.
- 앱의 기존 배너 70px, 공통 헤더/뒤로가기는 유지해 원본과 시작 위치가 다르다. 장식 픽셀 일치가 아니라 해당 기능 화면으로의 시안 적용을 검수했다.

## 비교 이력 · 수정

1. [P1, 수정 완료] 공통 service-hall CSS가 새 목재 행을 덮음. 화면 전용 선택자 우선순위를 수정하고 새 캡처로 확인.
2. [P2, 수정 완료] 직사각형 프레임 전체 늘림으로 테두리가 두껍고 간격이 커짐. 기존 프레임을 border-image로 사용하고 목록 간격/행 높이를 조정. 마지막 390px 캡처에서 다섯 행이 한 화면에 보이며 320/360에서는 마지막 행 스크롤 접근을 확인.
3. [P2, 수정 완료] 수령 행 전체 opacity로 배경이 비쳐 가독성이 떨어짐. 목재는 불투명하게 유지하고 그림/보상만 약하게 처리.
4. 글꼴 토큰을 기존 `--font-display`로 맞춤. 프로젝트 내 Hahmlet/Noto Sans KR을 그대로 사용.

수정 전 비교는 `/Users/lim/Desktop/프로젝트/healer/나혼자힐러/리소스/shop-mission-local-20261022/qa/mission-reference-comparison-before-frame-fix.png`에 보존. 수정 후 전체·집중 비교 이미지를 다시 직접 확인했다.

## 필수 시각 항목

- 글꼴·타이포: 기존 앱 글꼴/한글 굵기 유지. 긴 조건은 줄바꿈되며 잘림 없음. 작은 화면에 맞춘 12~14px 임무 제목, 명확한 큰 상자 제목.
- 간격·배치: 320×640, 360×740, 390×844, 430×932. 가로 넘침·행 자식 겹침 없음, 행동 버튼 최소 44px. 일일/주간 탭 숨김 및 재진입 확인.
- 색상: 짙은 목재/황동 금테, 파란 활성 탭, 녹색 진행, 황금 수령 버튼. 기존 상점 버튼 토큰과 재화 아이콘을 재사용.
- 그림: 생성 상자 배경 로드 확인. 기존 공통 재화·직업/임무 그림을 재사용해 의미 일관성 유지. 그림에 글자·금액·상태 없음.
- 문구·데이터: 무료 교체 홍보 문구 없음. 실제 임무 정의, 보상, 진행, 수령 상태 사용. 주간에 새 완료 상자나 교체 행동을 만들지 않음.

## 실제 검증

- `npm run typecheck`: 통과. 최종 `npm run build` (tsc 포함): 통과.
- 관련 단위 테스트: 3파일, 37 PASS.
- 기존 A2 로비: 217 PASS. 재화·임무·상점: 25 PASS. 합계 242 PASS, FAIL 0, ERROR 0.
- 새 임무 UI 회귀: 44 PASS, FAIL 0, ERROR 0. 최종 빌드에서 재실행.
- 실제 동작: 임무 수령·골드 반영, 기존 교체 1회 조건, 완료 상자/광고 추가 상자, 주간 임무, 길드 명성 수령, 주간 도전 상자, Lv 1 잠금, 탭 키보드, 뒤로가기.
- 브라우저 pageerror/console error 없음. 테스트는 격리된 개발 저장소/결제 모형 사용, 실제 구매·광고 계정 조작 없음.
- `git diff --check`: 통과. 전체 프로젝트의 모든 E2E/시뮬을 실행한 것은 아님.

## 남은 제약 · 허용된 차이

- 새 그림 WebP 최적화 호출 `npm run art:optimize -- --only=ui-mission-reward-v1`에서 Chromium `bootstrap_check_in … Permission denied (1100)` 발생. 변환 중단, 변환 재시도/다른 변환기로 우회 없음. 생성 PNG를 그대로 앱에 사용. 압축 최적화는 후속 항목(P3).
- UI 검수용 Chromium/localhost는 별도 정식 실행 권한 검토를 거쳐 허용되어 실행했다. 이미지 생성 자체의 권한 거절은 없음.
- 원본 시안과 문장/방패/아이콘 세부 형태는 차이가 있다. 새 자산은 상자 배경만 필요해 만들었고 나머지는 기존 프로젝트 그림을 재사용했다. 배너·헤더 유지와 실제 데이터 차이는 의도된 제품 제약이다.
- 기존 main의 미완료 헤더 변경 5개와 다른 워크트리 변경을 보존. 최신 기준 커밋의 별도 작업본에서만 적용.
- GitHub 업로드 403 제한을 우회하지 않음. 원격 push/PR/merge, 배포, Library 업로드, APK 빌드·폰 설치 없음.
- 로컬 미리보기 `http://127.0.0.1:4188/`를 실행 상태로 유지. 같은 Mac에서만 접근 가능.

final result: passed
