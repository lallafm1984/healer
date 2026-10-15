/**
 * 특성 트리 (06 6장 사제, 77 드루이드 · 성기사): 직업마다 10단 × 3택1, Lv 5부터 5레벨마다 한 단 (34 2-1, Lv 50 완성). 언제든 무료로 바꿈.
 * 고른 특성은 직업마다 따로 저장 (25 4-1). 효과는 engine/talents.ts. 이름은 오리지널 (14 문서).
 * 세 직업 모두 단 구조 · 열리는 레벨 · 보조 버튼 규칙이 같다 (77 1장). 드루이드 · 성기사 수치는 TX 한 곳에서 (설명 문장도 TX를 씀)
 */
import { FEATURES } from './features';
import { DRUID_BIG, WARDER } from './heroConst';
import type { HeroKey } from './heroes';
import { SKILLS } from './skills';

export type PriestTalentKey =
  | 'longBreath' | 'lightTouch' | 'wideCircle'
  | 'brink' | 'washed' | 'practiced'
  | 'overflow' | 'hopRenew' | 'breather'
  | 'fullHeart' | 'spreadSerenity' | 'echoWord'
  | 'miracle' | 'savedWord' | 'cleansingWord'
  | 'repay' | 'twoGuard' | 'firmWill'
  | 'calmHymn' | 'shelter' | 'grief'
  | 'doublePoh' | 'shareRenew' | 'quickHymn'
  | 'twoShields' | 'focusOne' | 'hymnTail'
  | 'zenith' | 'scatter' | 'endless';

/** 드루이드 (77 2장) */
export type DruidTalentKey =
  | 'longSprout' | 'sproutGrowth' | 'branchGrowth'
  | 'firmStem' | 'earlySprout' | 'washRain'
  | 'deepGrowth' | 'growthBreath' | 'mossBed'
  | 'twinSprout' | 'colonyAll' | 'wideRoots'
  | 'springRain' | 'quickSprout' | 'cleanFlower'
  | 'treeBody' | 'nearGrove' | 'secondSpring'
  | 'rescueSprout' | 'watchSprout' | 'fallenFlower'
  | 'rebloomField' | 'flowerTrail' | 'seedScatter'
  | 'guardianGrove' | 'overflowSap' | 'greenField'
  | 'forestMemory' | 'oldTree' | 'wakeForest';

/** 성기사 (77 3장) */
export type PaladinTalentKey =
  | 'swiftLight' | 'devotionPath' | 'shareOath'
  | 'heavyStrike' | 'steadyHeart' | 'twinHands'
  | 'guardOath' | 'calmBreath' | 'waveEcho'
  | 'beaconWeight' | 'beaconBreath' | 'beaconDrift'
  | 'resolveFill' | 'freeLight' | 'waveCleanse'
  | 'lightArmor' | 'vowGuard' | 'rescueHand'
  | 'quickHand' | 'steadyLight' | 'martyr'
  | 'fullWave' | 'freeWave' | 'wideSanctuary'
  | 'tankLight' | 'beaconRing' | 'waveMarch'
  | 'dawnVow' | 'endlessLight' | 'allKnight';

/** 주술사 (79 2-7) */
export type ShamanTalentKey =
  | 'quickRipple' | 'calmShower' | 'splitDrop'
  | 'stoneDrop' | 'rippleChain' | 'sprayShower'
  | 'rootTotem' | 'dropChain' | 'washSpread'
  | 'keeperSpring' | 'springBreath' | 'twinSpring'
  | 'waterShield' | 'totemCall' | 'freshSpring'
  | 'earthGrace' | 'letFlow' | 'springSelf'
  | 'rapids' | 'alertTotem' | 'lastSpring'
  | 'returnChain' | 'overflowChain' | 'longChain'
  | 'twinEarth' | 'rainBreath' | 'stormChain'
  | 'waterSpirit' | 'endlessChain' | 'seaSeat';

/** 수도사 (79 3-7) */
export type MonkTalentKey =
  | 'heavyPalm' | 'lightPalm' | 'palmSplash'
  | 'embrace' | 'mistThrift' | 'chiWave'
  | 'stayMist' | 'longMist' | 'farMist'
  | 'focusBeat' | 'wideBeat' | 'sevenBeat'
  | 'steadyMind' | 'thousandHands' | 'beatSpread'
  | 'ironBody' | 'mistBody' | 'windAgain'
  | 'urgentPalm' | 'crisisBreath' | 'scatterMist'
  | 'mistPillar' | 'thriftBreath' | 'gatherMist'
  | 'windKnot' | 'calmWind' | 'mistPath'
  | 'chiBurst' | 'endlessBeat' | 'mistStorm';

/** 점성술사 (79 4-7) */
export type AstroTalentKey =
  | 'brightStar' | 'smallTwinkle' | 'scatterTwinkle'
  | 'etchedMark' | 'markBreath' | 'linkedMark'
  | 'brightPolaris' | 'quickLink' | 'clearNight'
  | 'onePoint' | 'threeShards' | 'fifthStar'
  | 'risingPolaris' | 'fallingNight' | 'secondStarfall'
  | 'unfading' | 'calmHands' | 'starCrowd'
  | 'prophecy' | 'foreseen' | 'fallingStar'
  | 'gatherLight' | 'thriftFall' | 'wideSky'
  | 'tankMemory' | 'thriftMemory' | 'longMemory'
  | 'supernova' | 'starPath' | 'milkyWay';

/** 결계사 (79 5-7) */
export type WarderTalentKey =
  | 'thickBarrier' | 'lightSeal' | 'splitBarrier'
  | 'lightOnBarrier' | 'longSeal' | 'cleanWard'
  | 'firmWard' | 'quickBarrier' | 'sealSpread'
  | 'heavyJudge' | 'quickJudge' | 'wideJudge'
  | 'judgeHammer' | 'sealEcho' | 'freshSeal'
  | 'selfBarrier' | 'barrierBreath' | 'sharedBurden'
  | 'stepIn' | 'preWard' | 'lastWard'
  | 'doubleCircle' | 'thriftCircle' | 'wideWard'
  | 'veilTank' | 'veilBreath' | 'sharedLoad'
  | 'citadel' | 'repentTime' | 'endlessJudge';

export type TalentKey = PriestTalentKey | DruidTalentKey | PaladinTalentKey | ShamanTalentKey | MonkTalentKey | AstroTalentKey | WarderTalentKey;

/** 보조 버튼으로 쓰는 특성 (06 9장 2번: 휠 밖 버튼). once = 전투당 1회, cell = 빈 칸을 골라서 */
export interface TalentActive { cd: number; dur: number; once?: boolean; cell?: boolean; short: string }
export interface TalentDef { key: TalentKey; name: string; desc: string; active?: TalentActive }
export interface TalentTier { lv: number; theme: string; picks: [TalentDef, TalentDef, TalentDef] }

const t = (key: TalentKey, name: string, desc: string, active?: TalentActive): TalentDef => ({ key, name, desc, active });
const pc = (x: number) => `${Math.round(x * 100)}%`;

