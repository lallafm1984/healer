# healer

모바일 세로 화면 힐러 게임 (가제 「나혼자 힐러」, 게임 이름은 나중에 정함) 본 개발 저장소.
웹(TypeScript) + Capacitor로 만들고 Android를 먼저 낸다.

기획 문서는 프로젝트 공유 폴더 `나혼자힐러/`에 있다 (02 기획서, 20 기술 사양, 21 본 개발 계획). 이 저장소에는 코드만 둔다.

## 현재 구성
- `src/engine/`: 전투 엔진. 프로토타입 `engine.js`를 TypeScript로 옮김. 같은 시드·같은 입력이면 프로토타입과 결과가 똑같다 (`tests/parity.test.ts`)
- `src/data/`: 수치 (난이도·장비·성격·판·보스·스킬·소비 아이템). 밸런스는 여기만 고친다
- `src/battle/`: PixiJS 육각 전투판과 보스·스킬·아이템 UI. 탭 치유, 방향 쓸기, 롱프레스 설명
- `src/screens/`: 타이틀·로비·던전 입장·편성·정산·성장·길드·상점·튜토리얼
- `src/screens/tabs.ts`: 전투·캐릭터·길드·상점 4탭. 전투 중에는 숨김
- `src/game/`: 저장 상태, 화면 흐름, 보상, 재화·길드·튜토리얼
- `src/platform/`: 전체화면, 기기 저장
- 화면 규칙: 전체화면, 화면 맨 위부터 노치 포함 **70dp = 배너 영역**, 게임 화면은 그 아래 (기획 09 5장)

## 세로 UI와 이미지 (2026-10-08)
- `src/screens/mobile.css`: 모바일 메뉴 테마·고정 출발 버튼·이미지 카드·44px 터치 영역
- `src/battle/portrait.css`: 작은 화면 및 20인 전투 배치·위험 상태·조작 영역
- `src/theme.css`: UI 테마 「길드 홀」(MMO). 돌·청동·양피지 바탕, 금테 패널, 퀘스트 노랑 제목, 진홍 주 버튼, 함렛+본고딕. 다른 CSS 뒤에 얹는 맨 위 층 (아트 가이드 16 4-7)
- `public/art/`: 자체 생성 WebP 6종. 사제·드루이드·성기사·녹슨 골렘·마을·요새. 총 약 1.35MB
- 캐릭터 그림은 현재 직업에 맞춰 로비·캐릭터에 표시. 전투 파티 칸은 HP와 역할 아이콘을 유지
- 원본 PNG·전체 프롬프트·검토 보고서는 저장소 밖 `../나혼자힐러/리소스/`, `../나혼자힐러/검토/`에 보관
- `tests/e2e/portrait.mjs`: 320×640, 360×740, 390×844, 430×932에서 이미지 로드·메뉴 가로 넘침·20인 특성/아이템/포기 버튼 검증

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
