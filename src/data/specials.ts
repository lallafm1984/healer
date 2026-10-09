/**
 * 장비 특수능력 118종 (42 v0.1, Lim 2026-10-09 「장신구 및 장비에서 더 다양한 특수능력 100여 종」) + 이름 있는 장신구 (42 3장).
 * 장비 한 줄 = { key, roll }. 값 = 영웅 최대값 × 등급 배율 (data/equipment GRADE_MULT) × 굴림 (60~100%), fixed면 굴리지 않음.
 * 같은 특수능력이 여러 장비에 있으면 더함 (cap까지), 재사용 대기(cd)가 있는 발동은 가장 좋은 것 하나만 (42 1-3).
 * 효과는 engine/specials.ts가 엔진 훅에 붙임. ready = 엔진에 붙어서 드롭에 나와도 되는 것.
 */
import { GRADE_MULT, type ItemGrade, type SlotKey } from './equipment';
import type { HeroKey } from './heroes';

export type SpecGroup = 'heal' | 'proc' | 'guard' | 'mana' | 'dispel' | 'cd' | 'ally' | 'gimmick' | 'hero';
/** 묶음 (42 2장) · 묶음 표식 그림 키 (36 I spec-*) */
export const SPEC_GROUPS: Record<SpecGroup, { name: string; icon: string }> = {
  heal: { name: '치유', icon: 'spec-heal' },
  proc: { name: '발동', icon: 'spec-proc' },
  guard: { name: '보호', icon: 'spec-guard' },
  mana: { name: '마나', icon: 'spec-mana' },
  dispel: { name: '해제', icon: 'spec-cleanse' },
  cd: { name: '쿨기', icon: 'spec-cd' },
  ally: { name: '지원', icon: 'spec-ally' },
  gimmick: { name: '기믹', icon: 'spec-gimmick' },
  hero: { name: '직업', icon: 'spec-class' },
};

/**
 * 값 표시: pct = 비율 (0.06 → 6%), pp = 퍼센트 포인트 (0.1 → 10%p), sec = 초, mana = 마나 %p (0.6 → 0.6%), n = 칸·횟수 (그대로)
 */
export type SpecUnit = 'pct' | 'pp' | 'sec' | 'mana' | 'n';

export interface SpecDef {
  key: string;
  /** 문서 번호 (42 2장 「치유 01」) */
  no: string;
  name: string;
  group: SpecGroup;
  /** 나오는 부위 */
  slots: readonly SlotKey[];
  /** 최소 등급 (이 등급부터 나옴) */
  min: ItemGrade;
  /** 직업 전용: 그 직업일 때만 켜지고 그 직업으로 돌 때만 나옴 (42 1-5) */
  hero?: HeroKey;
  /** 영웅 최대값 */
  val: number;
  unit: SpecUnit;
  /** 굴리지 않는 값 (등급 배율도 안 곱함) */
  fixed?: boolean;
  /** 같은 특수능력 합 상한 */
  cap?: number;
  /** 재사용 대기 (초): 발동 효과는 겹치지 않고 가장 좋은 것 하나 */
  cd?: number;
  /** 효과 글. {v} = 값 */
  text: string;
}

const ALL: SlotKey[] = ['weapon', 'head', 'chest', 'hands', 'ring', 'neck'];
const W: SlotKey[] = ['weapon'];
const AR: SlotKey[] = ['head', 'chest', 'hands'];
const ACC: SlotKey[] = ['ring', 'neck'];
const W_ACC: SlotKey[] = [...W, ...ACC];
const AR_ACC: SlotKey[] = [...AR, ...ACC];
const HANDS: SlotKey[] = ['hands'];
const HEAD: SlotKey[] = ['head'];
const CHEST: SlotKey[] = ['chest'];
const NECK: SlotKey[] = ['neck'];
const H_W: SlotKey[] = ['hands', 'weapon'];
const H_ACC: SlotKey[] = ['hands', ...ACC];

type Row = [key: string, no: string, name: string, slots: SlotKey[], min: ItemGrade, val: number, unit: SpecUnit, text: string, o?: Partial<SpecDef>];