/** 사제 (06 6장) */
export const TALENTS: TalentTier[] = [
  { lv: 5, theme: '기본 강화', picks: [t('longBreath', '긴 숨결', '소생 지속 시간이 3초 늘어납니다.'), t('lightTouch', '가벼운 손끝', '순간 치유의 마나 소모가 20% 줄어듭니다.'), t('wideCircle', '넓은 원', '치유의 기원 반경이 1 늘어 반경 2가 되고, 회복량은 20% 줄어듭니다.')] },
  { lv: 10, theme: '기본 강화', picks: [t('brink', '벼랑 끝 손길', '체력 30% 이하인 대상에게 하는 힐이 25% 늘어납니다.'), t('washed', '씻어낸 자리', '정화에 성공하면 대상의 체력을 {150} 회복합니다.'), t('practiced', '손에 익은 치유', '치유 시전 시간이 0.3초 줄어듭니다.')] },
  { lv: 15, theme: '기본 강화', picks: [t('overflow', '흘러넘침', '치유로 넘친 힐량의 50%가 붙어 있는 가장 다친 아군에게 흘러갑니다.'), t('hopRenew', '옮겨 가는 소생', '소생이 끝날 때 체력이 가장 낮은 옆 아군에게 한 번 옮겨 갑니다.'), t('breather', '숨 고르기', '3초 동안 아무것도 하지 않으면 마나 재생이 100% 늘어납니다.')] },
  { lv: 20, theme: '성언', picks: [t('fullHeart', '충만한 마음', '평온 게이지가 30% 더 빨리 찹니다.'), t('spreadSerenity', '번지는 평온', '성언: 평온이 옆 아군 2명에게도 50% 위력으로 들어갑니다.'), t('echoWord', '말씀의 여운', '성언: 평온을 쓴 뒤 5초 동안 마나 소모가 50% 줄어듭니다.')] },
  { lv: 25, theme: '성언', picks: [t('miracle', '기적의 순간', '전투마다 한 번, 평온 게이지를 바로 100%로 채웁니다.', { cd: 0, dur: 0, once: true, short: '기적' }), t('savedWord', '아껴 둔 말씀', '평온 게이지를 2회분까지 모아 둘 수 있습니다.'), t('cleansingWord', '씻는 말씀', '성언: 평온이 종류와 상관없이 디버프 1개도 제거합니다.')] },
  { lv: 30, theme: '생존', picks: [t('repay', '은혜 갚기', `내가 죽을 피해를 받으면 호감도가 가장 높은 파티원이 한 번 대신 맞습니다. 그 파티원 체력이 50% 이상일 때, 전투마다 1회 발동합니다. ${FEATURES.guild ? '호감도는 길드원은 함께 출전한 수, 공개모집은 이번 판에 내 힐을 받은 양입니다.' : '호감도는 이번 판에 내 힐을 받은 양입니다.'}`), t('twoGuard', '두 겹 수호', '수호 영혼을 2번까지 모아 둘 수 있습니다. 충전 시간은 120초입니다.'), t('firmWill', '굳은 의지', '내가 받는 피해가 20% 줄어듭니다.')] },
  { lv: 35, theme: '위기 대응', picks: [t('calmHymn', '고요한 찬가', '천상의 찬가 동안 파티원이 겁먹고 도망가지 않고, 장판 회피가 15% 늘어납니다.'), t('shelter', '쉼터', '빈 칸 1개를 20초 동안 쉼터로 만듭니다. 체력이 낮아 도망가는 파티원이 그리로 가고 초당 {30}씩 회복합니다. 재사용 대기시간은 60초입니다.', { cd: 60, dur: 20, cell: true, short: '쉼터' }), t('grief', '슬픔의 힘', '파티원이 쓰러지면 5초 동안 모든 힐이 30% 늘어납니다.')] },
  { lv: 40, theme: '범위 운영', picks: [t('doublePoh', '두 번 퍼지는 기원', '치유의 기원이 2초 뒤 50% 위력으로 한 번 더 퍼집니다.'), t('shareRenew', '나눠 주는 소생', '소생이 옆 아군 1명에게도 함께 걸립니다.'), t('quickHymn', '빨라진 찬가', '천상의 찬가 재사용 대기시간이 60초 줄어듭니다.')] },
  { lv: 45, theme: '대규모 운영', picks: [t('twoShields', '두 방패의 끈', '탱커 2명을 이어, 한쪽에 한 직접 힐의 30%가 다른 쪽에도 들어갑니다.'), t('focusOne', '한 사람만 본다', '같은 대상을 이어서 치유하면 한 번마다 10%씩, 최대 50%까지 늘어납니다.'), t('hymnTail', '찬가의 끝자락', '천상의 찬가가 끝나면 전원에게 6초 동안 {120} 회복하는 지속 힐을 겁니다.')] },
  { lv: 50, theme: '궁극', picks: [t('zenith', '기도의 정점', '20초 동안 모든 시전이 즉시 끝나지만 마나 소모가 1.5배가 됩니다. 재사용 대기시간은 180초입니다.', { cd: 180, dur: 20, short: '정점' }), t('scatter', '흩날리는 빛', '30초 동안 모든 직접 힐이 옆 2칸에 40%씩 튑니다. 재사용 대기시간은 180초입니다.', { cd: 180, dur: 30, short: '흩빛' }), t('endless', '끊이지 않는 말씀', '평온 게이지 50%에서도 위력 50%의 약한 성언: 평온을 쓸 수 있습니다.')] },
];

/**
 * 드루이드 · 성기사 특성 수치 (77). 엔진 · 설명 문장 · 테스트가 같이 씀.
 * 밸런스는 자동 밸런스 시뮬로 맞춤 (77 5장): 바꾸면 sim:raids · balance --check로 직업별 클리어율을 다시 봄
 */
