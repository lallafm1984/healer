/**
 * 파티원 성격 (04 6장 · 75 · 95 문서). 앞 10종은 프로토타입과 같은 순서 (rollParty가 PROTO_PERS로 뽑으므로 바꾸지 말 것),
 * 다음 20종은 2026-10-14 Lim 「성격을 20종 더 추가해서 다양한 변수」로 더함 (04에 설계만 있던 18종 + 완벽주의자 · 뉴비).
 * 그 뒤 15종은 2026-10-18 Lim 「추천대로 하자」 (95 1차): 새 묶음 손버릇 (직업 스킬 쓰는 버릇) · 탱커 (탱커만) · 힐 (받는 치유),
 * 마지막 25종은 95 2차 (기존 묶음 회피 · 위치 · 관계 · 감정 · 리듬). 새 성격은 늘 뒤에 붙인다
 */
export type PersCat = '회피' | '위치' | '관계' | '감정' | '리듬' | '손버릇' | '탱커' | '힐';

/** 분류 색 (편성 칩 바탕, 글자는 짙은 갈색). 95 새 묶음 셋은 길드 홀 돌 · 황동 톤에 맞춘 놋쇠 · 돌 · 이끼 민트 */
export const CATS: Record<PersCat, string> = {
  '회피': '#7FA3BD', '위치': '#A3B46A', '관계': '#D68FA6', '감정': '#DB9B57', '리듬': '#A08FD0',
  '손버릇': '#CDB46A', '탱커': '#B8AC98', '힐': '#82C29F',
};

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
  // ---------- 95 문서 1차 (손버릇 · 탱커 · 힐 15종) ----------
  /** 탱커 묶음: 탱커로만 뽑힘 (탱커 직업 파티원만 가짐) */
  tankOnly?: boolean;
  /** 쿨 아끼미: 직업 스킬을 위기 (나 아닌 파티원 체력 hp 아래 · 보스 체력 boss 아래)까지 아낌. 위기에 쓰면 효과 ×boost */
  hoard?: { hp: number; boss: number; boost: number };
  /** 스킬 난사: 직업 스킬을 쿨이 돌자마자 씀 (전투 after초부터, 죽을 피해에 쓰는 능력은 빼고) */
  spam?: { after: number };
  /** 끊기 욕심: 끊기를 먼저 시도 (성공률 +up), 끊을 시전을 본 뒤 sec초 동안 장판 반응 +late초 */
  cutter?: { up: number; late: number; sec: number };
  /** 쫄 사냥꾼: 판 위 적 (쫄)에게 딜 ×add, 보스에게 ×boss */
  addHunter?: { add: number; boss: number };
  /** 외골수: 판 위 적을 무시하고 보스만 (보스 딜 ×boss), 일반 · 정예 구간은 정예부터 */
  oneTrack?: { boss: number };
  /** 미리미리: 나를 노리는 강타 예고가 뜨면 생존기 (방어 능력)를 바로 씀 (체력 조건 생존기도) */
  preGuard?: boolean;
  /** 아슬아슬: 생존기를 강타 lead초 전에. ok 확률로 딱 맞춤 (효과 ×boost), 아니면 늦어 맞은 뒤 late초에 씀 */
  clutch?: { lead: number; ok: number; boost: number; late: number };
  /** 쫄 모으기: 딜러를 때리는 쫄을 after초 뒤 끌어옴. 쫄 둘 이상이 이 탱커에게 모이면 파티의 쫄 딜 ×aoe */
  gather?: { after: number; aoe: number };
  /** 어그로 흘림: first초부터 every초마다 chance로 sec초 동안 보스 평타가 딜러에게. 탱커 딜 ×dps */
  slip?: { first: number; every: number; sec: number; dps: number };
  /** 어그로 (96): judge = 판단을 이 값처럼 (눈치백단 20) · judgeUp = 판단 ±, noEase = 성격이 켜진 동안 (경쟁심 쫓기 · 분노 · 폭주) 딜을 안 줄임 */
  aggro?: { judge?: number; judgeUp?: number; noEase?: boolean };
  /** 든든이: 체력 hp 넘으면 옆 아군이 받는 피해 −cut */
  sturdy?: { hp: number; cut: number };
  /** 자급자족: 체력 hp 아래면 최대 체력 heal만큼 스스로 회복 (쿨 cd) */
  selfCare?: { hp: number; heal: number; cd: number };
  /** 보호막 애호가: 보호막을 받으면 sec초 딜 +up */
  shieldLove?: { up: number; sec: number };
  /** 지속힐 체질 · 큰 힐 체질: 받는 직접 힐 ×direct, 지속 · 간접 회복 ×hot */
  healTaste?: { direct: number; hot: number };
  /** 자립형: 체력 hp 넘으면 every초마다 최대 체력 regen씩 스스로 회복, 받는 치유 ×taken */
  selfReg?: { hp: number; regen: number; every: number; taken: number };
  // ---------- 95 문서 2차 (기존 묶음 25종) ----------
  /** 예언가: 장판 반응을 lead초 당김 (예고가 뜨자마자), wrong 확률로 틀린 칸 (장판 안)에 갔다가 again초 뒤 다시 피함 */
  foresee?: { lead: number; wrong: number; again: number };
  /** 점프광: 나를 안 노리는 장판 예고에도 chance 확률로 옆 안전한 칸으로 뜀 (회피 · 딜은 dodge · dps 값) */
  jumpy?: { chance: number };
  /** 참을성: 최대 체력 small 아래 피해 장판은 안 피하고 생존기 (방어 능력)를 켜고 버팀 */
  endure?: { small: number };
  /** 모서리파: 피할 때 판 가장자리 칸 가산점 pref, 제자리 복귀 back초 늦게 */
  edge?: { pref: number; back: number };
  /** 얼음땡: 다른 장판 예고가 있는데 장판이 또 오면 sec초 굳음 (반응이 그만큼 늦음) */
  freeze?: { sec: number };
  /** 앞장이: 자기 역할이 설 수 있는 칸 중 보스 쪽 (앞줄) 가산점 pref */
  front?: { pref: number };
  /** 뒷줄파: 자기 역할이 설 수 있는 칸 중 뒷줄 가산점 pref, 근접이면 딜 ×melee */
  backline?: { pref: number; melee: number };
  /** 짝꿍: 시작 때 가장 가까운 아군 하나를 짝으로 옆에 붙어 다님. 붙어 있으면 둘 다 회피 +dodge */
  buddy?: { dodge: number };
  /** 양보왕: 피할 때 옆에 아군이 있는 칸을 피함 (아군 하나마다 −near) */
  yieldTo?: { near: number };
  /** 집돌이: 피한 뒤 바로 제자리로 (기다림 없음), 피할 때도 제자리 가까운 칸, 제자리에 있으면 딜 ×dps */
  homebody?: { dps: number };
  /** 대타: 탱커가 모두 쓰러지면 sec초 동안 보스를 대신 붙잡음 (받는 피해 −cut, 그동안 탱커 없음 광폭화가 안 셈, 쿨 cd) */
  standIn?: { sec: number; cut: number; cd: number };
  /** 큰형: 옆에 있는 뉴비 · 겁쟁이 · 소심이의 단점을 반으로 */
  mentor?: boolean;
  /** 분위기메이커: 전투 시작 sec초 동안 파티 전원 반응 시간 ×react */
  mood?: { sec: number; react: number };
  /** 칭찬왕: 위기 (체력 25% 아래)였던 아군이 60% 위로 살아나면 sec초 파티 딜 +up */
  praise?: { up: number; sec: number };
  /** 보은형: 자기가 위기에서 살아나면 sec초 회피 +dodge */
  repay?: { dodge: number; sec: number };
  /** 샘쟁이: 내가 직접 힐을 받으면 upSec초 딜 +up, 옆 사람만 받으면 downSec초 딜 −down */
  envy?: { up: number; upSec: number; down: number; downSec: number };
  /** 울보: 아군이 쓰러지면 sec초 딜 0 (피하기는 함) */
  cry?: { sec: number };
  /** 오뚝이: 체력이 처음 hp 아래로 가면 sec초 받는 피해 −cut (전투에 한 번) */
  bounce?: { hp: number; cut: number; sec: number };
  /** 예민형: 디버프가 있으면 딜 −down, 해제받으면 sec초 딜 +up */
  touchy?: { down: number; up: number; sec: number };
  /** 신바람: 내 칸 장판을 n번 연달아 피하면 sec초 딜 +up */
  wind?: { n: number; up: number; sec: number };
  /** 화풀이: 한 번에 최대 체력 hit 넘게 맞으면 sec초 딜 +up */
  vent?: { hit: number; up: number; sec: number };
  /** 폭주기관차: every초마다 끝 sec초 동안 딜 ×up, 그동안 장판 안 피함 */
  burst?: { every: number; sec: number; up: number };
  /** 쉬엄쉬엄: every초마다 끝 sec초 동안 쉼 (딜 0, 회피 +dodge) */
  breather?: { every: number; sec: number; dodge: number };
  /** 타이밍 장인: 보스가 멍함 · 무방비 · 기절인 동안 딜 ×up */
  timing?: { up: number };
  /** 끈기형: every초마다 반응 시간 ×step, 최저 ×min */
  grit?: { every: number; step: number; min: number };
}