const TABLE: Record<SpecGroup, Row[]> = {
  // 2-1 치유: 조건이 붙은 회복량
  heal: [
    ['warmTouch', '치유 01', '따스한 손끝', ALL, '고급', 0.06, 'pct', '단일 힐 회복량 +{v}', { cap: 0.3 }],
    ['wideEmbrace', '치유 02', '넓은 품', ALL, '고급', 0.06, 'pct', '광역 힐 회복량 +{v}', { cap: 0.3 }],
    ['lingerLight', '치유 03', '오래 머무는 빛', ALL, '고급', 0.06, 'pct', '지속 힐 회복량 +{v}', { cap: 0.3 }],
    ['shieldFriend', '치유 04', '방패지기의 벗', ALL, '고급', 0.07, 'pct', '탱커에게 하는 힐 +{v}', { cap: 0.3 }],
    ['edgeTouch', '치유 05', '아슬아슬한 손길', W_ACC, '희귀', 0.15, 'pct', '체력 35% 아래 대상에게 하는 직접 힐 +{v}'],
    ['firstWord', '치유 06', '첫 마디', AR, '고급', 0.12, 'pct', '전투 시작 20초 동안 회복량 +{v}'],
    ['secondWind', '치유 07', '뒷심', W, '희귀', 0.08, 'pct', '보스 체력 30% 아래에서 회복량 +{v}'],
    ['regular', '치유 08', '단골 손님', ALL, '희귀', 0.08, 'pct', '같은 대상에게 직접 힐을 이어 하면 두 번째부터 +{v}'],
    ['evenly', '치유 09', '고루고루', ALL, '희귀', 0.06, 'pct', '직접 힐 대상을 매번 바꾸면 +{v}'],
    ['kindCrit', '치유 10', '다정한 치명타', W_ACC, '희귀', 0.12, 'pct', '치명타 치유량 +{v}', { cap: 0.5 }],
    ['bounceLight', '치유 11', '튀는 빛', W, '영웅', 0.3, 'pct', '직접 힐이 치명타면 옆 칸 1명에게 그 힐의 {v}'],
    ['layer', '치유 12', '덧바름', AR, '희귀', 0.08, 'pct', '지속 힐이 걸린 대상에게 하는 직접 힐 +{v}'],
    ['bigBowl', '치유 13', '큰 그릇', AR, '희귀', 0.1, 'pct', '광역 힐이 4명 이상 맞으면 그 힐 +{v}'],
    ['slowHand', '치유 14', '느긋한 손', W, '희귀', 0.08, 'pct', '시전 2초 이상인 힐 회복량 +{v}'],
    ['quickAid', '치유 15', '빠른 응급', H_W, '희귀', 0.06, 'pct', '즉시 시전 힐 회복량 +{v}'],
    ['overflowKind', '치유 16', '넘치는 정', ACC, '영웅', 0.2, 'pct', '과치유의 {v}가 체력이 가장 낮은 파티원에게 옮겨 감'],
  ],
  // 2-2 발동: 확률 · 조건으로 잠깐 세짐
  proc: [
    ['sunHandful', '발동 01', '햇살 한 줌', ALL, '고급', 0.12, 'pct', '힐을 시전하면 8% 확률로 8초 동안 가속 +{v}', { cd: 20 }],
    ['wishStar', '발동 02', '별똥별 소원', ACC, '희귀', 0.08, 'pct', '치명타 힐이 나면 6초 동안 치명타 +{v}', { cd: 15 }],
    ['windStep', '발동 03', '바람 탄 발걸음', HANDS, '영웅', 1, 'n', '즉시 시전 스킬을 3번 이어 쓰면 다음 시전 힐이 즉시', { cd: 12, fixed: true }],
    ['beeDance', '발동 04', '꿀벌의 춤', W, '희귀', 0.4, 'pct', '직접 힐 5번마다 다음 힐 회복량 +{v}'],
    ['rainbow', '발동 05', '무지개 조각', ACC, '고급', 0.1, 'pct', '힐을 시전하면 5% 확률로 10초 동안 회복량 +{v}', { cd: 25 }],
    ['brimming', '발동 06', '기운 넘침', AR, '고급', 0.06, 'pct', '마나 90% 위일 때 회복량 +{v}'],
    ['resolve', '발동 07', '굳센 결의', ACC, '희귀', 0.2, 'pct', '파티원이 쓰러지면 10초 동안 가속 +{v} (전투당 2번)'],
    ['encore', '발동 08', '한 번 더', AR, '희귀', 0.1, 'pct', '공대 쿨기를 쓴 뒤 12초 동안 회복량 +{v}'],
    ['fireflies', '발동 09', '반딧불 무리', ACC, '희귀', 0.25, 'pct', '지속 힐 틱마다 3% 확률로 대상에게 지능 {v} 즉시 회복'],
    ['busyHands', '발동 10', '바쁜 손', HANDS, '희귀', 0.06, 'pct', '힐을 쉬지 않고 시전하면 2초마다 가속이 올라 최대 +{v}, 3초 쉬면 사라짐'],
    ['goldEcho', '발동 11', '금빛 메아리', W, '영웅', 0.4, 'pct', '광역 힐이 치명타면 3초 뒤 같은 자리에 그 힐의 {v} 한 번 더'],
    ['calmRipple', '발동 12', '잔잔한 물결', AR, '희귀', 0.2, 'pct', '10초 동안 힐을 안 받은 파티원에게 하는 첫 힐 +{v}'],
    ['drumbeat', '발동 13', '북소리', HEAD, '희귀', 0.15, 'pct', '보스 큰 기술 예고가 뜨면 4초 동안 가속 +{v}', { cd: 20 }],
    ['sunrise', '발동 14', '해돋이', ACC, '희귀', 0.15, 'pct', '보스 페이즈가 바뀌면 8초 동안 회복량 +{v}'],
    ['braveSong', '발동 15', '용기의 노래', CHEST, '희귀', 0.25, 'pct', '탱커가 체력 30% 아래로 내려가면 5초 동안 탱커에게 하는 힐 +{v}', { cd: 25 }],
    ['constellation', '발동 16', '별자리', W, '영웅', 0.15, 'pct', '서로 다른 스킬 4개를 이어 쓰면 6초 동안 회복량 +{v}'],
  ],
  // 2-3 보호 · 생존
  guard: [
    ['bubble', '보호 01', '비눗방울', ACC, '희귀', 0.3, 'pct', '직접 힐이 과치유되면 넘친 양의 {v}가 보호막 (6초)'],
    ['featherQuilt', '보호 02', '깃털 이불', W_ACC, '희귀', 0.4, 'pct', '체력 25% 아래 대상에게 직접 힐을 하면 지능 {v} 보호막 (대상마다 20초에 한 번)'],
    ['sturdyBack', '보호 03', '든든한 등', AR, '고급', 0.05, 'pct', '지속 힐이 걸린 탱커는 받는 피해 −{v}'],
    ['lastStand', '보호 04', '마지막 버팀', CHEST, '고급', 0.25, 'pct', '내 체력이 40% 아래로 내려가면 8초 동안 받는 피해 −{v} (전투당 1번)'],
    ['holdTogether', '보호 05', '함께 버티기', AR, '희귀', 0.06, 'pct', '광역 힐을 맞은 파티원은 4초 동안 광역 피해 −{v}'],
    ['lastBreath', '보호 06', '마지막 숨', ACC, '영웅', 1, 'n', '파티원이 쓰러질 피해를 받으면 체력 1로 버팀 (전투당 1번)', { fixed: true }],
    ['guardFeather', '보호 07', '수호의 깃', ALL, '희귀', 0.25, 'pct', '생존기 (수호 영혼 · 나무껍질 · 희생) 효과 시간 +{v}'],
    ['warmCloak', '보호 08', '따뜻한 망토', AR, '고급', 0.1, 'pct', '지속 피해 디버프가 걸린 아군에게 하는 힐 +{v}'],
    ['risingLight', '보호 09', '일어서는 빛', ACC, '희귀', 0.2, 'pp', '부활한 파티원 체력 +{v}, 5초 동안 받는 피해 −30%'],
    ['hardShell', '보호 10', '단단한 껍데기', ALL, '고급', 0.15, 'pct', '내가 거는 보호막 +{v}', { cap: 0.45 }],
    ['twinShield', '보호 11', '쌍둥이 방패', W, '영웅', 1, 'n', '생존기를 쓰면 옆 칸 1명에게도 절반 효과', { fixed: true }],
    ['shelterMap', '보호 12', '피난처 지도', HEAD, '희귀', 0.12, 'pct', '장판 예고 칸에 있는 아군에게 하는 힐 +{v}'],
    ['prop', '보호 13', '버팀목', AR, '희귀', 0.05, 'pct', '탱커가 2명이면 체력이 더 낮은 탱커가 받는 피해 −{v}'],
    ['starVeil', '보호 14', '별빛 장막', ACC, '영웅', 0.08, 'pct', '체력 50% 아래 아군이 3명 이상이면 4초 동안 파티 전원 받는 피해 −{v}', { cd: 30 }],
  ],
  // 2-4 마나
  mana: [
    ['springSip', '마나 01', '샘물 한 모금', AR_ACC, '고급', 0.4, 'pct', '마나 30% 아래에서 정신력 +{v}'],
    ['thrifty', '마나 02', '아끼는 손', HANDS, '희귀', 0.2, 'pct', '체력 80% 위 대상에게 하는 힐 마나 소모 −{v}'],
    ['pouch', '마나 03', '알뜰한 주머니', ALL, '고급', 0.08, 'pct', '즉시 시전 스킬 마나 소모 −{v}', { cap: 0.25 }],
    ['insight', '마나 04', '깨달음', W, '희귀', 0.6, 'mana', '치명타 힐이 나면 마나 {v} 회복'],
    ['lightBreath', '마나 05', '가벼운 숨', ACC, '희귀', 0.3, 'mana', '과치유가 그 힐의 절반을 넘으면 마나 {v} 회복 (2초에 한 번)'],
    ['restTea', '마나 06', '휴식의 차', NECK, '고급', 0.5, 'pct', '던전 구간 사이 휴식 마나 회복 +{v}'],
    ['firstCup', '마나 07', '첫 잔', AR, '고급', 0.3, 'pct', '전투 시작 15초 동안 마나 소모 −{v}'],
    ['dusk', '마나 08', '해 질 녘', W, '희귀', 0.2, 'pct', '보스 체력 20% 아래에서 마나 소모 −{v}'],
    ['potionRegular', '마나 09', '물약 단골', ACC, '고급', 0.3, 'pct', '마나 물약 · 명상의 물약 회복량 +{v}'],
    ['stillMoment', '마나 10', '고요한 순간', HEAD, '희귀', 0.8, 'pct', '3초 동안 스킬을 안 쓰면 그동안 정신력 +{v}'],
    ['thankHand', '마나 11', '고마운 손', HANDS, '고급', 0.8, 'mana', '해제를 하면 마나 {v} 회복'],
    ['raidBreath', '마나 12', '공대의 숨결', ACC, '희귀', 0.3, 'pct', '공대 쿨기 마나 소모 −{v}'],
  ],
  // 2-5 해제 · 디버프
  dispel: [
    ['cleanHands', '해제 01', '깨끗한 손', H_ACC, '희귀', 1.5, 'sec', '해제 재사용 −{v}', { cap: 3 }],
    ['brushOff', '해제 02', '털어 내기', ALL, '고급', 0.3, 'pct', '해제한 대상 지능 {v} 회복'],
    ['twiceBrush', '해제 03', '두 번 털기', ACC, '영웅', 0.12, 'pct', '해제가 {v} 확률로 재사용 대기 없이'],
    ['immuneIncense', '해제 04', '면역 향', NECK, '희귀', 4, 'sec', '해제한 대상은 {v} 동안 같은 디버프에 안 걸림'],
    ['fadingMiasma', '해제 05', '줄어드는 독기', AR, '희귀', 0.1, 'pct', '아군에게 걸린 해제 가능 디버프 지속 −{v}'],
    ['trapSense', '해제 06', '함정 감지', HEAD, '희귀', 0.3, 'pct', '지우면 터지는 디버프의 터짐 피해 −{v}'],
    ['coldMedicine', '해제 07', '감기약', AR, '고급', 0.15, 'pct', '질병 디버프 피해 −{v}'],
    ['antidote', '해제 08', '해독초', AR, '고급', 0.15, 'pct', '독 디버프 피해 −{v}'],
    ['spellWard', '해제 09', '마법 막이', AR, '고급', 0.15, 'pct', '마법 디버프 피해 −{v}'],
    ['curseBreak', '해제 10', '저주 풀이', AR, '고급', 0.15, 'pct', '저주 디버프 피해 −{v}'],
  ],
  // 2-6 공대 쿨기 · 재사용
  cd: [
    ['hurryStar', '쿨기 01', '서두르는 별', ACC, '희귀', 0.08, 'pct', '공대 쿨기 재사용 −{v}', { cap: 0.3 }],
    ['longSong', '쿨기 02', '길어진 노래', W, '영웅', 1, 'sec', '공대 쿨기 효과 시간 +{v}', { fixed: true }],
    ['survivalDrill', '쿨기 03', '생존기 단련', ALL, '희귀', 0.1, 'pct', '생존기 재사용 −{v}', { cap: 0.3 }],
    ['strongChorus', '쿨기 04', '강한 합창', AR, '희귀', 0.12, 'pct', '공대 쿨기 회복량 +{v}'],
    ['rewind', '쿨기 05', '되감기', ACC, '희귀', 10, 'sec', '파티원이 쓰러지면 생존기 재사용 −{v} (전투당 2번)'],
    ['crisisSense', '쿨기 06', '위기의 직감', NECK, '영웅', 1, 'n', '파티 평균 체력 40% 아래면 공대 쿨기 재사용이 2배 빨리 돎', { fixed: true }],
    ['busyDay', '쿨기 07', '바쁜 하루', HANDS, '희귀', 2, 'sec', '해제를 하면 생존기 재사용 −{v}'],
    ['starClock', '쿨기 08', '별의 시계', HEAD, '희귀', 3, 'sec', '공대 쿨기를 쓰면 해제 · 생존기 재사용 −{v}'],
  ],
  // 2-7 파티 지원
  ally: [
    ['cheerFlag', '지원 01', '응원 깃발', ACC, '고급', 0.03, 'pct', '체력 90% 위 딜러의 딜 +{v}', { cap: 0.1 }],
    ['heartyMeal', '지원 02', '든든한 밥심', AR, '고급', 0.03, 'pct', '탱커 받는 피해 −{v}', { cap: 0.1 }],
    ['rhythm', '지원 03', '리듬 맞추기', W, '희귀', 0.04, 'pct', '직접 힐을 받은 딜러는 6초 동안 딜 +{v}'],
    ['morale', '지원 04', '사기 진작', ACC, '희귀', 0.04, 'pct', '보스 체력 30% 아래에서 파티 딜 +{v}'],
    ['cutBeat', '지원 05', '끊기 박자', HEAD, '희귀', 0.05, 'pct', '파티원이 보스 시전을 끊으면 6초 동안 보스가 받는 피해 +{v}'],
    ['leadOn', '지원 06', '앞장서기', CHEST, '고급', 0.1, 'pct', '지속 힐이 걸린 탱커의 딜 +{v}'],
    ['march', '지원 07', '신나는 행진', CHEST, '희귀', 0.15, 'pct', '파티원 이동이 {v} 빨라짐 (장판을 더 잘 피함)'],
    ['eliteHunter', '지원 08', '정예 사냥꾼', W, '희귀', 0.08, 'pct', '정예 · 판 위 적에게 주는 파티 딜 +{v}'],
    ['quickPeer', '지원 09', '눈치 빠른 동료', HEAD, '영웅', 0.3, 'sec', '파티원이 장판을 피하는 반응이 {v} 빨라짐', { fixed: true }],
    ['brightMorning', '지원 10', '활기찬 아침', ACC, '고급', 0.06, 'pct', '전투 시작 15초 동안 파티 딜 +{v}'],
  ],
  // 2-8 기믹 대응 (35 3장 부품 하나를 약하게)
  gimmick: [
    ['clearEye', '기믹 01', '맑은 눈', NECK, '영웅', 0.4, 'pct', '뒤집힌 축복으로 들어가는 피해 −{v}'],
    ['numberSense', '기믹 02', '숫자 감각', HEAD, '희귀', 1, 'sec', '차례를 성공하면 보스 멍함 +{v}', { fixed: true }],
    ['chainBreaker', '기믹 03', '사슬 끊는 손', W, '희귀', 0.2, 'pct', '감옥 체력 −{v}'],
    ['bombSquad', '기믹 04', '폭탄 해체반', CHEST, '희귀', 0.2, 'pct', '폭탄 · 자폭 쫄 터짐 피해 −{v}'],
    ['crystalBreak', '기믹 05', '수정 깨기', W, '희귀', 0.2, 'pct', '보호막 수정 · 치유 쫄에게 주는 파티 딜 +{v}'],
    ['heavyFeet', '기믹 06', '무거운 발', AR, '희귀', 0.15, 'pct', '끌려간 아군이 받는 피해 −{v}'],
    ['woundClean', '기믹 07', '상처 소독', AR, '희귀', 0.2, 'pct', '쇠약 중첩 피해 −{v}'],
    ['holdingHand', '기믹 08', '받치는 손', ACC, '영웅', 0.25, 'pct', '받는 치유 감소 디버프 효과 −{v}'],
  ],
  // 2-9 직업 전용 (영웅 이상, 그 직업일 때만)
  hero: [
    ['deepWord', '사제 01', '깊은 성언', W_ACC, '영웅', 0.12, 'pct', '성언 게이지 충전 +{v}', { hero: 'priest' }],
    ['serenityEcho', '사제 02', '평온의 여운', W, '전설', 0.2, 'pct', '성언: 평온 회복량 +{v}, 넘친 양은 4초 지속 힐로', { hero: 'priest' }],
    ['wideSanctify', '사제 03', '넓은 신성화', W, '전설', 1, 'n', '성언: 신성화 범위 +{v}칸', { hero: 'priest', fixed: true }],
    ['quickRenew', '사제 04', '짙은 소생', AR, '영웅', 0.25, 'pct', '소생 회복량 +{v}', { hero: 'priest' }],
    ['pohEcho', '사제 05', '기원의 메아리', ACC, '영웅', 0.5, 'pct', '치유의 기원이 {v} 확률로 2초 뒤 절반 한 번 더', { hero: 'priest' }],
    ['wakeGuard', '사제 06', '깨어 있는 수호', NECK, '영웅', 1, 'pct', '수호 영혼이 발동하면 대상이 지능 {v} 회복', { hero: 'priest' }],
    ['hymnBreath', '사제 07', '찬가의 숨결', ACC, '전설', 3, 'mana', '천상의 찬가 마나 소모 −50%, 끊기지 않고 끝나면 마나 {v} 회복', { hero: 'priest' }],
    ['flashLight', '사제 08', '순간의 빛', HANDS, '영웅', 0.3, 'sec', '순간 치유 시전 −{v}', { hero: 'priest' }],
    ['wideGrove', '드루 01', '넓은 군락', W_ACC, '영웅', 0.05, 'pp', '군락 보너스 칸마다 +{v}', { hero: 'druid' }],
    ['sproutHop', '드루 02', '옮겨 가는 새싹', W, '전설', 1, 'n', '새싹이 끝까지 가면 옆 칸 1명에게 절반 시간 새싹', { hero: 'druid', fixed: true }],
    ['hastyBloom', '드루 03', '서두른 꽃', HANDS, '영웅', 3, 'sec', '피워 내기 재사용 −{v}', { hero: 'druid' }],
    ['flowerSea', '드루 04', '들꽃 바다', W, '전설', 1, 'n', '들꽃 군락 범위 +{v}칸', { hero: 'druid', fixed: true }],
    ['thickBark', '드루 05', '굵은 껍질', AR, '영웅', 0.1, 'pp', '나무껍질 받는 피해 감소 +{v}', { hero: 'druid' }],
    ['dawnDew', '드루 06', '새벽 이슬', HANDS, '영웅', 0.3, 'sec', '생장 시전 −{v}', { hero: 'druid' }],
    ['forestBreath', '드루 07', '숲의 숨결', ACC, '영웅', 1, 'sec', '고요한 숲 효과 시간 +{v}', { hero: 'druid', fixed: true }],
    ['quickRebirth', '드루 08', '빠른 환생', NECK, '영웅', 0.2, 'pp', '환생 시전 −1초, 부활 체력 +{v}', { hero: 'druid' }],
    ['bigBeacon', '성기 01', '큰 봉화', W_ACC, '영웅', 0.1, 'pp', '봉화로 함께 들어가는 몫 +{v}', { hero: 'paladin' }],
    ['secondBeacon', '성기 02', '두 번째 봉화', W, '전설', 1, 'n', '봉화를 2명에게 (두 번째는 절반)', { hero: 'paladin', fixed: true }],
    ['combo', '성기 03', '연타', HANDS, '영웅', 1.5, 'sec', '빛 일격 재사용 −{v}', { hero: 'paladin' }],
    ['firmOath', '성기 04', '단단한 서약', AR, '영웅', 0.15, 'pct', '빛의 서약 회복량 +{v}', { hero: 'paladin' }],
    ['morePower', '성기 05', '넘치는 신성한 힘', W, '전설', 1, 'n', '신성한 힘 최대 +{v}칸', { hero: 'paladin', fixed: true }],
    ['wideWave', '성기 06', '퍼지는 파도', ACC, '영웅', 1, 'n', '빛의 파도 범위 +{v}칸', { hero: 'paladin', fixed: true }],
    ['longSanctuary', '성기 07', '긴 성역', HEAD, '영웅', 2, 'sec', '빛의 성역 효과 시간 +{v}', { hero: 'paladin' }],
    ['prayingSacrifice', '성기 08', '기도하는 희생', CHEST, '영웅', 0.1, 'pp', '희생으로 나눠 받는 비율 +{v}, 내가 받는 피해 −20%', { hero: 'paladin' }],
  ],
};