export const TX = {
  // ---------- 드루이드 ----------
  /** 긴 새싹: 새싹 +초 (3초마다 70이라 그만큼 회복량도). 3의 배수로 둠: 2초면 틱이 70 → 65로 작아지고 마지막 틱이 잘려 오히려 손해 (보통 던전 35 → 70%) */
  longSprout: 3,
  /** 단비: 새싹이 걸린 대상에게 생장 즉시 회복 + */
  sproutGrowth: 0.15,
  /** 곁가지 생장: 생장 즉시 회복의 이 몫이 옆 칸에서 가장 낮은 1명에게 */
  branchGrowth: 0.35,
  /** 단단한 줄기: 새싹이 걸린 탱커 받는 피해 − */
  firmStem: 0.04,
  /** 이른 새싹: 체력 이 비율 이상 대상에게 새싹 마나 × (0 = 없음), 그 새싹 회복량 + */
  earlySprout: { hp: 0.9, cost: 0, heal: 0.2 },
  /** 씻어 내는 비: 지운 사람마다 회복 */
  washRain: { amt: 100 },
  /** 깊어지는 생장: 생장 지속 회복 (기본 6초 · 90) */
  deepGrowth: { sec: 8, amt: 120 },
  /** 이끼 자리: 새싹을 건 칸에 이끼 (초), 이끼 위 지속 힐 + */
  mossBed: { sec: 12, hot: 0.2 },
  /** 두 겹 새싹: 겹쳐 거는 두 번째 새싹 위력 */
  twinSprout: 0.75,
  /** 번지는 군락: 군락 칸마다 보너스 + (평소 10%) */
  colonyAll: 0.03,
  /** 뻗는 뿌리: 5인 이하에서 옆에 새싹이 없어도 군락 칸 수 최소 (레이드는 대신 2칸 거리까지 셈) */
  wideRoots: { min: 2 },
  /** 서두른 새싹: 새싹이 이 초마다 (평소 3초), 시간도 그만큼 짧게, 회복량 그대로 */
  quickSprout: 2,
  /** 맑은 새싹: 새싹을 걸면 디버프 1개를 지움, 재발동 대기 (초) */
  cleanFlower: { cd: 8 },
  /** 나무의 몸: 내 체력 이 아래면 나무껍질 (초), 재발동 대기 */
  treeBody: { hp: 0.4, sec: 8, cd: 60 },
  /** 곁의 숲: 옆 칸 아군 한 명마다 내가 받는 피해 −, 최대 */
  nearGrove: { step: 0.05, max: 0.15 },
  /** 두 번째 봄: 두 번째 환생 체력 */
  secondSpring: { hp: 0.25 },
  /** 급한 새싹: 체력 이 아래 대상에게 첫 틱을 바로 × */
  rescueSprout: { hp: 0.4, mult: 1.5 },
  /** 경계의 싹: 광역 예고가 뜨면 n명에게 sec초 · amt 새싹, 재발동 대기 */
  watchSprout: { n: 2, sec: 6, amt: 140, cd: 15 },
  /** 남은 꽃: 쓰러진 칸과 붙은 아군에게 지속 힐 */
  fallenFlower: { sec: 6, amt: 300 },
  /** 다시 피는 들꽃: 끝나면 같은 자리에 이 위력 */
  rebloomField: 0.25,
  /** 이어 피는 꽃: 들꽃 군락이 닿은 아군 새싹 +초 (그만큼 회복량도) */
  flowerTrail: 3,
  /** 흩날리는 꽃씨: 피워 내기 회복량의 이 몫이 옆 칸 n명에게 */
  seedScatter: { share: 0.3, n: 2 },
  /** 넘치는 수액: 지속 힐로 넘친 몫 */
  overflowSap: 0.2,
  /** 푸른 들판: 파티의 이 비율 이상에 새싹이면 새싹 회복 + */
  greenField: { share: 0.5, hot: 0.1 },
  /** 한 그루의 고목: 거둔 새싹 남은 회복량 × */
  oldTree: { mult: 2 },
  /** 깨어나는 숲: 들꽃 군락이 닿은 아군의 새싹이 바로 한 번 더 회복 (그 틱의 이 배) */
  wakeForest: 1,

  // ---------- 성기사 ----------
  /** 곧은 손길: 빛의 손길 시전 −초 */
  swiftLight: 0.3,
  /** 헌신의 길: 힘 이만큼부터 헌신 발동, 돌려받는 마나 % */
  devotionPath: { min: 2, mana: 4 },
  /** 나눠 주는 서약: 옆 칸 1명에게 이 위력 */
  shareOath: 0.5,
  /** 무거운 손길 (키는 heavyStrike, 2026-10-16 빛 일격을 없애며 빛의 손길로): 잃은 체력 1%마다 +, 최대 */
  heavyStrike: { per: 1, max: 0.5 },
  /** 곧은 마음: 봉화 대상에게 직접 힐 마나 − */
  steadyHeart: 0.25,
  /** 두 손의 빛: 빛의 손길 회복량의 이 몫이 옆 칸 1명에게 */
  twinHands: 0.3,
  /** 굳은 서약: 빛의 서약이 걸린 아군 받는 피해 − */
  guardOath: 0.1,
  /** 고른 호흡: 신성한 힘 1칸마다 마나 재생 + */
  calmBreath: 0.2,
  /** 파도의 여운: 빛의 파도로 회복한 아군에게 지속 힐 */
  waveEcho: { sec: 4, amt: 60 },
  /** 빛의 무게: 봉화 대상 받는 피해 − */
  beaconWeight: 0.05,
  /** 봉화의 숨: 봉화 몫이 들어갈 때마다 마나 % (번지는 봉화 · 모두의 기사로 다른 사람에게 가도) */
  beaconBreath: { mana: 0.5 },
  /** 번지는 봉화: 봉화 대상 체력이 이 비율 이상이면 옆 칸으로 */
  beaconDrift: 0.9,
  /** 가득 찬 빛: 신성한 힘을 채우고 sec초 동안 빛의 서약 · 빛의 파도 + */
  resolveFill: { sec: 10, heal: 0.3 },
  /** 빛의 갑옷: 신성한 힘 1칸마다 내가 받는 피해 − */
  lightArmor: 0.05,
  /** 지키는 맹세: 희생을 건 아군 받는 피해 − */
  vowGuard: 0.1,
  /** 구원의 손: 보호의 손 동안 마법 피해 ×, 끝날 때 회복 */
  rescueHand: { magic: 0.5, amt: 200 },
  /** 다급한 손: 체력 이 아래 대상에게 빛의 손길 시전 × */
  quickHand: { hp: 0.35, cast: 0.5 },
  /** 흔들림 없는 빛: 성역 안 장판 회피 + */
  steadyLight: 0.15,
  /** 순교의 빛: 초 동안 빛의 서약 + */
  martyr: { sec: 6, oath: 0.5 },
  /** 밀려오는 파도: 빛의 파도 최대 인원, 회복량 + */
  fullWave: { n: 5, heal: 0.1 },
  /** 넓은 성역: 2칸 거리, 초당 회복 − */
  wideSanctuary: 0.25,
  /** 탱커의 빛: 굳건한 손 (탱커 직접 힐) 배율 */
  tankLight: 0.25,
  /** 빛의 울림: 봉화 대상에게 직접 힐하면 붙은 아군에게 이 몫 */
  beaconRing: 0.25,
  /** 새벽의 맹세: 빛의 손길이 모으는 신성한 힘, 그동안 빛의 서약 · 빛의 파도 회복량 + */
  dawnVow: { gain: 2, heal: 0.3 },
  /** 끝없는 빛: 빛의 파도가 쓰는 신성한 힘 (평소 3칸 모두) */
  endlessLight: 2,
  /** 모두의 기사: 봉화 몫을 봉화 대상과 그 옆에서 가장 다친 n명에게 이 비율씩 */
  allKnight: { n: 3, share: 0.7 },

  // ---------- 주술사 (79 2-7) ----------
  /** 빠른 잔물결: 잔물결 시전 −초 · 잔잔한 물결: 잔물결 마나 − · 갈라지는 물방울: 붙은 다친 아군 1명에게 이 위력 물방울 */
  quickRipple: 0.3, calmShower: 0.2, splitDrop: 0.5,
  /** 돌 물방울: 물방울이 걸린 아군 받는 피해 − · 잔물결 이음: 물방울 +초 · 흩뿌리는 물결: 처음 튄 아군 말고 붙은 다친 1명에게 한 번 더 몫 */
  stoneDrop: 0.05, rippleChain: 3, sprayShower: 0.35,
  /** 뿌리 내린 토템: 토템 칸 받는 피해 감소 (둘레는 그대로) · 번지는 씻김: 붙은 아군 몇 명 */
  rootTotem: 0.3, washSpread: { n: 1 },
  /** 샘지기: 토템 칸 샘 회복 배 · 샘의 숨: 샘 토템 마나 · 두 개의 샘: 개수 */
  keeperSpring: 2, springBreath: { cost: 2 }, twinSpring: { n: 2 },
  /** 물의 방패: 가득 찬 아군 보호막 최대 · 초 · 토템 부르기 재사용 · 넓은 샘: 거리 · 회복량 − */
  waterShield: { max: 90, sec: 10 }, totemCall: { cd: 20 }, freshSpring: { range: 2, heal: 0.3 },
  /** 대지의 품: 토템 범위 안 내 받는 피해 − · 흘려보내기: 내 체력 선 · 재발동 · 나를 지키는 샘: 버티는 체력 */
  earthGrace: 0.2, letFlow: { hp: 0.4, cd: 45 }, springSelf: { hp: 0.3 },
  /** 급류: 체력 선 아래 잔물결 + · 경계하는 토템 재발동 · 마지막 샘 재발동 */
  rapids: { hp: 0.35, heal: 0.3 }, alertTotem: { cd: 10 }, lastSpring: { cd: 30 },
  /** 되돌아오는 사슬: 첫 대상에게 이 위력 · 긴 사슬: 인원 · 마나 +%p */
  returnChain: 0.5, longChain: { n: 6, cost: 2 },
  /** 두 대지: 충전 · 판 위 개수 (충전 시간 = 대지 토템 재사용) · 비의 숨: 비구름 동안 마나 소모 − */
  twinEarth: { n: 2 }, rainBreath: 0.5,
  /** 물의 정령: 튀는 인원 · 몫 · 끝없는 사슬: 튈 때 남는 비율 · 바다의 자리 */
  waterSpirit: { cd: 180, dur: 20, n: 2, share: [0.75, 0.56] }, endlessChain: 0.9, seaSeat: { cd: 180, dur: 15, range: 2, tick: 2, amt: 40 },

  // ---------- 수도사 (79 3-7) ----------
  /** 묵직한 손바닥: 탱커에게 + · 가벼운 손바닥: 마나 − · 튀는 손바닥: 붙은 가장 다친 1명에게 몫 */
  heavyPalm: 0.2, lightPalm: 0.25, palmSplash: 0.3,
  /** 품어 주기: 감싸기 대상 받는 피해 − · 초 · 아끼는 안개: 마나 % · 기의 물결: 해제하면 붙은 6칸 회복 */
  embrace: { cut: 0.1, sec: 6 }, mistThrift: { cost: 1 }, chiWave: { amt: 80 },
  /** 머무는 안개: 안 옮겨 가는 대신 + · 긴 안개: +초 · 멀리 가는 안개: 거리 · 옮겨 갈 때마다 다음 회복 + */
  stayMist: 0.3, longMist: 6, farMist: { range: 2, step: 0.2 },
  /** 한 점 리듬: 같은 대상 리듬마다 · 느슨한 박자: 이어지는 초 · 일곱 박자: 최대 리듬 */
  focusBeat: 0.09, wideBeat: 3.5, sevenBeat: 7,
  /** 흔들림 없는 마음: 끊기면 남는 비율 · 천 개의 손 · 퍼지는 박자: 리듬 · 인원 · 몫 */
  steadyMind: 0.5, thousandHands: { cd: 90, dur: 8, gcd: 0.5 }, beatSpread: { at: 5, n: 2, share: 0.4 },
  /** 강철 몸: 리듬마다 내 받는 피해 − (최대) · 안개 몸: 체력 선 · − · 초 · 재발동 · 다시 부는 바람: 버티는 체력 */
  ironBody: { step: 0.04, max: 0.2 }, mistBody: { hp: 0.4, cut: 0.3, sec: 4, cd: 60 }, windAgain: { hp: 0.25 },
  /** 급한 손바닥: 체력 선 · + · 위기의 숨결 재발동 · 흩어지는 안개: 인원 · 초 */
  urgentPalm: { hp: 0.3, heal: 0.4 }, crisisBreath: { cd: 30 }, scatterMist: { n: 3, sec: 9 },
  /** 안개 기둥: 가운데 배 · 아끼는 숨결: 마나 % · 모이는 안개 (◎) */
  mistPillar: 2, thriftBreath: { cost: 7 }, gatherMist: { cd: 60, dur: 8, hps: 20 },
  /** 바람 매듭: 탱커 배 · 잔잔한 바람: 초 · 마나 − · 안개 길: 초 */
  windKnot: 2, calmWind: { sec: 8, cost: 0.5 }, mistPath: { sec: 6 },
  /** 기 폭발 (◎) · 끝없는 박자: 리듬 · 마나 − · 안개 폭풍 (★): 틱 간격 */
  chiBurst: { cd: 120, range: 2, amt: 300, step: 0.1 }, endlessBeat: { at: 5, cost: 0.5 }, mistStorm: { cd: 180, dur: 12, tick: 1.5 },

  // ---------- 점성술사 (79 4-7) ----------
  /** 밝은 별: 별빛 치유 시전 −초 · 작은 반짝임: 마나 − · 흩어지는 반짝임: 붙은 가장 다친 1명에게 몫 */
  brightStar: 0.3, smallTwinkle: 0.3, scatterTwinkle: 0.4,
  /** 새긴 표식: 표식 보너스 · 표식의 숨: 마나 · 이어진 표식: 인원 */
  etchedMark: 0.8, markBreath: { mana: 1 }, linkedMark: { n: 1 },
  /** 빛나는 북극성: 체력 선 · + · 빠른 잇기: 별 하나 초 · 맑은 밤: 별 2 · 3 범위 · 회복 */
  brightPolaris: { hp: 0.5, heal: 0.25 }, quickLink: 0.5, clearNight: { range: 2, heal: -0.2 },
  /** 한 점: 탱커 북극성 + · 세 조각: 조각 최대 · 다섯째 별: 최대 · 별비 · 북극성 */
  onePoint: 0.2, threeShards: 2, fifthStar: { max: 5, fall: 200, polaris: 680 }, // 북극성 별 5개: 1150 → 680 (83 힐량 내림)
  /** 떠오르는 북극성: 완벽하면 재사용 −초 · 내리는 밤 (★) · 두 번째 별비: 초 뒤 · 위력 */
  risingPolaris: 10, fallingNight: { cd: 90, dur: 10 }, secondStarfall: { delay: 2, share: 0.5 },
  /** 지지 않는 별: 잠 초 · 차분한 손: 모으는 동안 − · 별 무리: 조각마다 − */
  unfading: { sec: 4 }, calmHands: 0.3, starCrowd: 0.08,
  /** 예언 · 내다본 손 · 떨어지는 별: 재발동 대기 */
  prophecy: { cd: 15 }, foreseen: { n: 2, cd: 20 }, fallingStar: { hp: 0.25, cd: 20 },
  /** 모이는 빛: 별 3개 가운데 배 · 아끼는 별비: 마나 % · 넓은 하늘: 별 4개 범위 · 회복 */
  gatherLight: 2, thriftFall: { cost: 9 }, wideSky: { range: 3, heal: -0.15 },
  /** 탱커의 기억: 몫 · 아끼는 기억: 마나 % · 긴 기억: 초 */
  tankMemory: 0.7, thriftMemory: { cost: 8 }, longMemory: 3,
  /** 초신성 (◎) · 은하수 (★) */
  supernova: { cd: 180, delay: 3, range: 2, amt: 400 }, milkyWay: { cd: 180, dur: 15, shards: 2 },

  // ---------- 결계사 (79 5-7) ----------
  /** 두꺼운 막: 탱커 막 + · 가벼운 인장: 마나 − · 갈라지는 막: 붙은 1명에게 두께 */
  thickBarrier: 0.3, lightSeal: 0.2, splitBarrier: 0.5,
  /** 막 위의 빛: 보호막이 있는 대상 직접 힐 + · 긴 인장: 초 · 맑은 결계: 보호막 */
  lightOnBarrier: 0.15, longSeal: 25, cleanWard: { amt: 100 },
  /** 굳은 결계: 수호 결계 감소 · 빠른 막: 재사용 · 번지는 인장: 인원 */
  firmWard: 0.5, quickBarrier: 4, sealSpread: { n: 1 },
  /** 무거운 심판: 가장 낮은 1명 배 · 빠른 심판: 시전 · 넓은 심판: 인원 */
  heavyJudge: 2, quickJudge: 1.5, wideJudge: 8,
  /** 심판의 망치 (★) · 새 인장: 회복 */
  judgeHammer: { cd: 60, dur: 15 }, freshSeal: { amt: 60 },
  /** 나를 위한 막: 양 · 초마다 · 막의 숨: 마나 재생 + · 나눠 지는 짐: 막 1명마다 − (최대) */
  selfBarrier: { amt: 200, every: 30 }, barrierBreath: 0.3, sharedBurden: { step: 0.05, max: 0.2 },
  /** 막아서기 · 미리 친 결계 · 마지막 결계 */
  stepIn: { hp: 0.3, amt: 200, cd: 15 }, preWard: { cd: 30 }, lastWard: { amt: 150, cd: 30 },
  /** 두 겹 원: 가운데 배 · 아끼는 원: 마나 % · 넓은 결계: 거리 · 두께 */
  doubleCircle: 2, thriftCircle: { cost: 7 }, wideWard: { range: 2, amt: -0.3 },
  /** 장막의 탱커: − · 장막의 숨: 마나 재생 배 · 함께 드는 짐: 거리 */
  veilTank: 2, veilBreath: 2, sharedLoad: { sec: 10 },
  /** 성채 (◎) · 참회의 시간: 창 딜 배 · 인원 · 끝없는 심판 (★) */
  citadel: { cd: 180, dur: 12, range: 2, cut: 0.2, tick: 3, amt: 60 }, repentTime: { heal: 1 }, endlessJudge: { cd: 180, dur: 10, cast: 1.0 },
} as const;

