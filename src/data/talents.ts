/**
 * 특성 트리 (06 6장 사제, 77 드루이드 · 성기사): 직업마다 10단 × 3택1, Lv 5부터 5레벨마다 한 단 (34 2-1, Lv 50 완성). 언제든 무료로 바꿈.
 * 고른 특성은 직업마다 따로 저장 (25 4-1). 효과는 engine/talents.ts. 이름은 오리지널 (14 문서).
 * 세 직업 모두 단 구조 · 열리는 레벨 · 보조 버튼 규칙이 같다 (77 1장). 드루이드 · 성기사 수치는 TX 한 곳에서 (설명 문장도 TX를 씀)
 */
import { FEATURES } from './features';
import type { HeroKey } from './heroes';

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

export type TalentKey = PriestTalentKey | DruidTalentKey | PaladinTalentKey;

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
  { lv: 20, theme: '성언', picks: [t('fullHeart', '충만한 마음', '성언 게이지가 30% 더 빨리 찹니다.'), t('spreadSerenity', '번지는 평온', '성언: 평온이 옆 아군 2명에게도 50% 위력으로 들어갑니다.'), t('echoWord', '말씀의 여운', '성언을 쓴 뒤 5초 동안 마나 소모가 50% 줄어듭니다.')] },
  { lv: 25, theme: '성언', picks: [t('miracle', '기적의 순간', '전투마다 한 번, 두 성언 게이지를 바로 100%로 채웁니다.', { cd: 0, dur: 0, once: true, short: '기적' }), t('savedWord', '아껴 둔 말씀', '성언 게이지를 2회분까지 모아 둘 수 있습니다.'), t('cleansingWord', '씻는 말씀', '성언: 평온이 종류와 상관없이 디버프 1개도 제거합니다.')] },
  { lv: 30, theme: '생존', picks: [t('repay', '은혜 갚기', `내가 죽을 피해를 받으면 호감도가 가장 높은 파티원이 한 번 대신 맞습니다. 그 파티원 체력이 50% 이상일 때, 전투마다 1회 발동합니다. ${FEATURES.guild ? '호감도는 길드원은 함께 출전한 수, 공개모집은 이번 판에 내 힐을 받은 양입니다.' : '호감도는 이번 판에 내 힐을 받은 양입니다.'}`), t('twoGuard', '두 겹 수호', '수호 영혼을 2번까지 모아 둘 수 있습니다. 충전 시간은 120초입니다.'), t('firmWill', '굳은 의지', '내가 받는 피해가 20% 줄어듭니다.')] },
  { lv: 35, theme: '위기 대응', picks: [t('calmHymn', '고요한 찬가', '천상의 찬가 동안 파티원이 겁먹고 도망가지 않고, 장판 회피가 15% 늘어납니다.'), t('shelter', '쉼터', '빈 칸 1개를 20초 동안 쉼터로 만듭니다. 체력이 낮아 도망가는 파티원이 그리로 가고 초당 {30}씩 회복합니다. 재사용 대기시간은 60초입니다.', { cd: 60, dur: 20, cell: true, short: '쉼터' }), t('grief', '슬픔의 힘', '파티원이 쓰러지면 5초 동안 모든 힐이 30% 늘어납니다.')] },
  { lv: 40, theme: '범위 운영', picks: [t('doublePoh', '두 번 퍼지는 기원', '치유의 기원이 2초 뒤 50% 위력으로 한 번 더 퍼집니다.'), t('shareRenew', '나눠 주는 소생', '소생이 옆 아군 1명에게도 함께 걸립니다.'), t('quickHymn', '빨라진 찬가', '천상의 찬가 재사용 대기시간이 60초 줄어듭니다.')] },
  { lv: 45, theme: '대규모 운영', picks: [t('twoShields', '두 방패의 끈', '탱커 2명을 이어, 한쪽에 한 직접 힐의 30%가 다른 쪽에도 들어갑니다.'), t('focusOne', '한 사람만 본다', '같은 대상을 이어서 치유하면 한 번마다 10%씩, 최대 50%까지 늘어납니다.'), t('hymnTail', '찬가의 끝자락', '천상의 찬가가 끝나면 전원에게 6초 동안 {120} 회복하는 지속 힐을 겁니다.')] },
  { lv: 50, theme: '궁극', picks: [t('zenith', '기도의 정점', '20초 동안 모든 시전이 즉시 끝나지만 마나 소모가 1.5배가 됩니다. 재사용 대기시간은 180초입니다.', { cd: 180, dur: 20, short: '정점' }), t('scatter', '흩날리는 빛', '30초 동안 모든 직접 힐이 옆 2칸에 40%씩 튑니다. 재사용 대기시간은 180초입니다.', { cd: 180, dur: 30, short: '흩빛' }), t('endless', '끊이지 않는 말씀', '게이지 50%에서도 위력 50%의 약한 성언을 쓸 수 있습니다.')] },
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
  /** 무거운 일격: 잃은 체력 1%마다 +, 최대 */
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
  /** 새벽의 맹세: 빛의 손길 · 빛 일격이 모으는 신성한 힘, 그동안 빛의 서약 · 빛의 파도 회복량 + */
  dawnVow: { gain: 2, heal: 0.3 },
  /** 끝없는 빛: 빛의 파도가 쓰는 신성한 힘 (평소 3칸 모두) */
  endlessLight: 2,
  /** 모두의 기사: 봉화 몫을 봉화 대상과 그 옆에서 가장 다친 n명에게 이 비율씩 */
  allKnight: { n: 3, share: 0.7 },
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
    t('colonyAll', '번지는 군락', `군락 보너스가 붙은 칸마다 ${pc(0.1 + TX.colonyAll)}로 늘고 생장 · 들꽃 군락의 지속 힐에도 붙습니다. 5인 이하 파티에서는 옆에 새싹이 없어도 1칸은 붙은 것으로 칩니다.`),
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
    t('heavyStrike', '무거운 일격', `빛 일격이 대상이 잃은 체력 1%마다 ${TX.heavyStrike.per}%씩, 최대 ${pc(TX.heavyStrike.max)} 더 회복합니다.`),
    t('steadyHeart', '곧은 마음', `봉화 대상에게 직접 쓰는 빛의 손길 · 빛 일격은 마나 소모가 ${pc(TX.steadyHeart)} 줄어듭니다.`),
    t('twinHands', '두 손의 빛', `빛의 손길 회복량의 ${pc(TX.twinHands)}가 대상 옆 칸에서 체력이 가장 낮은 아군 1명에게도 들어갑니다.`)] },
  { lv: 15, theme: '기본 강화', picks: [
    t('guardOath', '굳은 서약', `빛의 서약이 걸린 아군이 받는 피해가 ${pc(TX.guardOath)} 줄어듭니다.`),
    t('calmBreath', '고른 호흡', `모아 둔 신성한 힘 1칸마다 마나 재생이 ${pc(TX.calmBreath)} 늘어납니다.`),
    t('waveEcho', '파도의 여운', `빛의 파도로 회복한 아군에게 ${TX.waveEcho.sec}초 동안 {${TX.waveEcho.amt}} 회복하는 지속 힐을 겁니다.`)] },
  { lv: 20, theme: '봉화', picks: [
    t('beaconWeight', '빛의 무게', `봉화 대상이 받는 피해가 ${pc(TX.beaconWeight)} 줄어듭니다.`),
    t('beaconBreath', '봉화의 숨', `빛의 손길 · 빛 일격의 봉화 몫이 들어갈 때마다 마나를 ${TX.beaconBreath.mana}% 돌려받습니다.`),
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
    t('dawnVow', '새벽의 맹세', `20초 동안 빛의 손길 · 빛 일격이 신성한 힘을 ${TX.dawnVow.gain}칸씩 모으고, 빛의 서약 · 빛의 파도 회복량이 ${pc(TX.dawnVow.heal)} 늘어납니다. 재사용 대기시간은 180초입니다.`, { cd: 180, dur: 20, short: '새벽' }),
    t('endlessLight', '끝없는 빛', `빛의 파도가 신성한 힘을 모두 쓰지 않고 ${TX.endlessLight}칸만 씁니다. 위력은 그대로입니다.`),
    t('allKnight', '모두의 기사', `봉화 몫이 봉화 대상 대신, 봉화 대상과 그 옆 칸 아군 중 체력 비율이 가장 낮은 ${TX.allKnight.n}명에게 ${pc(TX.allKnight.share)}씩 들어갑니다.`)] },
];

/** 직업 → 특성 트리 */
/** 79 직업 4종은 직업 PR마다 트리를 넣음 (그전엔 특성 없음) */
export const TALENT_TREES: Record<HeroKey, TalentTier[]> = { priest: TALENTS, druid: DRUID_TALENTS, paladin: PALADIN_TALENTS, shaman: [], monk: [], astrologer: [], warder: [] };
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
