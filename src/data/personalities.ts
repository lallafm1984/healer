/**
 * 파티원 성격 30종 (04 6장 · 75 문서). 앞 10종은 프로토타입과 같은 순서 (rollParty가 PROTO_PERS로 뽑으므로 바꾸지 말 것),
 * 뒤 20종은 2026-10-14 Lim 「성격을 20종 더 추가해서 다양한 변수」로 더함 (04에 설계만 있던 18종 + 완벽주의자 · 뉴비)
 */
export type PersCat = '회피' | '위치' | '관계' | '감정' | '리듬';

export const CATS: Record<PersCat, string> = { '회피': '#7FA3BD', '위치': '#A3B46A', '관계': '#D68FA6', '감정': '#DB9B57', '리듬': '#A08FD0' };

export interface Personality {
  /** 난이도 ★1~3 */
  star: 1 | 2 | 3;
  cat: PersCat;
  /** 칸에 쓰던 한 글자 약칭 */
  ch: string;
  desc: string;
  barks: string[];
  /** 반응 시간 배율 */
  react?: number;
  /** 회피 확률 보정 */
  dodge?: number;
  /** 딜 배율 */
  dps?: number;
  /** 예고가 끝나기 직전까지 버팀 */
  greedy?: boolean;
  /** 최대 체력 대비 이 비율 미만 피해면 장판 무시 */
  stubborn?: number;
  /** 엉뚱한 칸으로 갈 확률 */
  wrongWay?: number;
  /** 탱커로 뽑히지 않음 */
  noTank?: boolean;
  /** 체력이 이 비율 이상이면 장판 무시 */
  brave?: number;
  /** +1 아군 옆, -1 아군에게서 떨어짐 */
  dist?: number;
  /** 이 초 동안 힐을 못 받으면 삐짐 */
  attention?: number;
  thanks?: boolean;
  /** 체력이 이 비율 아래면 도망 */
  flee?: number;
  // ---------- 75 문서 (20종 추가) ----------
  /** 희귀: 공개모집에서 덜 나오고, 저레벨 던전에는 안 나옴 (04 6-F) */
  rare?: boolean;
  /** 느림보: 이동 시간 배율 */
  slow?: number;
  /** 따라쟁이: 가장 가까운 탱커 옆 칸을 고름 (탱커가 없으면 가장 가까운 아군) */
  follow?: boolean;
  /** 방랑자: every초마다 chance로 근처 빈 칸으로 옮김 */
  wander?: { every: number; chance: number };
  /** 미신쟁이: 시작 칸 = 명당. 명당이면 딜 +up, 밀려나면 sec초 동안 딜 −down */
  lucky?: { up: number; down: number; sec: number };
  /** 영웅: 반경 r 아군이 체력 hp 아래면 sec초 동안 그 아군 피해의 share를 대신 받음 (쿨 cd) */
  cover?: { hp: number; r: number; share: number; sec: number; cd: number };
  /** 이기주의자: 옆 아군이 체력 hp 아래면 옆에 아무도 없는 칸으로 (쿨 cd) */
  selfish?: { hp: number; cd: number };
  /** 응원단장: 반경 1 아군이 체력 hp 아래로 떨어지면 반경 1 아군 딜 +up (sec초, 쿨 cd) */
  cheer?: { hp: number; up: number; sec: number; cd: number };
  /** 경쟁심: 같은 역할 딜 1위가 아니면 딜 +up, 회피 dodge */
  rival?: { up: number; dodge: number };
  /** 다혈질: 아군이 쓰러지면 sec초 동안 딜 +up, 장판 안 피함 */
  rage?: { up: number; sec: number };
  /** 침착함: 옮겨붙는 디버프를 받으면 꼭 혼자 비켜 섬 */
  calm?: boolean;
  /** 낙천가: 체력 조건 생존 능력을 늦게 (조건 체력 × 이 값) */
  lateGuard?: number;
  /** 비관론자: 체력 조건 생존 능력을 이 체력 아래면 바로 */
  earlyGuard?: number;
  /** 소심이: 디버프가 걸리면 이 초 동안 당황 (이리저리, 딜 0). 해제하면 바로 진정 */
  panic?: number;
  /** 승부사: 보스 체력 at 아래에서 딜 +up, 회피 dodge */
  allIn?: { at: number; up: number; dodge: number };
  /** 용두사미: 처음 sec초 딜 ×up, 그 뒤 ×after */
  dash?: { sec: number; up: number; after: number };
  /** 대기만성: 딜 ×start에서 every초마다 +step (최대 ×max) */
  warm?: { start: number; step: number; every: number; max: number };
  /** 몰입형: 크게 안 맞은 every초마다 딜 +step (최대 +max), 최대 체력 hit 넘게 한 번에 맞으면 처음부터 */
  focus?: { every: number; step: number; max: number; hit: number };
  /** 완벽주의자: 평소 딜 +up, 한 번에 최대 체력 hit 넘게 맞으면 sec초 동안 딜 −down · 반응 ×react */
  perfect?: { up: number; hit: number; down: number; sec: number; react: number };
  /** 뉴비: 처음엔 반응 ×react · 회피 dodge, 같은 보스 기술을 볼 때마다 반응 ×stepReact · 회피 +stepDodge (기술마다 max번) */
  learn?: { react: number; dodge: number; stepReact: number; stepDodge: number; max: number };
}