/** 드루이드 (77 2장) */
export const DRUID_TALENTS: TalentTier[] = [
  { lv: 5, theme: '기본 강화', picks: [
    t('longSprout', '긴 새싹', `새싹 지속 시간이 ${TX.longSprout}초 늘어나고, 늘어난 시간에도 3초마다 회복합니다. 모두 {${Math.round((280 * (12 + TX.longSprout)) / 12)}}입니다.`),
    t('sproutGrowth', '단비', `새싹이 걸린 아군에게 쓰는 생장의 즉시 회복이 ${pc(TX.sproutGrowth)} 늘어납니다.`),
    t('branchGrowth', '곁가지 생장', `생장의 즉시 회복이 대상 옆 칸에서 체력 비율이 가장 낮은 아군 1명에게도 ${pc(TX.branchGrowth)} 들어갑니다.`)] },
  { lv: 10, theme: '기본 강화', picks: [
    t('firmStem', '단단한 줄기', `새싹이 걸린 탱커가 받는 피해가 ${pc(TX.firmStem)} 줄어듭니다.`),
    t('earlySprout', '이른 새싹', `체력이 ${pc(TX.earlySprout.hp)} 이상인 아군에게 미리 거는 새싹은 마나를 쓰지 않고 회복량이 ${pc(TX.earlySprout.heal)} 늘어납니다.`),
    t('washRain', '씻어 내는 비', `자연 정화가 대상과 옆 칸 아군 1명의 디버프를 하나씩 지우고, 지운 사람마다 {${TX.washRain.amt}} 회복합니다.`)] },
  { lv: 15, theme: '기본 강화', picks: [
    t('deepGrowth', '깊어지는 생장', `생장의 지속 회복이 길어져 ${TX.deepGrowth.sec}초 동안 모두 {${TX.deepGrowth.amt}} 회복합니다. 평소는 6초 동안 {90}입니다.`),
    t('growthBreath', '생장의 숨', '생장을 쓰면 다음 새싹 1번은 마나를 쓰지 않습니다.'),
    t('mossBed', '이끼 자리', `새싹을 건 칸에 ${TX.mossBed.sec}초 동안 이끼가 깔립니다. 이끼 위에 선 아군은 지속 힐을 ${pc(TX.mossBed.hot)} 더 받습니다. 자리를 옮기면 받지 못합니다.`)] },
  { lv: 20, theme: '군락', picks: [
    t('twinSprout', '두 겹 새싹', `한 아군에게 새싹을 2개까지 겹쳐 걸 수 있습니다. 겹쳐 건 새싹은 ${pc(TX.twinSprout)} 위력으로 따로 회복합니다.`),
    t('colonyAll', '번지는 군락', `군락 보너스가 붙은 칸마다 ${pc(0.1 + TX.colonyAll)} (20인 레이드 ${pc(DRUID_BIG.colonyStep + TX.colonyAll)})로 늘고 생장 · 들꽃 군락의 지속 힐에도 붙습니다. 5인 이하 파티에서는 옆에 새싹이 없어도 1칸은 붙은 것으로 칩니다.`),
    t('wideRoots', '뻗는 뿌리', `5인 이하 파티에서는 옆에 새싹이 없어도 군락이 ${TX.wideRoots.min}칸 붙은 것으로 칩니다. 레이드에서는 대신 2칸 떨어진 새싹까지 군락으로 칩니다.`)] },
  { lv: 25, theme: '군락', picks: [
    t('springRain', '봄비', '전투마다 한 번, 새싹이 없는 모든 아군에게 새싹을 겁니다.', { cd: 0, dur: 0, once: true, short: '봄비' }),
    t('quickSprout', '서두른 새싹', `새싹이 3초 대신 ${TX.quickSprout}초마다 회복합니다. 지속 시간은 그만큼 짧아지고 회복량은 그대로입니다.`),
    t('cleanFlower', '맑은 새싹', `새싹을 걸면 대상의 마법 · 저주 · 독 디버프 1개를 함께 지웁니다. ${TX.cleanFlower.cd}초에 한 번 발동합니다.`)] },
  { lv: 30, theme: '생존', picks: [
    t('treeBody', '나무의 몸', `내 체력이 ${pc(TX.treeBody.hp)} 아래로 내려가면 나에게 나무껍질이 ${TX.treeBody.sec}초 동안 걸립니다. ${TX.treeBody.cd}초에 한 번 발동합니다.`),
    t('nearGrove', '곁의 숲', `내 옆 칸 아군 한 명마다 내가 받는 피해가 ${pc(TX.nearGrove.step)}씩, 최대 ${pc(TX.nearGrove.max)} 줄어듭니다.`),
    t('secondSpring', '두 번째 봄', `환생을 전투마다 2번 쓸 수 있습니다. 두 번째는 체력 ${pc(TX.secondSpring.hp)}로 일으킵니다.`)] },
  { lv: 35, theme: '위기 대응', picks: [
    t('rescueSprout', '급한 새싹', `체력이 ${pc(TX.rescueSprout.hp)} 이하인 아군에게 새싹을 걸면 첫 회복이 바로 ${TX.rescueSprout.mult}배로 들어갑니다.`),
    t('watchSprout', '경계의 싹', `보스 광역 공격 예고가 뜨면 새싹이 없는 아군 중 체력이 가장 낮은 ${TX.watchSprout.n}명에게 ${TX.watchSprout.sec}초 동안 {${TX.watchSprout.amt}} 회복하는 새싹을 겁니다. ${TX.watchSprout.cd}초에 한 번 발동합니다.`),
    t('fallenFlower', '남은 꽃', `파티원이 쓰러지면 그 칸과 붙은 아군에게 ${TX.fallenFlower.sec}초 동안 {${TX.fallenFlower.amt}} 회복하는 지속 힐을 겁니다.`)] },
  { lv: 40, theme: '범위 운영', picks: [
    t('rebloomField', '다시 피는 들꽃', `들꽃 군락이 끝나면 같은 자리에 ${pc(TX.rebloomField)} 위력으로 한 번 더 핍니다.`),
    t('flowerTrail', '이어 피는 꽃', `들꽃 군락이 닿은 아군에게 걸린 새싹이 ${TX.flowerTrail}초 늘어나고, 늘어난 시간만큼 더 회복합니다.`),
    t('seedScatter', '흩날리는 꽃씨', `피워 내기로 회복한 양의 ${pc(TX.seedScatter.share)}가 옆 칸 아군 ${TX.seedScatter.n}명에게 튑니다.`)] },
  { lv: 45, theme: '대규모 운영', picks: [
    t('guardianGrove', '탱커의 숲', '탱커에게 건 새싹은 옆에 새싹이 없어도 군락 보너스가 2칸 이상으로 붙습니다.'),
    t('overflowSap', '넘치는 수액', `지속 힐로 넘친 회복량의 ${pc(TX.overflowSap)}가 옆 칸에서 가장 다친 아군에게 흘러갑니다.`),
    t('greenField', '푸른 들판', `파티의 절반 이상에게 새싹이 걸려 있으면 모든 새싹 회복이 ${pc(TX.greenField.hot)} 늘어납니다.`)] },
  { lv: 50, theme: '궁극', picks: [
    t('forestMemory', '숲의 기억', '15초 동안 건 새싹은 끝까지 가면 한 번 더 걸립니다. 재사용 대기시간은 180초입니다.', { cd: 180, dur: 15, short: '기억' }),
    t('oldTree', '한 그루의 고목', `다른 아군에게 걸린 새싹을 모두 거둬, 체력 비율이 가장 낮은 아군 1명을 남은 회복량의 ${TX.oldTree.mult}배만큼 바로 회복합니다. 재사용 대기시간은 90초입니다.`, { cd: 90, dur: 0, short: '고목' }),
    t('wakeForest', '깨어나는 숲', '들꽃 군락을 쓰면 닿은 아군에게 걸린 새싹이 그 자리에서 한 번 더 회복합니다. 새싹의 남은 회복량은 줄지 않습니다.')] },
];