export const SPECS: Record<string, SpecDef> = {};
export const SPEC_KEYS: string[] = [];
for (const [group, rows] of Object.entries(TABLE) as [SpecGroup, Row[]][]) {
  for (const [key, no, name, slots, min, val, unit, text, o] of rows) {
    SPECS[key] = { key, no, name, group, slots, min, val, unit, text, ...o };
    SPEC_KEYS.push(key);
  }
}

/**
 * 이름 있는 장신구 (42 3장): 장소 고유 목걸이 · 반지. 고유 효과 1줄은 고정이고 나머지 줄은 등급대로 굴림.
 * place = 떨어지는 장소 (content 키, 아직 없는 장소는 이름만). 같은 이름 있는 장신구는 하나만 낄 수 있음
 */
export interface NamedDef { key: string; name: string; slot: 'neck' | 'ring'; place: string; placeName: string; text: string; val: number; unit: SpecUnit; cd?: number }
export const NAMED: NamedDef[] = [
  { key: 'rustyCog', name: '녹슨 톱니', slot: 'neck', place: 'rustfort', placeName: '녹슨 요새', text: '치유를 시전하면 10% 확률로 10초 동안 가속 +{v} (재사용 20초)', val: 0.15, unit: 'pct', cd: 20 },
  { key: 'plagueCenser', name: '역병 향로', slot: 'neck', place: 'crypt', placeName: '역병 지하묘지', text: '해제하면 대상에게 지능 {v} 보호막 (재사용 15초)', val: 0.6, unit: 'pct', cd: 15 },
  { key: 'toadCharm', name: '두꺼비 부적', slot: 'neck', place: 'swamp', placeName: '독안개 늪', text: '마나 30% 아래로 내려가면 12초 동안 정신력 +{v} (전투당 1번)', val: 0.6, unit: 'pct' },
  { key: 'ladyPortrait', name: '귀부인의 초상', slot: 'neck', place: 'manor', placeName: '저주받은 장원', text: '체력 30% 아래 아군에게 하는 직접 힐 +{v}', val: 0.2, unit: 'pct' },
  { key: 'frozenHourglass', name: '얼어붙은 모래시계', slot: 'ring', place: 'frost', placeName: '서리 마탑', text: '공대 쿨기를 쓰면 15초 동안 마나 소모 −{v}', val: 0.3, unit: 'pct' },
  { key: 'templeVial', name: '신전 성수병', slot: 'neck', place: 'temple', placeName: '깨진 신전', text: '광역 힐이 4명 이상 회복하면 6초 동안 치명타 +{v}', val: 0.1, unit: 'pct' },
];
export const namedOf = (key: string | undefined) => (key ? NAMED.find(n => n.key === key) : undefined);
/** 도감 묶음 (42 1-6): 특수능력 9묶음 + 이름 있는 장신구 */
export type CodexGroup = SpecGroup | 'named';
/** 도감 묶음 하나를 다 모으면 받는 칭호 (42 1-6) */
export const SPEC_TITLES: Record<CodexGroup, string> = {
  heal: '손끝이 따스한 자', proc: '행운의 손', guard: '든든한 방패막이', mana: '마나 살림꾼', dispel: '해독 박사',
  cd: '때를 아는 자', ally: '모두의 응원단', gimmick: '기믹 박사', hero: '만능 힐러', named: '장신구 수집가',
};
/** 도감 묶음에 든 키 */
export const codexKeys = (g: CodexGroup): string[] => (g === 'named' ? NAMED.map(n => n.key) : SPEC_KEYS.filter(k => SPECS[k].group === g));
/** 키 → 도감 묶음 */
export const codexGroupOf = (key: string): CodexGroup | undefined => (SPECS[key]?.group ?? (namedOf(key) ? 'named' : undefined));
/** 그 장소 · 부위에서 나오는 이름 있는 장신구 */
export const namedFor = (place: string, slot: SlotKey) => NAMED.find(n => n.place === place && n.slot === slot);