/**
 * 관심종자 삐짐 제한 (2026-10-16 Lim 「삐짐이 너무 자주 · 힐해 주고 끝나면 또 삐짐」, 04 4장): 한 번 삐진 뒤에는 again초 동안 직접 힐을
 * 못 받아야 다시 삐지고, 한 전투에 max번까지. 삐진 지 long초가 지나면 혼자 풀림 (풀림 말은 힐로 풀 때만). 프로토타입 일치 판 (cfg.proto)은 옛 규칙
 */
export const SULK = { again: 60, max: 2, long: 25 };

export const PERS = {
  '신중파': { star: 1, cat: '회피', ch: '신', react: 0.5, dodge: 0.10, dps: 0.9, desc: '가장 먼저 피합니다. 딜은 조금 약합니다.', barks: ['조심!', '다음 패턴 피해'] },
  '딜 욕심쟁이': { star: 2, cat: '회피', ch: '딜', react: 1.8, dodge: -0.15, dps: 1.2, greedy: true, desc: '예고가 끝나기 직전까지 딜하다가 늦게 피합니다.', barks: ['한 대만 더!', '딜 1등 찍었다 ㅋ'] },
  '고집불통': { star: 2, cat: '회피', ch: '고', stubborn: 0.4, desc: '최대 체력 40% 이상의 피해가 아니면 장판을 피하지 않습니다.', barks: ['안 움직여', '원래 이렇게 하는 거임'] },
  '덜렁이': { star: 3, cat: '회피', ch: '덜', dodge: -0.10, wrongWay: 0.10, noTank: true, desc: '가끔 장판 안으로 들어갑니다.', barks: ['어? 여기 아니야?', '어 이거 밟으면 안 되는 거였음?'] },
  '허세꾼': { star: 3, cat: '회피', ch: '허', brave: 0.7, desc: '체력이 70% 이상이면 장판을 피하지 않습니다.', barks: ['안 아파!', '이 정도쯤이야'] },
  '외톨이': { star: 1, cat: '위치', ch: '외', dist: -1, desc: '아군과 떨어진 칸에 섭니다. 광역 힐 범위 밖에 있기 쉽습니다.', barks: ['…'] },
  '사교형': { star: 1, cat: '위치', ch: '사', dist: 1, desc: '아군 옆에 붙습니다. 광역 힐 효율이 좋습니다.', barks: ['같이 가자!', '다들 모여~'] },
  '관심종자': { star: 3, cat: '관계', ch: '관', attention: 12, desc: `12초 동안 힐을 못 받으면 삐져서 딜이 25% 줄어듭니다. 힐을 받거나 ${SULK.long}초가 지나면 풀리고, 한 전투에 ${SULK.max}번까지 삐집니다.`, barks: ['힐러님 나 안 보여?', '나도 좀 봐줘…'] },
  '감사형': { star: 1, cat: '관계', ch: '감', thanks: true, desc: '힐을 받으면 3초 동안 딜이 10% 늘어납니다.', barks: ['ㄱㅅㄱㅅ', '덕분에 살았다!'] },
  '겁쟁이': { star: 3, cat: '감정', ch: '겁', flee: 0.5, noTank: true, desc: '체력이 50% 아래면 뒷줄로 도망가 딜을 멈추고, 80%가 되면 돌아옵니다.', barks: ['으악 도망!', '나 빠질게 무서워'] },
  // ---------- 75 문서: 20종 추가 (2026-10-14) ----------
  '눈치백단': { star: 1, cat: '회피', ch: '눈', rare: true, react: 0.3, dodge: 0.2, dps: 0.95, desc: '예고를 거의 미리 읽고 피합니다. 딜은 조금 약합니다.', barks: ['올 것 같아', '곧 장판 옴'] },
  '느림보': { star: 2, cat: '회피', ch: '느', slow: 2, desc: '반응은 보통인데 이동이 두 배 느려 장판 끝자락에 자주 걸립니다.', barks: ['잠깐만…', '천천히 가는 중'] },
  '따라쟁이': { star: 2, cat: '위치', ch: '따', follow: true, noTank: true, desc: '가장 가까운 탱커 옆에 붙어 다닙니다. 탱커를 노리는 광역에 같이 맞기 쉽습니다.', barks: ['탱님 따라감', '나도 거기 갈래'] },
  '방랑자': { star: 2, cat: '위치', ch: '방', wander: { every: 15, chance: 0.3 }, noTank: true, desc: '15초마다 가끔 근처 빈 칸으로 자리를 옮깁니다. 옮기는 동안 딜이 멈춥니다.', barks: ['저쪽이 좋아 보여', '여기 말고 저기'] },
  '미신쟁이': { star: 2, cat: '위치', ch: '미', rare: true, lucky: { up: 0.25, down: 0.2, sec: 5 }, desc: '시작 칸이 명당입니다. 명당에 있으면 딜이 25% 늘고, 밀려나면 5초 동안 20% 줄어듭니다.', barks: ['여기가 명당이야', '내 명당 돌려줘'] },
  '영웅': { star: 2, cat: '관계', ch: '영', cover: { hp: 0.25, r: 2, share: 0.3, sec: 5, cd: 15 }, desc: '반경 2 아군의 체력이 25% 아래면 5초 동안 그 아군이 받는 피해의 30%를 대신 받습니다.', barks: ['내가 막을게!', '뒤로 빠져 있어'] },
  '이기주의자': { star: 2, cat: '관계', ch: '이', selfish: { hp: 0.25, cd: 10 }, desc: '옆 아군이 위험하면 같이 맞지 않으려고 혼자 떨어진 칸으로 갑니다.', barks: ['난 살아야지', '각자도생'] },
  '응원단장': { star: 1, cat: '관계', ch: '응', dps: 0.9, cheer: { hp: 0.25, up: 0.1, sec: 5, cd: 10 }, desc: '옆 아군이 위험하면 응원해 옆 아군의 딜이 5초 동안 10% 늘어납니다. 본인 딜은 조금 약합니다.', barks: ['힘내!!', '할 수 있다!'] },
  '경쟁심': { star: 2, cat: '관계', ch: '경', rare: true, rival: { up: 0.15, dodge: -0.1 }, desc: '같은 역할에서 딜 1위가 아니면 딜이 15% 늘지만 무리해서 회피가 10%p 줄어듭니다.', barks: ['내가 더 세!', '1등 내놔'] },
  '다혈질': { star: 2, cat: '감정', ch: '다', rage: { up: 0.3, sec: 10 }, desc: '아군이 쓰러지면 10초 동안 분노해 딜이 30% 늘고 장판을 피하지 않습니다.', barks: ['용서 못 해!', '가만 안 둬'] },
  '침착함': { star: 1, cat: '감정', ch: '침', calm: true, dodge: 0.05, desc: '옮겨붙는 디버프가 걸리면 꼭 혼자 떨어진 칸으로 비켜 섭니다. 회피가 조금 좋습니다.', barks: ['떨어질게', '침착하게'] },
  '낙천가': { star: 2, cat: '감정', ch: '낙', lateGuard: 0.5, desc: '생존 능력을 끝까지 아끼다 늦게 씁니다. 체력 조건이 절반입니다.', barks: ['괜찮아 괜찮아', '아직 멀쩡함'] },
  '비관론자': { star: 2, cat: '감정', ch: '비', earlyGuard: 0.6, desc: '체력이 60% 아래면 생존 능력을 바로 써 버려 정작 위기에 없습니다.', barks: ['망했어…', '이거 안 될 듯'] },
  '소심이': { star: 3, cat: '감정', ch: '소', panic: 3, noTank: true, desc: '디버프가 걸리면 3초 동안 당황해 이리저리 움직이고 딜을 멈춥니다. 해제하면 바로 진정합니다.', barks: ['뭐야 이거 뭐야!', '떼 줘 떼 줘'] },
  '승부사': { star: 2, cat: '감정', ch: '승', allIn: { at: 0.3, up: 0.2, dodge: -0.1 }, desc: '보스 체력이 30% 아래면 딜이 20% 늘지만 회피가 10%p 줄어듭니다.', barks: ['지금이야!', '여기서 끝낸다'] },
  '용두사미': { star: 1, cat: '리듬', ch: '용', dash: { sec: 60, up: 1.3, after: 0.9 }, desc: '처음 60초는 딜이 30% 늘고, 그 뒤로는 10% 줄어듭니다.', barks: ['처음부터 전력!', '힘 빠진다…'] },
  '대기만성': { star: 1, cat: '리듬', ch: '대', warm: { start: 0.8, step: 0.1, every: 30, max: 1.4 }, desc: '처음엔 딜이 20% 약하고 30초마다 10%씩 올라 최대 40%까지 늘어납니다.', barks: ['이제 몸 풀렸다', '천천히 올라감'] },
  '몰입형': { star: 2, cat: '리듬', ch: '몰', rare: true, focus: { every: 5, step: 0.05, max: 0.4, hit: 0.05 }, desc: '크게 안 맞은 5초마다 딜이 5%씩 늘어 최대 40%. 한 번에 최대 체력 5% 넘게 맞으면 처음부터입니다.', barks: ['집중…', '아 흐름 끊겼다'] },
  '완벽주의자': { star: 2, cat: '감정', ch: '완', perfect: { up: 0.1, hit: 0.15, down: 0.2, sec: 8, react: 1.3 }, desc: '평소 딜이 10% 늘지만, 한 번에 최대 체력 15% 넘게 맞으면 8초 동안 딜이 20% 줄고 반응이 느려집니다.', barks: ['완벽하게 간다', '아 이건 아닌데'] },
  '뉴비': { star: 2, cat: '회피', ch: '뉴', learn: { react: 1.6, dodge: -0.1, stepReact: 0.85, stepDodge: 0.05, max: 3 }, desc: '처음엔 반응이 느리고 잘 못 피하지만, 같은 보스 기술을 볼 때마다 빨라집니다. 기술마다 3번까지입니다.', barks: ['이거 뭐임?', '이제 알겠다'] },
} as const satisfies Record<string, Personality>;

export type PersName = keyof typeof PERS;
export const PERS_NAMES = Object.keys(PERS) as PersName[];
/** 프로토타입 성격 10종 (rollParty · 프로토타입 일치 테스트). 실제 공개모집은 nicknames.ts 파티원 목록 */
export const PROTO_PERS: PersName[] = PERS_NAMES.slice(0, 10);

/** 프로토타입 닉네임 28개: rollParty (프로토타입 일치 테스트)에만 씀. 실제 공개모집 · 길드 닉네임은 nicknames.ts 직업별 목록 (74) */
export const NICKS: readonly string[] = ['장판요정', '딜미터1등', '말없는탱', '칼날', '감자도적', '새벽세시', '고인물', '버스기사', '닉값함', '퇴근각', '만렙꿈나무', '냥냥펀치', '불꽃남자', '얼음공주', '컨트롤장인', '딜뽕', '오늘만산다', '회피의신', '맞고보자', '탱하기싫다', '원딜장인', '활쏘는곰', '초코우유', '늦잠왕', '야근요정', '방패든양', '도끼든토끼', '별빛궁수'];