/** 성기사 (77 3장) */
export const PALADIN_TALENTS: TalentTier[] = [
  { lv: 5, theme: '기본 강화', picks: [
    t('swiftLight', '곧은 손길', `빛의 손길 시전 시간이 ${TX.swiftLight}초 줄어듭니다.`),
    t('devotionPath', '헌신의 길', `헌신이 신성한 힘 ${TX.devotionPath.min}칸을 한 번에 쓸 때도 발동하고, 돌려받는 마나가 ${TX.devotionPath.mana}%로 늘어납니다.`),
    t('shareOath', '나눠 주는 서약', `빛의 서약이 옆 칸에서 체력이 가장 낮은 아군 1명에게도 ${pc(TX.shareOath)} 위력으로 걸립니다.`)] },
  { lv: 10, theme: '기본 강화', picks: [
    t('heavyStrike', '무거운 손길', `빛의 손길이 대상이 잃은 체력 1%마다 ${TX.heavyStrike.per}%씩, 최대 ${pc(TX.heavyStrike.max)} 더 회복합니다.`),
    t('steadyHeart', '곧은 마음', `봉화 대상에게 직접 쓰는 빛의 손길은 마나 소모가 ${pc(TX.steadyHeart)} 줄어듭니다.`),
    t('twinHands', '두 손의 빛', `빛의 손길 회복량의 ${pc(TX.twinHands)}가 대상 옆 칸에서 체력이 가장 낮은 아군 1명에게도 들어갑니다.`)] },
  { lv: 15, theme: '기본 강화', picks: [
    t('guardOath', '굳은 서약', `빛의 서약이 걸린 아군이 받는 피해가 ${pc(TX.guardOath)} 줄어듭니다.`),
    t('calmBreath', '고른 호흡', `모아 둔 신성한 힘 1칸마다 마나 재생이 ${pc(TX.calmBreath)} 늘어납니다.`),
    t('waveEcho', '파도의 여운', `빛의 파도로 회복한 아군에게 ${TX.waveEcho.sec}초 동안 {${TX.waveEcho.amt}} 회복하는 지속 힐을 겁니다.`)] },
  { lv: 20, theme: '봉화', picks: [
    t('beaconWeight', '빛의 무게', `봉화 대상이 받는 피해가 ${pc(TX.beaconWeight)} 줄어듭니다.`),
    t('beaconBreath', '봉화의 숨', `빛의 손길의 봉화 몫이 들어갈 때마다 마나를 ${TX.beaconBreath.mana}% 돌려받습니다.`),
    t('beaconDrift', '번지는 봉화', `봉화 대상의 체력이 ${pc(TX.beaconDrift)} 이상이면 봉화 몫이 봉화 대상 옆 칸에서 가장 다친 아군에게 대신 들어갑니다.`)] },
  { lv: 25, theme: '신성한 힘', picks: [
    t('resolveFill', '가득 찬 빛', `신성한 힘을 가득 채우고, ${TX.resolveFill.sec}초 동안 빛의 서약 · 빛의 파도 회복량이 ${pc(TX.resolveFill.heal)} 늘어납니다. 재사용 대기시간은 60초입니다.`, { cd: 60, dur: TX.resolveFill.sec, short: '가득' }),
    t('freeLight', '모아 둔 빛', '신성한 힘이 가득 차면 다음 빛의 손길 1번은 마나를 쓰지 않습니다.'),
    t('waveCleanse', '빛의 길', '빛의 파도가 회복한 아군 중 1명의 마법 · 독 · 질병 디버프 1개를 지웁니다.')] },
  { lv: 30, theme: '생존', picks: [
    t('lightArmor', '빛의 갑옷', `모아 둔 신성한 힘 1칸마다 내가 받는 피해가 ${pc(TX.lightArmor)}씩 줄어듭니다.`),
    t('vowGuard', '지키는 맹세', `희생을 건 아군이 받는 피해가 ${pc(TX.vowGuard)} 더 줄어듭니다.`),
    t('rescueHand', '구원의 손', `보호의 손을 받은 아군은 그동안 마법 피해도 절반만 받고, 끝날 때 체력을 {${TX.rescueHand.amt}} 회복합니다.`)] },
  { lv: 35, theme: '위기 대응', picks: [
    t('quickHand', '다급한 손', `체력이 ${pc(TX.quickHand.hp)} 이하인 아군에게 쓰는 빛의 손길은 시전 시간이 절반입니다.`),
    t('steadyLight', '흔들림 없는 빛', `빛의 성역 안에 있는 파티원은 겁먹고 도망가지 않고, 장판 회피가 ${pc(TX.steadyLight)} 늘어납니다.`),
    t('martyr', '순교의 빛', `파티원이 쓰러지면 신성한 힘이 가득 차고, ${TX.martyr.sec}초 동안 빛의 서약 회복량이 ${pc(TX.martyr.oath)} 늘어납니다.`)] },
  { lv: 40, theme: '범위 운영', picks: [
    t('fullWave', '밀려오는 파도', `빛의 파도가 ${TX.fullWave.n}명까지 회복하고, 회복량이 ${pc(TX.fullWave.heal)} 늘어납니다.`),
    t('freeWave', '가벼운 파도', '빛의 파도가 마나를 쓰지 않습니다.'),
    t('wideSanctuary', '넓은 성역', `빛의 성역이 2칸 거리까지 닿고, 초당 회복량은 ${pc(TX.wideSanctuary)} 줄어듭니다.`)] },
  { lv: 45, theme: '대규모 운영', picks: [
    t('tankLight', '탱커의 빛', `굳건한 손 (탱커에게 하는 직접 힐 +10%)이 ${pc(TX.tankLight)}로 늘어납니다.`),
    t('beaconRing', '빛의 울림', `봉화 대상에게 직접 힐을 하면 그 회복량의 ${pc(TX.beaconRing)}가 봉화 대상과 붙은 아군 모두에게 퍼집니다.`),
    t('waveMarch', '빛의 행진', '빛의 파도를 쓰면 신성한 힘 1칸을 돌려받습니다.')] },
  { lv: 50, theme: '궁극', picks: [
    t('dawnVow', '새벽의 맹세', `20초 동안 빛의 손길이 신성한 힘을 ${TX.dawnVow.gain}칸씩 모으고, 빛의 서약 · 빛의 파도 회복량이 ${pc(TX.dawnVow.heal)} 늘어납니다. 재사용 대기시간은 180초입니다.`, { cd: 180, dur: 20, short: '새벽' }),
    t('endlessLight', '끝없는 빛', `빛의 파도가 신성한 힘을 모두 쓰지 않고 ${TX.endlessLight}칸만 씁니다. 위력은 그대로입니다.`),
    t('allKnight', '모두의 기사', `봉화 몫이 봉화 대상 대신, 봉화 대상과 그 옆 칸 아군 중 체력 비율이 가장 낮은 ${TX.allKnight.n}명에게 ${pc(TX.allKnight.share)}씩 들어갑니다.`)] },
];

