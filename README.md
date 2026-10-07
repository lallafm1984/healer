# healer

모바일 세로 화면 힐러 게임 (가제 「나혼자 힐러」, 게임 이름은 나중에 정함) 본 개발 저장소.
웹(TypeScript) + Capacitor로 만들고 Android를 먼저 낸다.

기획 문서는 프로젝트 공유 폴더 `나혼자힐러/`에 있다 (02 기획서, 20 기술 사양, 21 본 개발 계획). 이 저장소에는 코드만 둔다.

## 지금 상태 (0단계: 기반)
- `src/engine/`: 전투 엔진. 프로토타입 `engine.js`를 TypeScript로 옮김. 같은 시드·같은 입력이면 프로토타입과 결과가 똑같다 (`tests/parity.test.ts`)
- `src/data/`: 수치 (난이도·장비·성격·판·보스·스킬·소비 아이템). 밸런스는 여기만 고친다
- `src/legacy/`: 전투 화면은 당분간 프로토타입 v11 화면을 그대로 씀. P1에서 새 화면으로 바꾸면 지운다
- `src/screens/tabs.ts`: 하단 탭 5개 (전투만 동작, 나머지는 자리만)
- `src/platform/`: 전체화면, 기기 저장
- 화면 규칙: 전체화면, 화면 맨 위부터 노치 포함 **70dp = 배너 영역**, 게임 화면은 그 아래 (기획 09 5장)

## 명령
```bash
npm ci
npm run dev        # 브라우저에서 개발
npm test           # 엔진·저장 테스트
npm run build      # 타입 검사 + dist
npm run e2e        # 화면 테스트 (build 뒤, Playwright Chromium 필요)
npm run check      # 위 셋 전부
npm run android    # build + Android 프로젝트에 복사
```

## Android 시험용 APK
`main`에 푸시하면 GitHub Actions의 **Android APK**가 디버그 APK를 만든다. Actions 탭 → 실행 결과 → Artifacts → `healer-debug-apk`를 내려받아 폰에 설치한다 (알 수 없는 앱 설치 허용 필요).
앱 ID `com.lallafm.healer`와 앱 이름은 임시다. 구글 플레이에 올리기 전에 확정한다 (올린 뒤엔 앱 ID를 못 바꾼다).