/**
 * 장소마다 자주 나오는 특수능력 3개 (42 1-4, 4배). 입장 화면 「나오는 장비」에 이름이 보임.
 * 장소 기획 표 (38 0-10)의 드롭 목록 열과 같게. 아직 없는 장소는 만들 때 더함
 */
export const FEATURED: Record<string, readonly string[]> = {
  plateau: ['warmTouch', 'sunHandful', 'pouch'],
  // 잿빛 공동묘지 (탐험 ②, 39 1-1): 첫 해제 (질병) 자리라 해제 쪽
  cemetery: ['brushOff', 'coldMedicine', 'thankHand'],
  // 늪지 어귀 (탐험 ③): 완치 표식 · 독을 힐로 버팀
  marsh: ['antidote', 'warmCloak', 'lingerLight'],
  // 백합 정원 (탐험 ④): 차례 = 빠른 직접 힐, 받는 치유 −50% 저주
  lily: ['curseBreak', 'warmTouch', 'firstCup'],
  // 눈보라 고개 (탐험 ⑤): 진동 = 즉시 스킬 · 지속 힐로 넘기기, 침묵 (마법)
  snowpass: ['spellWard', 'lingerLight', 'pouch'],
  // 해바라기 언덕길 (탐험 ⑥): 무력화 = 전원 70% 위로 (광역 · 딜러 지원)
  hillpath: ['wideEmbrace', 'cheerFlag', 'spellWard'],
  // 무너진 순례길 (탐험 ⑦): 해제 4유형 차례 · 발판에 들어간 사람 바로 채우기
  pilgrim: ['brushOff', 'thankHand', 'warmTouch'],
  // 심연 가장자리 (탐험 ⑧): 질병 · 독 · 전염 (함정은 끝날 때까지 채우기)
  abyssedge: ['coldMedicine', 'antidote', 'lingerLight'],
  rustfort: ['shieldFriend', 'firstWord', 'springSip'],
  // 서리 마탑 (던전 ⑤): 진동 · 역류 = 시전 아끼기, 주시 = 넘친 치유 줄이기
  frost: ['spellWard', 'pouch', 'twiceBrush'],
  // 무너진 망루 (던전 ⑦): 끌려온 사람 세워 두기 (단일 힐) · 진동 = 즉시 스킬 · 함정
  watchtower: ['warmTouch', 'pouch', 'trapSense'],
  // 깨진 신전 (던전 ⑥): 해제 4유형 · 천장 무너짐 피난처 · 무력화 = 전원 70% 위로
  temple: ['cleanHands', 'shelterMap', 'wideEmbrace'],
  // 저주받은 장원 (던전 ④): 저주 · 힐하지 말아야 할 사람 · 차례
  manor: ['curseBreak', 'hardShell', 'regular'],
  // 독안개 늪 (던전 ③): 독 버티기 · 정령 · 피난처 늦는 사람에게 보호막
  swamp: ['antidote', 'fadingMiasma', 'hardShell'],
  // 역병 지하묘지 (던전 ②): 질병 해제 · 끌려온 사람과 탱커를 광역으로
  crypt: ['coldMedicine', 'immuneIncense', 'wideEmbrace'],
  abyss1: ['coldMedicine', 'cleanHands', 'bounceLight'],
  cathedral1: ['spellWard', 'strongChorus', 'goldEcho'],
};