/**
 * 관심종자 삐짐 제한 (2026-10-16 Lim 「삐짐이 너무 자주 · 힐해 주고 끝나면 또 삐짐」, 04 4장): 한 번 삐진 뒤에는 again초 동안 직접 힐을
 * 못 받아야 다시 삐지고, 한 전투에 max번까지. 삐진 지 long초가 지나면 혼자 풀림 (풀림 말은 힐로 풀 때만). 프로토타입 일치 판 (cfg.proto)은 옛 규칙
 */
export const SULK = { again: 60, max: 2, long: 25 };

export const PERS = {
  '신중파': { star: 1, cat: '회피', ch: '신', aggro: { judgeUp: 5 }, react: 0.5, dodge: 0.10, dps: 0.9, desc: '가장 먼저 피합니다. 딜은 조금 약합니다.', barks: ['조심!', '다음 패턴 피해'] },
  '딜 욕심쟁이': { star: 2, cat: '회피', ch: '딜', aggro: { judgeUp: -5 }, react: 1.8, dodge: -0.15, dps: 1.2, greedy: true, desc: '예고가 끝나기 직전까지 딜하다가 늦게 피합니다.', barks: ['한 대만 더!', '딜 1등 찍었다 ㅋ'] },
  '고집불통': { star: 2, cat: '회피', ch: '고', stubborn: 0.4, desc: '최대 체력 40% 이상의 피해가 아니면 장판을 피하지 않습니다.', barks: ['안 움직여', '원래 이렇게 하는 거임'] },
  '덜렁이': { star: 3, cat: '회피', ch: '덜', dodge: -0.10, wrongWay: 0.10, noTank: true, desc: '가끔 장판 안으로 들어갑니다.', barks: ['어? 여기 아니야?', '어 이거 밟으면 안 되는 거였음?'] },
  '허세꾼': { star: 3, cat: '회피', ch: '허', brave: 0.7, desc: '체력이 70% 이상이면 장판을 피하지 않습니다.', barks: ['안 아파!', '이 정도쯤이야'] },
  '외톨이': { star: 1, cat: '위치', ch: '외', dist: -1, desc: '아군과 떨어진 칸에 섭니다. 광역 힐 범위 밖에 있기 쉽습니다.', barks: ['…'] },
  '사교형': { star: 1, cat: '위치', ch: '사', dist: 1, desc: '아군 옆에 붙습니다. 광역 힐 효율이 좋습니다.', barks: ['같이 가자!', '다들 모여~'] },
  '관심종자': { star: 3, cat: '관계', ch: '관', attention: 12, desc: `12초 동안 힐을 못 받으면 삐져서 딜이 25% 줄어듭니다. 힐을 받거나 ${SULK.long}초가 지나면 풀리고, 한 전투에 ${SULK.max}번까지 삐집니다.`, barks: ['힐러님 나 안 보여?', '나도 좀 봐줘…'] },
  '감사형': { star: 1, cat: '관계', ch: '감', thanks: true, desc: '힐을 받으면 3초 동안 딜이 10% 늘어납니다.', barks: ['ㄱㅅㄱㅅ', '덕분에 살았다!'] },
  '겁쟁이': { star: 3, cat: '감정', ch: '겁', flee: 0.5, noTank: true, desc: '체력이 50% 아래면 뒷줄로 도망가 딜을 멈추고, 80%가 되면 돌아옵니다.', barks: ['으악 도망!', '나 빠질게 무서워'] },
  // ---------- 75 문서: 20종 추가 (2026-10-14) ----------
  '눈치백단': { star: 1, cat: '회피', ch: '눈', rare: true, aggro: { judge: 20 }, react: 0.3, dodge: 0.2, dps: 0.95, desc: '예고를 거의 미리 읽고 피합니다. 딜은 조금 약합니다.', barks: ['올 것 같아', '곧 장판 옴'] },
  '느림보': { star: 2, cat: '회피', ch: '느', slow: 2, desc: '반응은 보통인데 이동이 두 배 느려 장판 끝자락에 자주 걸립니다.', barks: ['잠깐만…', '천천히 가는 중'] },
  '따라쟁이': { star: 2, cat: '위치', ch: '따', follow: true, noTank: true, desc: '가장 가까운 탱커 옆에 붙어 다닙니다. 탱커를 노리는 광역에 같이 맞기 쉽습니다.', barks: ['탱님 따라감', '나도 거기 갈래'] },
  '방랑자': { star: 2, cat: '위치', ch: '방', wander: { every: 15, chance: 0.3 }, noTank: true, desc: '15초마다 가끔 근처 빈 칸으로 자리를 옮깁니다. 옮기는 동안 딜이 멈춥니다.', barks: ['저쪽이 좋아 보여', '여기 말고 저기'] },
  '미신쟁이': { star: 2, cat: '위치', ch: '미', rare: true, lucky: { up: 0.25, down: 0.2, sec: 5 }, desc: '시작 칸이 명당입니다. 명당에 있으면 딜이 25% 늘고, 밀려나면 5초 동안 20% 줄어듭니다.', barks: ['여기가 명당이야', '내 명당 돌려줘'] },
  '영웅': { star: 2, cat: '관계', ch: '영', cover: { hp: 0.25, r: 2, share: 0.3, sec: 5, cd: 15 }, desc: '반경 2 아군의 체력이 25% 아래면 5초 동안 그 아군이 받는 피해의 30%를 대신 받습니다.', barks: ['내가 막을게!', '뒤로 빠져 있어'] },
  '이기주의자': { star: 2, cat: '관계', ch: '이', selfish: { hp: 0.25, cd: 10 }, desc: '옆 아군이 위험하면 같이 맞지 않으려고 혼자 떨어진 칸으로 갑니다.', barks: ['난 살아야지', '각자도생'] },
  '응원단장': { star: 1, cat: '관계', ch: '응', dps: 0.9, cheer: { hp: 0.25, up: 0.1, sec: 5, cd: 10 }, desc: '옆 아군이 위험하면 응원해 옆 아군의 딜이 5초 동안 10% 늘어납니다. 본인 딜은 조금 약합니다.', barks: ['힘내!!', '할 수 있다!'] },
  '경쟁심': { star: 2, cat: '관계', ch: '경', rare: true, aggro: { noEase: true }, rival: { up: 0.15, dodge: -0.1 }, desc: '같은 역할에서 딜 1위가 아니면 딜이 15% 늘지만 무리해서 회피가 10%p 줄어듭니다.', barks: ['내가 더 세!', '1등 내놔'] },
  '다혈질': { star: 2, cat: '감정', ch: '다', aggro: { noEase: true }, rage: { up: 0.3, sec: 10 }, desc: '아군이 쓰러지면 10초 동안 분노해 딜이 30% 늘고 장판을 피하지 않습니다.', barks: ['용서 못 해!', '가만 안 둬'] },
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
  // ---------- 95 문서 1차: 손버릇 5 · 탱커 6 · 힐 4 (2026-10-18) ----------
  '쿨 아끼미': { star: 2, cat: '손버릇', ch: '쿨', hoard: { hp: 0.35, boss: 0.3, boost: 1.25 }, desc: '직업 스킬을 위기 (누가 체력 35% 아래 · 보스 30% 아래)까지 아낍니다. 위기에 쓰면 효과가 25% 큽니다.', barks: ['아직 아껴 둠', '지금이다'] },
  '스킬 난사': { star: 2, cat: '손버릇', ch: '난', spam: { after: 2 }, desc: '직업 스킬을 쿨이 돌자마자 씁니다. 자주 쓰지만 정작 필요할 때 없을 수 있습니다.', barks: ['쿨 돌았다!', '일단 씀'] },
  '끊기 욕심': { star: 2, cat: '손버릇', ch: '끊', cutter: { up: 0.15, late: 0.6, sec: 2 }, desc: '끊기를 먼저 시도하고 성공률이 15%p 높습니다. 시전을 노리는 2초 동안은 장판을 늦게 봅니다.', barks: ['내가 끊는다', '시전 봤다'] },
  '쫄 사냥꾼': { star: 2, cat: '손버릇', ch: '쫄', addHunter: { add: 1.3, boss: 0.9 }, desc: '판 위 적 (쫄)에게 주는 딜이 30% 늘고, 보스에게 주는 딜은 10% 줄어듭니다.', barks: ['쫄 내놔', '한 마리 추가'] },
  '외골수': { star: 3, cat: '손버릇', ch: '골', oneTrack: { boss: 1.1 }, noTank: true, desc: '판 위 적을 무시하고 보스만 칩니다. 보스 딜이 10% 늘지만 쫄이 남아 다른 파티원이 맞습니다.', barks: ['보스만 팸', '쫄은 몰라'] },
  '미리미리': { star: 1, cat: '탱커', ch: '리', tankOnly: true, preGuard: true, desc: '강타 예고가 뜨면 생존기를 바로 켭니다. 체력 조건 생존기도 켜서, 다음 강타나 위기 때 없을 수 있습니다.', barks: ['미리 켜 둠', '대비 완료'] },
  '아슬아슬': { star: 2, cat: '탱커', ch: '슬', tankOnly: true, clutch: { lead: 0.3, ok: 0.8, boost: 1.2, late: 0.2 }, desc: '생존기를 강타 직전에 켭니다. 열에 여덟은 딱 맞아 효과가 20% 크고, 둘은 늦어 강타를 그대로 맞습니다.', barks: ['지금!', '아 늦었다'] },
  '쫄 모으기': { star: 2, cat: '탱커', ch: '모', tankOnly: true, gather: { after: 1, aoe: 1.25 }, desc: '딜러를 때리는 쫄을 모두 끌어와 한곳에 모읍니다. 모인 쫄은 딜이 25% 더 들지만 탱커가 받는 피해가 큽니다.', barks: ['다 이리 와', '한곳에 모았다'] },
  '어그로 흘림': { star: 3, cat: '탱커', ch: '흘', tankOnly: true, rare: true, slip: { first: 15, every: 20, sec: 3, dps: 1.2 }, desc: '딜이 20% 세지만 20초마다 3초 동안 딴생각을 해 어그로를 쌓지 못합니다. 딜러가 세면 보스를 뺏깁니다.', barks: ['어 어그로 튐', '다시 잡았다'] },
  '든든이': { star: 1, cat: '탱커', ch: '든', tankOnly: true, sturdy: { hp: 0.5, cut: 0.05 }, desc: '체력이 50% 넘으면 옆 아군이 받는 피해가 5% 줄어듭니다.', barks: ['내 옆에 서', '걱정 마'] },
  '자급자족': { star: 1, cat: '탱커', ch: '자', tankOnly: true, selfCare: { hp: 0.4, heal: 0.15, cd: 30 }, desc: '체력이 40% 아래면 스스로 최대 체력 15%를 회복합니다. 30초에 한 번입니다.', barks: ['내 피는 내가', '셀프 힐 간다'] },
  '보호막 애호가': { star: 1, cat: '힐', ch: '막', shieldLove: { up: 0.15, sec: 5 }, desc: '보호막을 받으면 5초 동안 딜이 15% 늘어납니다.', barks: ['막 최고!', '막 좀 줘'] },
  '지속힐 체질': { star: 2, cat: '힐', ch: '지', healTaste: { direct: 0.9, hot: 1.2 }, desc: '지속 힐 · 간접 회복을 20% 더 받고, 직접 힐은 10% 덜 받습니다.', barks: ['천천히 차는 게 좋아', '도트 힐 최고'] },
  '큰 힐 체질': { star: 2, cat: '힐', ch: '큰', healTaste: { direct: 1.2, hot: 0.9 }, desc: '직접 힐을 20% 더 받고, 지속 힐 · 간접 회복은 10% 덜 받습니다.', barks: ['큰 거 한 방!', '찔끔 힐은 별로'] },
  '자립형': { star: 1, cat: '힐', ch: '립', selfReg: { hp: 0.6, regen: 0.02, every: 3, taken: 0.9 }, desc: '체력이 60% 넘으면 3초마다 최대 체력 2%씩 스스로 회복하고, 받는 치유는 10% 줄어듭니다.', barks: ['알아서 할게', '딴 사람 먼저'] },
  // ---------- 95 문서 2차: 회피 5 · 위치 5 · 관계 6 · 감정 5 · 리듬 4 (2026-10-18) ----------
  '예언가': { star: 2, cat: '회피', ch: '예', rare: true, foresee: { lead: 1, wrong: 0.2, again: 0.6 }, desc: '장판 예고가 뜨자마자 1초 먼저 움직입니다. 다섯 번에 한 번은 틀린 칸으로 갔다가 다시 피합니다.', barks: ['거기 올 거야', '어 반대였나'] },
  '점프광': { star: 2, cat: '회피', ch: '점', jumpy: { chance: 0.5 }, dodge: 0.25, dps: 0.95, desc: '자기를 안 노리는 장판 예고에도 옆 칸으로 자주 뛰어 피하는 척합니다. 장판엔 거의 안 맞지만 뛰는 동안 딜을 못 하고 딜이 5% 약합니다.', barks: ['점프!', '일단 뛰고 봄'] },
  '참을성': { star: 2, cat: '회피', ch: '참', endure: { small: 0.3 }, desc: '최대 체력 30%가 안 되는 장판은 피하지 않고 생존기를 켜고 버팁니다. 정작 강타 때 생존기가 없을 수 있습니다.', barks: ['이 정도는 참음', '버틴다'] },
  '모서리파': { star: 2, cat: '회피', ch: '귀', edge: { pref: 30, back: 2 }, desc: '피할 때 늘 판 가장자리로 가고 제자리에 늦게 돌아옵니다. 광역 힐 범위 밖에 있기 쉽습니다.', barks: ['구석이 편해', '모서리 사수'] },
  '얼음땡': { star: 3, cat: '회피', ch: '얼', freeze: { sec: 1 }, noTank: true, desc: '장판이 둘 겹쳐 오면 1초 동안 굳어 늦게 피합니다.', barks: ['어어 얼음!', '땡 해 줘'] },
  '앞장이': { star: 2, cat: '위치', ch: '앞', front: { pref: 30 }, dps: 1.1, desc: '자기가 설 수 있는 칸 중 보스에 가장 가까운 칸을 고집합니다. 딜이 10% 늘지만 앞쪽 광역에 자주 맞습니다.', barks: ['앞으로!', '맨 앞이 내 자리'] },
  '뒷줄파': { star: 2, cat: '위치', ch: '뒷', backline: { pref: 30, melee: 0.9 }, noTank: true, desc: '자기가 설 수 있는 칸 중 늘 뒷줄에 섭니다. 앞쪽 공격에 덜 맞지만 근접이면 딜이 10% 약합니다.', barks: ['뒤에 있을게', '뒷줄이 안전'] },
  '짝꿍': { star: 1, cat: '위치', ch: '짝', buddy: { dodge: 0.05 }, desc: '시작할 때 가장 가까운 아군 하나를 짝으로 정해 옆에 붙어 다닙니다. 붙어 있으면 둘 다 회피가 5%p 늘어납니다.', barks: ['짝꿍 하자', '같이 가'] },
  '양보왕': { star: 2, cat: '위치', ch: '양', yieldTo: { near: 25 }, desc: '피할 때 아군이 있는 칸 옆을 피해 더 먼 칸으로 갑니다. 늦지만 아군과 겹쳐 맞지 않습니다.', barks: ['먼저 가', '난 저쪽'] },
  '집돌이': { star: 1, cat: '위치', ch: '집', homebody: { dps: 1.05 }, desc: '피하고 나면 바로 처음 칸으로 돌아오고, 제자리에 있으면 딜이 5% 늘어납니다. 같은 칸에 연달아 오는 장판에 걸리기 쉽습니다.', barks: ['집이 최고', '제자리 복귀'] },
  '대타': { star: 2, cat: '관계', ch: '타', rare: true, standIn: { sec: 10, cut: 0.4, cd: 30 }, noTank: true, desc: '탱커가 모두 쓰러지면 10초 동안 보스를 대신 붙잡습니다. 그동안 받는 피해가 40% 줄고 탱커 없음 광폭화가 늦춰집니다.', barks: ['내가 잡는다!', '탱 올 때까지만'] },
  '큰형': { star: 1, cat: '관계', ch: '형', rare: true, mentor: true, desc: '옆에 있는 뉴비 · 겁쟁이 · 소심이의 단점을 반으로 줄여 줍니다.', barks: ['형 옆에 있어', '천천히 해'] },
  '분위기메이커': { star: 1, cat: '관계', ch: '분', mood: { sec: 10, react: 0.9 }, desc: '전투 시작 10초 동안 파티 전원의 반응이 10% 빨라집니다.', barks: ['가보자고!', '오늘 분위기 좋다'] },
  '칭찬왕': { star: 1, cat: '관계', ch: '칭', praise: { up: 0.05, sec: 5 }, desc: '힐러가 위기의 아군을 살려 내면 칭찬해 5초 동안 파티 딜이 5% 늘어납니다.', barks: ['힐러 최고!', '방금 미쳤다'] },
  '보은형': { star: 1, cat: '관계', ch: '보', repay: { dodge: 0.1, sec: 10 }, desc: '자기가 위기에서 살아나면 10초 동안 회피가 10%p 늘어납니다.', barks: ['은혜 갚을게', '이번엔 안 맞음'] },
  '샘쟁이': { star: 2, cat: '관계', ch: '샘', envy: { up: 0.1, upSec: 5, down: 0.05, downSec: 3 }, desc: '내가 힐을 받으면 5초 동안 딜이 10% 늘고, 옆 사람만 받으면 3초 동안 딜이 5% 줄어듭니다.', barks: ['나도 줘', '흥 쟤만'] },
  '울보': { star: 3, cat: '감정', ch: '울', cry: { sec: 5 }, noTank: true, desc: '아군이 쓰러지면 5초 동안 울어서 딜을 멈춥니다. 장판은 피합니다.', barks: ['으앙…', '흑 안 돼'] },
  '오뚝이': { star: 1, cat: '감정', ch: '뚝', bounce: { hp: 0.1, cut: 0.5, sec: 3 }, desc: '체력이 처음 10% 아래로 떨어지면 3초 동안 받는 피해가 50% 줄어듭니다. 전투에 한 번입니다.', barks: ['안 넘어져!', '다시 일어남'] },
  '예민형': { star: 2, cat: '감정', ch: '민', touchy: { down: 0.2, up: 0.15, sec: 5 }, desc: '디버프가 걸려 있으면 딜이 20% 약하고, 해제받으면 5초 동안 딜이 15% 늘어납니다.', barks: ['이거 신경 쓰여', '이제 살 것 같다'] },
  '신바람': { star: 1, cat: '감정', ch: '바', wind: { n: 3, up: 0.2, sec: 5 }, desc: '내 칸 장판을 세 번 연달아 피하면 5초 동안 딜이 20% 늘어납니다.', barks: ['신난다!', '흐름 탔다'] },
  '화풀이': { star: 1, cat: '감정', ch: '화', vent: { hit: 0.15, up: 0.15, sec: 3 }, desc: '한 번에 최대 체력 15% 넘게 맞으면 3초 동안 딜이 15% 늘어납니다.', barks: ['아프잖아!', '갚아 준다'] },
  '폭주기관차': { star: 2, cat: '리듬', ch: '폭', aggro: { noEase: true }, burst: { every: 30, sec: 5, up: 1.5 }, desc: '30초마다 5초 동안 딜이 50% 늘지만 그동안 장판을 피하지 않습니다.', barks: ['폭주 간다!', '브레이크 없음'] },
  '쉬엄쉬엄': { star: 2, cat: '리듬', ch: '쉬', breather: { every: 25, sec: 2, dodge: 0.2 }, desc: '25초마다 2초씩 쉽니다. 쉬는 동안 딜이 없지만 회피가 20%p 늘어납니다.', barks: ['잠깐 쉼', '숨 좀 고르고'] },
  '타이밍 장인': { star: 1, cat: '리듬', ch: '틈', rare: true, timing: { up: 2 }, desc: '보스가 멍하거나 무방비 · 기절인 동안 딜이 두 배가 됩니다.', barks: ['지금 틈이다', '타이밍 왔다'] },
  '끈기형': { star: 1, cat: '리듬', ch: '끈', grit: { every: 30, step: 0.95, min: 0.8 }, desc: '30초마다 반응이 5%씩 빨라져 최대 20%까지 빨라집니다.', barks: ['끝까지 간다', '갈수록 잘 보임'] },
} as const satisfies Record<string, Personality>;

export type PersName = keyof typeof PERS;
export const PERS_NAMES = Object.keys(PERS) as PersName[];
/** 프로토타입 성격 10종 (rollParty · 프로토타입 일치 테스트). 실제 공개모집은 nicknames.ts 파티원 목록 */
export const PROTO_PERS: PersName[] = PERS_NAMES.slice(0, 10);

/** 프로토타입 닉네임 28개: rollParty (프로토타입 일치 테스트)에만 씀. 실제 공개모집 · 길드 닉네임은 nicknames.ts 직업별 목록 (74) */
export const NICKS: readonly string[] = ['장판요정', '딜미터1등', '말없는탱', '칼날', '감자도적', '새벽세시', '고인물', '버스기사', '닉값함', '퇴근각', '만렙꿈나무', '냥냥펀치', '불꽃남자', '얼음공주', '컨트롤장인', '딜뽕', '오늘만산다', '회피의신', '맞고보자', '탱하기싫다', '원딜장인', '활쏘는곰', '초코우유', '늦잠왕', '야근요정', '방패든양', '도끼든토끼', '별빛궁수'];