/** 직업 → 특성 트리 */
/** 주술사 (79 2-7): A 탱커 · 한 사람, B 효율, C 넓게 */
export const SHAMAN_TALENTS: TalentTier[] = [
  { lv: 5, theme: '기본 강화', picks: [
    t('quickRipple', '빠른 잔물결', `잔물결 시전 시간이 ${TX.quickRipple}초 줄어듭니다.`),
    t('calmShower', '잔잔한 물결', `잔물결의 마나 소모가 ${pc(TX.calmShower)} 줄어듭니다.`),
    t('splitDrop', '갈라지는 물방울', `물방울을 걸면 붙어 있는 다친 아군 1명에게도 ${pc(TX.splitDrop)} 위력의 물방울이 걸립니다.`)] },
  { lv: 10, theme: '기본 강화', picks: [
    t('stoneDrop', '돌 물방울', `물방울이 걸린 아군이 받는 피해가 ${pc(TX.stoneDrop)} 줄어듭니다.`),
    t('rippleChain', '잔물결 이음', `잔물결로 물방울이 걸린 대상을 치유하면 물방울 시간이 ${TX.rippleChain}초 늘어납니다 (회복량도 그만큼).`),
    t('sprayShower', '흩뿌리는 물결', `잔물결이 처음 튄 아군 말고 붙어 있는 다친 아군 1명에게 한 번 더 튑니다 (${pc(TX.sprayShower)}).`)] },
  { lv: 15, theme: '기본 강화', picks: [
    t('rootTotem', '뿌리 내린 토템', `대지 토템이 선 칸의 아군은 받는 피해가 ${pc(TX.rootTotem)} 줄어듭니다 (둘레 6칸은 그대로 15%).`),
    t('dropChain', '물방울 사슬', '연쇄 치유가 물방울이 걸린 아군에게 튈 때는 회복량이 줄지 않습니다.'),
    t('washSpread', '번지는 씻김', '씻김으로 디버프를 지우면 붙어 있는 아군 1명의 같은 종류 디버프도 1개 지웁니다.')] },
  { lv: 20, theme: '토템', picks: [
    t('keeperSpring', '샘지기', '샘 토템이 선 칸의 아군은 샘 토템 회복을 두 배로 받습니다.'),
    t('springBreath', '샘의 숨', `샘 토템 마나 소모가 4%에서 ${TX.springBreath.cost}%로 줄어듭니다.`),
    t('twinSpring', '두 개의 샘', '샘 토템을 2개까지 세울 수 있습니다. 세 번째를 세우면 가장 오래된 것이 사라집니다.')] },
  { lv: 25, theme: '토템', picks: [
    t('waterShield', '물의 방패', `샘 토템이 체력이 가득 찬 아군을 회복하면 그만큼 보호막을 씌웁니다 (최대 {${TX.waterShield.max}}, ${TX.waterShield.sec}초).`),
    t('totemCall', '토템 부르기', `판 위의 내 샘 · 대지 토템을 고른 칸으로 옮깁니다. 남은 시간은 그대로입니다. 재사용 대기시간은 ${TX.totemCall.cd}초입니다.`, { cd: TX.totemCall.cd, dur: 0, cell: true, short: '부르기' }),
    t('freshSpring', '넓은 샘', `샘 토템이 ${TX.freshSpring.range}칸 거리까지 닿고, 회복량은 ${pc(TX.freshSpring.heal)} 줄어듭니다.`)] },
  { lv: 30, theme: '생존', picks: [
    t('earthGrace', '대지의 품', `내가 샘 토템이나 대지 토템 범위 안에 있으면 받는 피해가 ${pc(TX.earthGrace)} 줄어듭니다.`),
    t('letFlow', '흘려보내기', `내 체력이 ${pc(TX.letFlow.hp)} 아래로 내려가면 나에게 물방울이 저절로 걸리고 바로 한 번 회복합니다. 재발동 대기 ${TX.letFlow.cd}초.`),
    t('springSelf', '나를 지키는 샘', `내가 죽을 피해를 받으면 판 위의 샘 토템이 깨지고 대신 체력 ${pc(TX.springSelf.hp)}로 버팁니다. 전투마다 1회.`)] },
  { lv: 35, theme: '위기 대응', picks: [
    t('rapids', '급류', `체력 ${pc(TX.rapids.hp)} 아래 대상에게 하는 잔물결이 ${pc(TX.rapids.heal)} 더 회복합니다.`),
    t('alertTotem', '경계하는 토템', `광역 예고가 뜨면 샘 토템이 바로 한 번 회복합니다. 재발동 대기 ${TX.alertTotem.cd}초.`),
    t('lastSpring', '마지막 샘', `파티원이 쓰러지면 그 칸에 마나 없이 샘 토템이 섭니다 (지금 샘 토템은 사라짐). 재발동 대기 ${TX.lastSpring.cd}초.`)] },
  { lv: 40, theme: '범위 운영', picks: [
    t('returnChain', '되돌아오는 사슬', `연쇄 치유가 끝나면 첫 대상에게 ${pc(TX.returnChain)} 위력으로 한 번 더 돌아옵니다.`),
    t('overflowChain', '넘치는 사슬', '연쇄 치유로 넘친 회복량이 다음에 튀는 대상의 회복량에 더해집니다.'),
    t('longChain', '긴 사슬', `연쇄 치유가 ${TX.longChain.n}명까지 닿고, 마나 소모가 ${SKILLS.chainHeal.cost}%에서 ${SKILLS.chainHeal.cost + TX.longChain.cost}%로 늘어납니다.`)] },
  { lv: 45, theme: '대규모 운영', picks: [
    t('twinEarth', '두 대지', '대지 토템을 2번까지 모아 둘 수 있고, 판 위에 2개까지 섭니다.'),
    t('rainBreath', '비의 숨', `비구름 토템이 떠 있는 동안 내 마나 소모가 ${pc(TX.rainBreath)} 줄어듭니다.`),
    t('stormChain', '폭풍 사슬', '비구름 토템이 떠 있는 동안 연쇄 치유가 바로 시전됩니다.')] },
  { lv: 50, theme: '궁극', picks: [
    t('waterSpirit', '물의 정령', `${TX.waterSpirit.dur}초 동안 잔물결이 연쇄 치유처럼 붙어 있는 다친 아군 ${TX.waterSpirit.n}명에게 튑니다 (${TX.waterSpirit.share.map(pc).join(' · ')}). 재사용 대기시간은 ${TX.waterSpirit.cd}초입니다.`, { cd: TX.waterSpirit.cd, dur: TX.waterSpirit.dur, short: '정령' }),
    t('endlessChain', '끝없는 사슬', `연쇄 치유가 튈 때 줄어드는 몫이 25%에서 ${pc(1 - TX.endlessChain)}로 줄어듭니다.`),
    t('seaSeat', '바다의 자리', `빈 칸을 골라 ${TX.seaSeat.dur}초 동안 큰 샘을 엽니다. ${TX.seaSeat.range}칸 거리 안 아군을 ${TX.seaSeat.tick}초마다 {${TX.seaSeat.amt}}씩 회복하고, 깨지지 않습니다. 재사용 대기시간은 ${TX.seaSeat.cd}초입니다.`, { cd: TX.seaSeat.cd, dur: TX.seaSeat.dur, cell: true, short: '바다' })] },
];

/** 수도사 (79 3-7): A 탱커 · 한 사람, B 효율, C 넓게 */
export const MONK_TALENTS: TalentTier[] = [
  { lv: 5, theme: '기본 강화', picks: [
    t('heavyPalm', '묵직한 손바닥', `탱커에게 하는 생기 손바닥이 ${pc(TX.heavyPalm)} 늘어납니다.`),
    t('lightPalm', '가벼운 손바닥', `생기 손바닥의 마나 소모가 ${pc(TX.lightPalm)} 줄어듭니다.`),
    t('palmSplash', '튀는 손바닥', `생기 손바닥 회복량의 ${pc(TX.palmSplash)}가 붙어 있는 가장 다친 아군 1명에게 들어갑니다.`)] },
  { lv: 10, theme: '기본 강화', picks: [
    t('embrace', '품어 주기', `안개 감싸기를 받은 대상은 ${TX.embrace.sec}초 동안 받는 피해가 ${pc(TX.embrace.cut)} 줄어듭니다.`),
    t('mistThrift', '아끼는 안개', `떠도는 안개 마나 소모가 2%에서 ${TX.mistThrift.cost}%로 줄어듭니다.`),
    t('chiWave', '기의 물결', `맑은 기운으로 디버프를 지우면 대상과 붙어 있는 6칸의 아군 체력을 {${TX.chiWave.amt}}씩 회복합니다.`)] },
  { lv: 15, theme: '기본 강화', picks: [
    t('stayMist', '머무는 안개', `떠도는 안개가 옮겨 가지 않고, 대신 회복량이 ${pc(TX.stayMist)} 늘어납니다.`),
    t('longMist', '긴 안개', `떠도는 안개 시간이 ${TX.longMist}초 늘어납니다 (회복량도 그만큼).`),
    t('farMist', '멀리 가는 안개', `떠도는 안개가 ${TX.farMist.range}칸 거리까지 옮겨 가고, 옮겨 갈 때마다 다음 회복이 ${pc(TX.farMist.step)} 늘어납니다.`)] },
  { lv: 20, theme: '기 리듬', picks: [
    t('focusBeat', '한 점 리듬', `같은 대상에게 이어 친 생기 손바닥은 리듬마다 6% 대신 ${pc(TX.focusBeat)} 늘어납니다.`),
    t('wideBeat', '느슨한 박자', `기 리듬이 이어지는 시간이 2.5초에서 ${TX.wideBeat}초로 늘어납니다.`),
    t('sevenBeat', '일곱 박자', `기 리듬이 ${TX.sevenBeat}까지 오릅니다.`)] },
  { lv: 25, theme: '기 리듬', picks: [
    t('steadyMind', '흔들림 없는 마음', '리듬이 끊겨도 0이 아니라 절반 (내림)으로 내려갑니다.'),
    t('thousandHands', '천 개의 손', `${TX.thousandHands.dur}초 동안 생기 손바닥의 다음 행동 대기가 ${TX.thousandHands.gcd}초가 되고 리듬이 내려가지 않습니다. 재사용 대기시간은 ${TX.thousandHands.cd}초입니다.`, { cd: TX.thousandHands.cd, dur: TX.thousandHands.dur, short: '천손' }),
    t('beatSpread', '퍼지는 박자', `리듬 ${TX.beatSpread.at} 이상에서 친 생기 손바닥은 붙어 있는 다친 아군 ${TX.beatSpread.n}명에게도 ${pc(TX.beatSpread.share)}씩 들어갑니다.`)] },
  { lv: 30, theme: '생존', picks: [
    t('ironBody', '강철 몸', `기 리듬 1마다 내가 받는 피해가 ${pc(TX.ironBody.step)} 줄어듭니다 (최대 ${pc(TX.ironBody.max)}).`),
    t('mistBody', '안개 몸', `내 체력이 ${pc(TX.mistBody.hp)} 아래로 내려가면 나에게 떠도는 안개가 걸리고 ${TX.mistBody.sec}초 동안 받는 피해가 ${pc(TX.mistBody.cut)} 줄어듭니다. 재발동 대기 ${TX.mistBody.cd}초.`),
    t('windAgain', '다시 부는 바람', `내가 죽을 피해를 받으면 대신 체력 ${pc(TX.windAgain.hp)}로 버팁니다. 전투마다 1회.`)] },
  { lv: 35, theme: '위기 대응', picks: [
    t('urgentPalm', '급한 손바닥', `체력 ${pc(TX.urgentPalm.hp)} 아래 대상에게 하는 생기 손바닥이 ${pc(TX.urgentPalm.heal)} 늘어납니다.`),
    t('crisisBreath', '위기의 숨결', `광역 예고가 뜨면 안개 숨결 재사용 대기가 바로 끝납니다. 재발동 대기 ${TX.crisisBreath.cd}초.`),
    t('scatterMist', '흩어지는 안개', `파티원이 쓰러지면 그 칸과 붙어 있는 아군 ${TX.scatterMist.n}명에게 ${TX.scatterMist.sec}초짜리 안개가 걸립니다.`)] },
  { lv: 40, theme: '범위 운영', picks: [
    t('mistPillar', '안개 기둥', '안개 숨결의 가운데 대상은 두 배로 회복합니다.'),
    t('thriftBreath', '아끼는 숨결', `안개 숨결 마나 소모가 10%에서 ${TX.thriftBreath.cost}%로 줄어듭니다.`),
    t('gatherMist', '모이는 안개', `빈 칸을 골라 ${TX.gatherMist.dur}초 동안 안개 샘을 엽니다. 그 칸과 붙어 있는 6칸의 아군이 초당 {${TX.gatherMist.hps}}씩 회복하고, 안개가 걸린 것으로 칩니다. 재사용 대기시간은 ${TX.gatherMist.cd}초입니다.`, { cd: TX.gatherMist.cd, dur: TX.gatherMist.dur, cell: true, short: '안개샘' })] },
  { lv: 45, theme: '대규모 운영', picks: [
    t('windKnot', '바람 매듭', '되살림 바람이 탱커에게는 두 배로 회복합니다.'),
    t('calmWind', '잔잔한 바람', `되살림 바람을 쓰면 ${TX.calmWind.sec}초 동안 마나 소모가 ${pc(TX.calmWind.cost)} 줄어듭니다.`),
    t('mistPath', '안개 길', `되살림 바람이 안개가 없는 아군 모두에게 ${TX.mistPath.sec}초짜리 안개를 겁니다.`)] },
  { lv: 50, theme: '궁극', picks: [
    t('chiBurst', '기 폭발', `고른 칸 중심 ${TX.chiBurst.range}칸 거리 안 아군 체력을 {${TX.chiBurst.amt}}씩 회복합니다. 기 리듬 1마다 ${pc(TX.chiBurst.step)} 더 회복하고, 리듬은 0이 됩니다. 재사용 대기시간은 ${TX.chiBurst.cd}초입니다.`, { cd: TX.chiBurst.cd, dur: 0, cell: true, short: '기폭발' }),
    t('endlessBeat', '끝없는 박자', `기 리듬이 ${TX.endlessBeat.at} 이상인 동안 생기 손바닥 마나 소모가 ${pc(TX.endlessBeat.cost)} 줄어듭니다.`),
    t('mistStorm', '안개 폭풍', `${TX.mistStorm.dur}초 동안 떠도는 안개가 ${TX.mistStorm.tick}초마다 회복합니다 (한 번 회복량은 그대로). 재사용 대기시간은 ${TX.mistStorm.cd}초입니다.`, { cd: TX.mistStorm.cd, dur: TX.mistStorm.dur, short: '폭풍' })] },
];