/** 값 글자: 6% · 10%p · 1.5초 · 0.6% · 1 */
export function fmtSpec(v: number, unit: SpecUnit): string {
  const r1 = (x: number) => String(Math.round(x * 10) / 10);
  switch (unit) {
    case 'pct': return `${r1(v * 100)}%`;
    case 'pp': return `${r1(v * 100)}%p`;
    case 'sec': return `${r1(v)}초`;
    case 'mana': return `${r1(v)}%`;
    case 'n': return r1(v);
  }
}
/** 효과 글 (값을 채움) */
export const specText = (d: { text: string; unit: SpecUnit }, v: number) => d.text.replace('{v}', fmtSpec(v, d.unit));

/** 장비 한 줄 (저장): 특수능력 키 + 굴림 (0.6~1, 값 고정이면 1) */
export interface SpecLine { key: string; roll: number }

/** 줄의 값 = 영웅 최대값 × 등급 배율 × 굴림. 값 고정이면 그대로 (42 1-2) */
export function specValue(key: string, grade: ItemGrade, roll: number): number {
  const d = SPECS[key];
  if (!d) return 0;
  return d.fixed ? d.val : d.val * GRADE_MULT[grade] * roll;
}

/** 전투에 넘기는 줄 하나 (값까지 계산한 것) */
export interface SpecOn { key: string; v: number }

/**
 * 끼고 있는 장비의 줄 → 전투에서 켜지는 값 (42 1-3 · 1-5 · 3장).
 * 같은 특수능력은 더하고 상한까지. 재사용 대기가 있는 발동 · 값 고정 · 이름 있는 장신구는 겹치지 않고 가장 큰 것 하나. 직업 전용은 그 직업일 때만
 */
export function specTotals(lines: readonly SpecOn[], hero: HeroKey): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { key, v } of lines) {
    const d = SPECS[key];
    if (!d && !namedOf(key)) continue;
    if (d?.hero && d.hero !== hero) continue;
    if (!d || d.cd || d.fixed) out[key] = Math.max(out[key] ?? 0, v);
    else out[key] = Math.min(d.cap ?? Infinity, (out[key] ?? 0) + v);
  }
  return out;
}