/** 점성술사 (79 4-7): A 한 사람 · 북극성, B 모으기 · 조각, C 넓게 */
export const ASTRO_TALENTS: TalentTier[] = [
  { lv: 5, theme: '기본 강화', picks: [
    t('brightStar', '밝은 별', `별빛 치유 시전 시간이 ${TX.brightStar}초 줄어듭니다.`),
    t('smallTwinkle', '작은 반짝임', `반짝임의 마나 소모가 ${pc(TX.smallTwinkle)} 줄어듭니다.`),
    t('scatterTwinkle', '흩어지는 반짝임', `반짝임 회복량의 ${pc(TX.scatterTwinkle)}가 붙어 있는 가장 다친 아군 1명에게 들어갑니다.`)] },
  { lv: 10, theme: '기본 강화', picks: [
    t('etchedMark', '새긴 표식', `표식 보너스가 50%에서 ${pc(TX.etchedMark)}로 늘어납니다.`),
    t('markBreath', '표식의 숨', `표식 보너스를 쓰면 마나를 ${TX.markBreath.mana}% 돌려받습니다.`),
    t('linkedMark', '이어진 표식', `표식을 걸면 붙어 있는 다친 아군 ${TX.linkedMark.n}명에게도 표식이 걸립니다.`)] },
  { lv: 15, theme: '기본 강화', picks: [
    t('brightPolaris', '빛나는 북극성', `체력 ${pc(TX.brightPolaris.hp)} 아래 대상에게 하는 북극성이 ${pc(TX.brightPolaris.heal)} 늘어납니다.`),
    t('quickLink', '빠른 잇기', `별비 · 북극성 · 별의 기억 시전 시간이 ${TX.quickLink}초 줄어듭니다.`),
    t('clearNight', '맑은 밤', `별비 별 2 · 3개 범위가 ${TX.clearNight.range}칸 거리로 넓어지고, 회복량은 ${pc(-TX.clearNight.heal)} 줄어듭니다.`)] },
  { lv: 20, theme: '별자리', picks: [
    t('onePoint', '한 점', `탱커에게 하는 북극성이 ${pc(TX.onePoint)} 늘어납니다.`),
    t('threeShards', '넉넉한 조각', `반짝임이 별 조각을 ${TX.threeShards}개 줍니다.`),
    t('fifthStar', '다섯째 별', `별 조각을 ${TX.fifthStar.max - 1}개까지 모아 별이 ${TX.fifthStar.max}개까지 이어집니다. 별 5개 별비는 2칸 거리 안 {${TX.fifthStar.fall}}씩, 북극성은 {${TX.fifthStar.polaris}}입니다.`)] },
  { lv: 25, theme: '별자리', picks: [
    t('risingPolaris', '떠오르는 북극성', `가득 찬 북극성은 재사용 대기가 ${TX.risingPolaris}초 줄어듭니다.`),
    t('fallingNight', '내리는 밤', `${TX.fallingNight.dur}초 동안 별비 · 북극성 · 별의 기억이 바로 시전됩니다. 재사용 대기시간은 ${TX.fallingNight.cd}초입니다.`, { cd: TX.fallingNight.cd, dur: TX.fallingNight.dur, short: '밤' }),
    t('secondStarfall', '두 번째 별비', `가득 찬 별비는 ${TX.secondStarfall.delay}초 뒤 같은 자리에 ${pc(TX.secondStarfall.share)} 위력으로 한 번 더 쏟아집니다.`)] },
  { lv: 30, theme: '생존', picks: [
    t('unfading', '지지 않는 별', `내가 죽을 피해를 받으면 대신 나에게 별의 잠이 걸립니다 (${TX.unfading.sec}초, 그동안 행동은 됨). 전투마다 1회.`),
    t('calmHands', '차분한 손', `시전하는 동안 내가 받는 피해가 ${pc(TX.calmHands)} 줄어듭니다.`),
    t('starCrowd', '별 무리', `별 조각 1개마다 내가 받는 피해가 ${pc(TX.starCrowd)} 줄어듭니다.`)] },
  { lv: 35, theme: '위기 대응', picks: [
    t('prophecy', '예언', `탱커 버스터 예고가 뜨면 그 탱커에게 표식이 저절로 걸립니다. 재발동 대기 ${TX.prophecy.cd}초.`),
    t('foreseen', '내다본 손', `광역 예고가 뜨면 별 조각을 ${TX.foreseen.n}개 바로 얻습니다. 재발동 대기 ${TX.foreseen.cd}초.`),
    t('fallingStar', '떨어지는 별', `파티원 체력이 ${pc(TX.fallingStar.hp)} 아래로 떨어지면 반짝임 재사용 대기가 바로 끝납니다. 재발동 대기 ${TX.fallingStar.cd}초.`)] },
  { lv: 40, theme: '범위 운영', picks: [
    t('gatherLight', '모이는 빛', '별 3개 별비는 가운데 대상에게 두 배로 회복합니다.'),
    t('thriftFall', '아끼는 별비', `별비 마나 소모가 ${SKILLS.starfall.cost}%에서 ${TX.thriftFall.cost}%로 줄어듭니다.`),
    t('wideSky', '넓은 하늘', `별 4개 별비가 ${TX.wideSky.range}칸 거리까지 닿고, 회복량은 ${pc(-TX.wideSky.heal)} 줄어듭니다.`)] },
  { lv: 45, theme: '대규모 운영', picks: [
    t('tankMemory', '탱커의 기억', `별의 기억이 탱커에게는 받은 피해의 ${pc(TX.tankMemory)}를 회복합니다.`),
    t('thriftMemory', '아끼는 기억', `별의 기억 마나 소모가 15%에서 ${TX.thriftMemory.cost}%로 줄어듭니다.`),
    t('longMemory', '긴 기억', `별의 기억이 별 1개마다 ${TX.longMemory}초씩 되감습니다 (원래 2초).`)] },
  { lv: 50, theme: '궁극', picks: [
    t('supernova', '초신성', `빈 칸을 골라 별을 심습니다. ${TX.supernova.delay}초 뒤 터져 ${TX.supernova.range}칸 거리 안 아군 체력을 {${TX.supernova.amt}}씩 회복합니다. 재사용 대기시간은 ${TX.supernova.cd}초입니다.`, { cd: TX.supernova.cd, dur: 0, cell: true, short: '초신성' }),
    t('starPath', '별의 길', '가득 찬 별자리를 터뜨리면 다음 별자리는 조각이 없어도 가득 찬 별자리가 됩니다.'),
    t('milkyWay', '은하수', `${TX.milkyWay.dur}초 동안 별빛 치유가 바로 시전되고 별 조각을 ${TX.milkyWay.shards}개씩 줍니다. 재사용 대기시간은 ${TX.milkyWay.cd}초입니다.`, { cd: TX.milkyWay.cd, dur: TX.milkyWay.dur, short: '은하수' })] },
];

/** 결계사 (79 5-7): A 탱커 · 한 사람, B 효율 · 심판, C 넓게 */
export const WARDER_TALENTS: TalentTier[] = [
  { lv: 5, theme: '기본 강화', picks: [
    t('thickBarrier', '두꺼운 막', `탱커에게 씌우는 빛의 막이 ${pc(TX.thickBarrier)} 두꺼워집니다.`),
    t('lightSeal', '가벼운 인장', `인장 치유의 마나 소모가 ${pc(TX.lightSeal)} 줄어듭니다.`),
    t('splitBarrier', '갈라지는 막', `빛의 막을 씌우면 붙어 있는 아군 1명에게도 ${pc(TX.splitBarrier)} 두께의 막과 인장이 붙습니다.`)] },
  { lv: 10, theme: '기본 강화', picks: [
    t('lightOnBarrier', '막 위의 빛', `보호막이 있는 대상에게 하는 직접 힐이 ${pc(TX.lightOnBarrier)} 늘어납니다.`),
    t('longSeal', '긴 인장', `인장 시간이 15초에서 ${TX.longSeal}초로 늘어납니다.`),
    t('cleanWard', '맑은 결계', `결계 정화로 디버프를 지우면 대상과 붙어 있는 6칸의 아군에게 {${TX.cleanWard.amt}} 보호막을 씌웁니다.`)] },
  { lv: 15, theme: '기본 강화', picks: [
    t('firmWard', '굳은 결계', `수호 결계 보호막이 대상 최대 체력의 ${pc(TX.firmWard)}가 됩니다 (원래 30%).`),
    t('quickBarrier', '빠른 막', `빛의 막 재사용 대기가 6초에서 ${TX.quickBarrier}초로 줄어듭니다.`),
    t('sealSpread', '번지는 인장', `인장 치유가 붙어 있는 아군 ${TX.sealSpread.n}명에게도 인장을 붙입니다.`)] },
  { lv: 20, theme: '심판', picks: [
    t('heavyJudge', '무거운 심판', '심판이 체력이 가장 낮은 1명에게는 두 배로 회복합니다.'),
    t('quickJudge', '빠른 심판', `심판 시전 시간이 2.0초에서 ${TX.quickJudge}초로 줄어듭니다.`),
    t('wideJudge', '넓은 심판', `심판이 ${TX.wideJudge}명까지 회복합니다.`)] },
  { lv: 25, theme: '심판', picks: [
    t('judgeHammer', '심판의 망치', `${TX.judgeHammer.dur}초 동안 심판이 바로 시전됩니다. 재사용 대기시간은 ${TX.judgeHammer.cd}초입니다.`, { cd: TX.judgeHammer.cd, dur: TX.judgeHammer.dur, short: '망치' }),
    t('sealEcho', '인장의 메아리', '심판으로 회복한 아군의 인장 시간이 처음으로 돌아갑니다.'),
    t('freshSeal', '새 인장', `인장이 없던 아군에게 인장을 붙이면 체력을 {${TX.freshSeal.amt}} 회복합니다.`)] },
  { lv: 30, theme: '생존', picks: [
    t('selfBarrier', '나를 위한 막', `전투 시작과 ${TX.selfBarrier.every}초마다 나에게 {${TX.selfBarrier.amt}} 보호막을 씌웁니다.`),
    t('barrierBreath', '막의 숨', `나에게 보호막이 있으면 마나 재생이 ${pc(TX.barrierBreath)} 늘어납니다.`),
    t('sharedBurden', '나눠 지는 짐', `판 위에 내 보호막이 있는 아군 1명마다 내가 받는 피해가 ${pc(TX.sharedBurden.step)} 줄어듭니다 (최대 ${pc(TX.sharedBurden.max)}).`)] },
  { lv: 35, theme: '위기 대응', picks: [
    t('stepIn', '막아서기', `체력이 ${pc(TX.stepIn.hp)} 아래로 떨어진 아군에게 {${TX.stepIn.amt}} 보호막을 저절로 씌웁니다. 재발동 대기 ${TX.stepIn.cd}초.`),
    t('preWard', '미리 친 결계', `광역 예고가 뜨면 결계 원 재사용 대기가 바로 끝납니다. 재발동 대기 ${TX.preWard.cd}초.`),
    t('lastWard', '마지막 결계', `파티원이 쓰러지면 붙어 있는 아군 모두에게 {${TX.lastWard.amt}} 보호막을 씌웁니다. 재발동 대기 ${TX.lastWard.cd}초.`)] },
  { lv: 40, theme: '범위 운영', picks: [
    t('doubleCircle', '두 겹 원', '결계 원의 가운데 대상은 두 배 두께의 막을 받습니다.'),
    t('thriftCircle', '아끼는 원', `결계 원 마나 소모가 10%에서 ${TX.thriftCircle.cost}%로 줄어듭니다.`),
    t('wideWard', '넓은 결계', `결계 원이 ${TX.wideWard.range}칸 거리 (20인 레이드 ${TX.wideWard.range + WARDER.big.circle}칸)까지 닿고, 막 두께는 ${pc(-TX.wideWard.amt)} 줄어듭니다.`)] },
  { lv: 45, theme: '대규모 운영', picks: [
    t('veilTank', '장막의 탱커', `빛의 장막 보호막이 탱커에게는 ${TX.veilTank}배로 씌워집니다.`),
    t('veilBreath', '장막의 숨', `빛의 장막을 쓰고 ${WARDER.veil.after}초 동안 내 마나 재생이 두 배가 됩니다.`),
    t('sharedLoad', '함께 드는 짐', `빛의 장막을 쓰고 ${WARDER.veil.after}초 안에 외치는 첫 심판은 인원 제한 없이 인장이 붙은 다친 아군 모두를 회복합니다.`)] },
  { lv: 50, theme: '궁극', picks: [
    t('citadel', '성채', `빈 칸을 골라 ${TX.citadel.dur}초 동안 성채를 세웁니다. ${TX.citadel.range}칸 거리 안 아군이 받는 피해가 ${pc(TX.citadel.cut)} 줄고, ${TX.citadel.tick}초마다 {${TX.citadel.amt}} 보호막을 받습니다. 재사용 대기시간은 ${TX.citadel.cd}초입니다.`, { cd: TX.citadel.cd, dur: TX.citadel.dur, cell: true, short: '성채' }),
    t('repentTime', '주고받는 막', '막 옮기기로 보호막을 거둔 아군은 거둔 양만큼 체력을 회복합니다.'),
    t('endlessJudge', '끝없는 심판', `${TX.endlessJudge.dur}초 동안 심판이 마나를 쓰지 않고 ${TX.endlessJudge.cast.toFixed(1)}초 만에 시전됩니다. 재사용 대기시간은 ${TX.endlessJudge.cd}초입니다.`, { cd: TX.endlessJudge.cd, dur: TX.endlessJudge.dur, short: '끝없는' })] },
];

/** 79 직업 4종은 직업 PR마다 트리를 넣음 (그전엔 특성 없음) */
export const TALENT_TREES: Record<HeroKey, TalentTier[]> = { priest: TALENTS, druid: DRUID_TALENTS, paladin: PALADIN_TALENTS, shaman: SHAMAN_TALENTS, monk: MONK_TALENTS, astrologer: ASTRO_TALENTS, warder: WARDER_TALENTS };
const ALL_TREES = Object.values(TALENT_TREES);

export const TALENT_DEF = Object.fromEntries(ALL_TREES.flatMap(tree => tree.flatMap(x => x.picks.map(p => [p.key, p])))) as Record<TalentKey, TalentDef>;
/** 특성 → 그 직업 트리의 단 번호 */
export const TALENT_TIER = Object.fromEntries(ALL_TREES.flatMap(tree => tree.flatMap((x, i) => x.picks.map(p => [p.key, i])))) as Record<TalentKey, number>;
/** 특성 → 직업 */
export const TALENT_HERO = Object.fromEntries((Object.keys(TALENT_TREES) as HeroKey[]).flatMap(h => TALENT_TREES[h].flatMap(x => x.picks.map(p => [p.key, h])))) as Record<TalentKey, HeroKey>;

/** 고른 칸 번호(단마다 0~2, 없으면 null) → 그 레벨에서 켜지는 특성 (직업 트리 기준, 없으면 사제) */
export function talentKeys(picks: (number | null)[] | undefined, level: number, hero: HeroKey = 'priest'): TalentKey[] {
  if (!picks) return [];
  return TALENT_TREES[hero].flatMap((x, i) => (x.lv <= level && picks[i] != null && x.picks[picks[i]!] ? [x.picks[picks[i]!].key] : []));
}

/** 그 레벨에서 열린 특성 단 수 (세 직업 같은 레벨) */
export const openTiers = (level: number): number => TALENTS.filter(x => x.lv <= level).length;
