/**
 * 장비 특수능력 262종 = 공통 94 + 직업 전용 168 (7직업 × 24) (42, Lim 2026-10-09 「장신구 및 장비에서 더 다양한 특수능력 100여 종」) + 이름 있는 장신구 (42 3장).
 * 장비 한 줄 = { key, roll }. 값 = 영웅 최대값 × 등급 배율 (data/equipment GRADE_MULT) × 굴림 (60~100%), fixed면 굴리지 않음.
 * 같은 특수능력이 여러 장비에 있으면 더함 (cap까지), 재사용 대기(cd)가 있는 발동은 가장 좋은 것 하나만 (42 1-3).
 * 효과는 engine/specials.ts가 엔진 훅에 붙임. ready = 엔진에 붙어서 드롭에 나와도 되는 것.
 */
import { GRADE_MULT, type ItemGrade, type SlotKey } from './equipment';
import type { HeroKey } from './heroes';
import type { SkillKey } from './skills';

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
  /** 직업 스킬에만 적용하는 데이터 기반 효과. val은 치유 증가 / 마나·재사용 감소 비율 */
  skillMod?: { key: SkillKey; kind: 'heal' | 'cost' | 'cooldown' };
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
  /** 스킬 구조상 효과가 0인 직업 (NO_EFFECT): 그 직업으로 돌 때 드롭에서 안 나옴 (QA 2026-10-16 Lim 2.a). 이미 가진 장비는 그대로 */
  noHero?: HeroKey[];
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
    ['beeDance', '발동 04', '꿀벌의 춤', W, '희귀', 0.4, 'pct', '힐 스킬 5번마다 다음 힐 회복량 +{v}'],
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
    ['guardFeather', '보호 07', '수호의 깃', ALL, '희귀', 0.25, 'pct', '생존기 (외부 생존기 칸 스킬) 효과 시간 +{v}'],
    ['warmCloak', '보호 08', '따뜻한 망토', AR, '고급', 0.1, 'pct', '지속 피해 디버프가 걸린 아군에게 하는 힐 +{v}'],
    ['risingLight', '보호 09', '일어서는 빛', ACC, '희귀', 0.2, 'pp', '부활한 파티원 체력 +{v}, 5초 동안 받는 피해 −30%'],
    ['hardShell', '보호 10', '단단한 껍데기', ALL, '고급', 0.15, 'pct', '내가 거는 보호막 +{v}', { cap: 0.45 }],
    ['twinShield', '보호 11', '쌍둥이 방패', W, '영웅', 1, 'n', '생존기를 쓰면 옆 칸 1명에게도 절반 효과 (토템 · 별의 잠 제외)', { fixed: true }],
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
    ['restTea', '마나 06', '정비의 차', NECK, '고급', 0.5, 'pct', '던전 구간 사이 정비 때 마나 회복 +{v}'],
    ['firstCup', '마나 07', '첫 잔', AR, '고급', 0.3, 'pct', '전투 시작 15초 동안 마나 소모 −{v}'],
    ['dusk', '마나 08', '해 질 녘', W, '희귀', 0.2, 'pct', '보스 체력 20% 아래에서 마나 소모 −{v}'],
    ['potionRegular', '마나 09', '남은 자의 각오', ACC, '고급', 0.2, 'pct', '파티원이 쓰러져 있으면 마나 소모 −{v}'],
    ['stillMoment', '마나 10', '고요한 순간', HEAD, '희귀', 0.8, 'pct', '3초 동안 스킬을 안 쓰면 그동안 정신력 +{v}'],
    ['thankHand', '마나 11', '고마운 손', HANDS, '고급', 0.8, 'mana', '해제를 하면 마나 {v} 회복'],
    ['raidBreath', '마나 12', '공대의 숨결', ACC, '희귀', 0.3, 'pct', '공대 쿨기 마나 소모 −{v}'],
  ],
  // 2-5 해제 · 디버프
  dispel: [
    ['cleanHands', '해제 01', '깨끗한 손', H_ACC, '희귀', 0.8, 'sec', '해제 재사용 −{v}', { cap: 1.6 }], // 해제 8 → 4초 (2026-10-12)에 맞춰 1.5 · 상한 3에서 반으로
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
    ['eliteHunter', '지원 08', '정예 사냥꾼', W, '희귀', 0.08, 'pct', '정예 · 졸개가 판 위에 있는 동안 파티 딜 +{v}'],
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
  // 2-9 직업 전용 (그 직업일 때만 켜지고, 그 직업으로 돌 때만 나옴. 직업마다 24종)
  hero: [
    ['deepWord', '사제 01', '깊은 성언', ALL, '희귀', 0.12, 'pct', '평온 게이지 충전 +{v}', { cap: 0.6, hero: 'priest' }],
    ['serenityEcho', '사제 02', '평온의 여운', W, '전설', 0.2, 'pct', '성언: 평온 회복량 +{v}, 넘친 양은 4초 지속 힐로', { hero: 'priest' }],
    ['wideSanctify', '사제 03', '넓은 평온', W, '전설', 1, 'n', '성언: 평온이 대상 둘레 {v}칸 아군에게도 50%', { hero: 'priest', fixed: true }], // 82: 넓은 신성화 → 넓은 평온 (키는 저장 때문에 그대로)
    ['quickRenew', '사제 04', '짙은 소생', AR, '영웅', 0.25, 'pct', '소생 회복량 +{v}', { hero: 'priest', cap: 0.5 }],
    ['pohEcho', '사제 05', '기원의 메아리', ACC, '영웅', 0.5, 'pct', '치유의 기원이 {v} 확률로 2초 뒤 절반 한 번 더', { hero: 'priest', cap: 0.6 }],
    ['wakeGuard', '사제 06', '깨어 있는 수호', NECK, '영웅', 1, 'pct', '수호 영혼이 발동하면 대상이 지능 {v} 회복', { hero: 'priest' }],
    ['hymnBreath', '사제 07', '찬가의 숨결', ACC, '전설', 3, 'mana', '천상의 찬가 마나 소모 −50%, 끊기지 않고 끝나면 마나 {v} 회복', { hero: 'priest' }],
    ['flashLight', '사제 08', '순간의 빛', HANDS, '영웅', 0.3, 'sec', '순간 치유 시전 −{v}', { hero: 'priest' }],
    ['wideGrove', '드루 01', '넓은 군락', ALL, '희귀', 0.05, 'pp', '군락 보너스 칸마다 +{v}', { cap: 0.15, hero: 'druid' }],
    ['sproutHop', '드루 02', '옮겨 가는 새싹', W, '전설', 1, 'n', '새싹이 끝까지 가면 옆 칸 1명에게 절반 시간 새싹', { hero: 'druid', fixed: true }],
    ['hastyBloom', '드루 03', '서두른 꽃', HANDS, '영웅', 3, 'sec', '피워 내기 재사용 −{v}', { hero: 'druid' }],
    ['flowerSea', '드루 04', '들꽃 바다', W, '전설', 1, 'n', '들꽃 군락 범위 +{v}칸', { hero: 'druid', fixed: true }],
    ['thickBark', '드루 05', '굵은 껍질', AR, '영웅', 0.1, 'pp', '나무껍질 받는 피해 감소 +{v}', { hero: 'druid', cap: 0.2 }],
    ['dawnDew', '드루 06', '새벽 이슬', HANDS, '영웅', 0.3, 'sec', '생장 시전 −{v}', { hero: 'druid' }],
    ['forestBreath', '드루 07', '숲의 숨결', ACC, '영웅', 1, 'sec', '고요한 숲이 늘리는 지속 힐 시간 +{v}', { hero: 'druid', fixed: true }],
    ['quickRebirth', '드루 08', '빠른 환생', NECK, '영웅', 0.2, 'pp', '환생 시전 −1초, 부활 체력 +{v}', { hero: 'druid' }],
    ['bigBeacon', '성기 01', '큰 봉화', ALL, '희귀', 0.1, 'pp', '봉화로 함께 들어가는 몫 +{v}', { cap: 0.3, hero: 'paladin' }],
    ['secondBeacon', '성기 02', '두 번째 봉화', W, '전설', 1, 'n', '봉화를 2명에게 (두 번째는 절반)', { hero: 'paladin', fixed: true }],
    ['combo', '성기 03', '빠른 손길', HANDS, '영웅', 0.2, 'sec', '빛의 손길 시전 −{v}', { hero: 'paladin' }],
    ['firmOath', '성기 04', '단단한 서약', AR, '영웅', 0.15, 'pct', '빛의 서약 회복량 +{v}', { hero: 'paladin' }],
    ['morePower', '성기 05', '넘치는 신성한 힘', W, '전설', 1, 'n', '신성한 힘 최대 +{v}칸', { hero: 'paladin', fixed: true }],
    ['wideWave', '성기 06', '퍼지는 파도', ACC, '영웅', 1, 'n', '빛의 파도 범위 +{v}칸', { hero: 'paladin', fixed: true }],
    ['longSanctuary', '성기 07', '긴 성역', HEAD, '영웅', 2, 'sec', '빛의 성역 효과 시간 +{v}', { hero: 'paladin' }],
    ['prayingSacrifice', '성기 08', '기도하는 희생', CHEST, '영웅', 0.1, 'pp', '희생으로 나눠 받는 비율 +{v}, 내가 받는 피해 −20%', { hero: 'paladin' }],
    // v12: 직업별 성장 장비 24종. 공통 스킬 훅으로 치유·자원·쿨기 빌드 지원
    ['steadyPrayer', '사제 09', '꾸준한 기도', ALL, '고급', 0.12, 'pct', '「치유」 회복량 +{v}', { hero: 'priest', cap: 0.4, skillMod: { key: 'heal', kind: 'heal' } }],
    ['urgentPrayer', '사제 10', '간절한 기도', HANDS, '희귀', 0.16, 'pct', '순간 치유 회복량 +{v}', { hero: 'priest', cap: 0.4, skillMod: { key: 'flash', kind: 'heal' } }],
    ['gatheredPrayer', '사제 11', '모인 기도', W_ACC, '희귀', 0.16, 'pct', '치유의 기원 회복량 +{v}', { hero: 'priest', cap: 0.4, skillMod: { key: 'poh', kind: 'heal' } }],
    ['sereneLight', '사제 12', '평온한 빛', AR_ACC, '희귀', 0.18, 'pct', '성언: 평온 회복량 +{v}', { hero: 'priest', cap: 0.4, skillMod: { key: 'serenity', kind: 'heal' } }],
    ['consecratedLight', '사제 13', '축성의 빛', W_ACC, '영웅', 0.18, 'pct', '성언: 평온을 쓴 뒤 10초 안 첫 치유의 기원 회복량 +{v}', { hero: 'priest', cap: 0.4 }], // 82: 신성화 회복량 → 평온 다음 기원
    ['renewalVow', '사제 14', '소생의 서약', AR_ACC, '고급', 0.15, 'pct', '소생 마나 소모 −{v}', { hero: 'priest', cap: 0.4, skillMod: { key: 'renew', kind: 'cost' } }],
    ['guardianPromise', '사제 15', '수호의 약속', AR, '희귀', 0.12, 'pct', '수호 영혼 재사용 대기 −{v}', { hero: 'priest', cap: 0.3, skillMod: { key: 'guardian', kind: 'cooldown' } }],
    ['returningHymn', '사제 16', '돌아오는 찬가', NECK, '영웅', 0.1, 'pct', '천상의 찬가 재사용 대기 −{v}', { hero: 'priest', cap: 0.3, skillMod: { key: 'hymn', kind: 'cooldown' } }],
    ['tenderSprout', '드루 09', '푸른 새싹', ALL, '고급', 0.12, 'pct', '새싹 회복량 +{v}', { hero: 'druid', cap: 0.4, skillMod: { key: 'sprout', kind: 'heal' } }],
    ['lushGrowth', '드루 10', '무성한 생장', HANDS, '희귀', 0.16, 'pct', '생장 회복량 +{v}', { hero: 'druid', cap: 0.4, skillMod: { key: 'growth', kind: 'heal' } }],
    ['fullBloom', '드루 11', '만개의 순간', W_ACC, '희귀', 0.16, 'pct', '피워 내기 회복량 +{v}', { hero: 'druid', cap: 0.4, skillMod: { key: 'bloom', kind: 'heal' } }],
    ['vividFlowers', '드루 12', '짙은 들꽃', AR_ACC, '희귀', 0.16, 'pct', '들꽃 군락 회복량 +{v}', { hero: 'druid', cap: 0.4, skillMod: { key: 'wildflower', kind: 'heal' } }],
    ['deepForest', '드루 13', '깊은 숲', W_ACC, '영웅', 0.18, 'pct', '고요한 숲으로 심는 새싹 회복량 +{v}', { hero: 'druid', cap: 0.4, skillMod: { key: 'quietwood', kind: 'heal' } }],
    ['gentleRain', '드루 14', '부드러운 비', AR_ACC, '고급', 0.15, 'pct', '새싹 마나 소모 −{v}', { hero: 'druid', cap: 0.4, skillMod: { key: 'sprout', kind: 'cost' } }],
    ['barkCycle', '드루 15', '껍질의 순환', AR, '희귀', 0.12, 'pct', '나무껍질 재사용 대기 −{v}', { hero: 'druid', cap: 0.3, skillMod: { key: 'bark', kind: 'cooldown' } }],
    ['forestReturn', '드루 16', '숲의 귀환', NECK, '영웅', 0.1, 'pct', '고요한 숲 재사용 대기 −{v}', { hero: 'druid', cap: 0.3, skillMod: { key: 'quietwood', kind: 'cooldown' } }],
    ['faithfulLight', '성기 09', '신실한 빛', ALL, '고급', 0.12, 'pct', '빛의 손길 회복량 +{v}', { hero: 'paladin', cap: 0.4, skillMod: { key: 'holyLight', kind: 'heal' } }],
    ['radiantStrike', '성기 10', '빛나는 성역', HANDS, '희귀', 0.1, 'pct', '빛의 성역 재사용 대기 −{v}', { hero: 'paladin', cap: 0.3, skillMod: { key: 'sanctuary', kind: 'cooldown' } }], // 2026-10-16 빛 일격을 없애며 (예전 빛나는 일격)
    ['risingWave', '성기 11', '찬란한 파도', W_ACC, '희귀', 0.16, 'pct', '빛의 파도 회복량 +{v}', { hero: 'paladin', cap: 0.4, skillMod: { key: 'lightWave', kind: 'heal' } }],
    ['blessedSanctuary', '성기 12', '축복받은 성역', CHEST, '영웅', 0.18, 'pct', '빛의 성역 회복량 +{v}', { hero: 'paladin', cap: 0.4, skillMod: { key: 'sanctuary', kind: 'heal' } }],
    ['frugalLight', '성기 13', '절제의 빛', AR_ACC, '고급', 0.15, 'pct', '빛의 손길 마나 소모 −{v}', { hero: 'paladin', cap: 0.4, skillMod: { key: 'holyLight', kind: 'cost' } }],
    ['measuredStrike', '성기 14', '절제의 파도', H_ACC, '희귀', 0.15, 'pct', '빛의 파도 마나 소모 −{v}', { hero: 'paladin', cap: 0.4, skillMod: { key: 'lightWave', kind: 'cost' } }],
    ['sacredResolve', '성기 15', '희생의 결의', AR, '희귀', 0.12, 'pct', '희생 재사용 대기 −{v}', { hero: 'paladin', cap: 0.3, skillMod: { key: 'sacrifice', kind: 'cooldown' } }],
    ['returningGuard', '성기 16', '돌아오는 가호', NECK, '영웅', 0.1, 'pct', '보호의 손 재사용 대기 −{v}', { hero: 'paladin', cap: 0.3, skillMod: { key: 'handGuard', kind: 'cooldown' } }],
    // 2026-10-14 직업마다 8종 더 (42 2-9): 고급 · 희귀에서도 부위마다 고를 거리가 있게, 직업 고유 시스템 (성언 · 새싹 · 신성한 힘 · 봉화)에 붙는 효과
    ['graceWord', '사제 17', '성언의 은혜', W_ACC, '고급', 1.5, 'mana', '성언: 평온을 쓰면 마나 {v} 회복', { hero: 'priest', cap: 3 }],
    ['crossWord', '사제 18', '번지는 울림', AR, '희귀', 0.15, 'pct', '성언: 평온을 쓴 뒤 평온 게이지가 {v}에서 시작', { hero: 'priest', cap: 0.3 }], // 82: 다른 게이지가 없어짐
    ['renewKnot', '사제 19', '소생의 매듭', ALL, '고급', 0.25, 'pct', '소생이 끝까지 가면 대상이 지능 {v} 회복', { hero: 'priest', cap: 0.6 }],
    ['clearPrayer', '사제 20', '맑은 기도', HANDS, '고급', 0.15, 'pct', '정화로 디버프를 지우면 평온 게이지 +{v}', { hero: 'priest' }],
    ['groupPrayer', '사제 21', '모두의 기도', ACC, '희귀', 0.12, 'pct', '치유의 기원이 4명 이상 회복하면 평온 게이지 +{v}', { hero: 'priest', cap: 0.25 }],
    ['relayStep', '사제 22', '빛의 발자국', W, '영웅', 1, 'n', '빛의 전이가 옮겨 가는 횟수 +{v}', { hero: 'priest', fixed: true }],
    ['flashThrift', '사제 23', '아끼는 순간', H_ACC, '희귀', 0.15, 'pct', '순간 치유 마나 소모 −{v}', { hero: 'priest', cap: 0.4, skillMod: { key: 'flash', kind: 'cost' } }],
    ['guardianLight', '사제 24', '영혼의 등불', AR, '희귀', 0.15, 'pct', '수호 영혼이 걸린 아군에게 하는 힐 +{v}', { hero: 'priest', cap: 0.3 }],
    ['dewDrop', '드루 17', '이슬 맺힘', W_ACC, '고급', 0.2, 'mana', '새싹이 끝까지 가면 마나 {v} 회복', { hero: 'druid', cap: 0.5 }],
    ['deepRoots', '드루 18', '깊은 뿌리', ALL, '고급', 0.08, 'pct', '지속 힐이 2개 이상 걸린 아군에게 하는 직접 힐 +{v}', { hero: 'druid', cap: 0.3 }],
    ['pollen', '드루 19', '꽃가루', ACC, '희귀', 1, 'n', '피워 내기를 쓰면 새싹이 없는 옆 칸 1명에게 절반 새싹', { hero: 'druid', fixed: true }],
    ['barkSprout', '드루 20', '껍질 아래 새순', CHEST, '고급', 1, 'n', '나무껍질을 건 대상에게 새싹이 없으면 새싹도 건다', { hero: 'druid', fixed: true }],
    ['leafCleanse', '드루 21', '잎새 정화', HANDS, '고급', 1, 'n', '자연 정화로 디버프를 지우면 새싹이 없는 대상에게 절반 새싹', { hero: 'druid', fixed: true }],
    ['meadowWind', '드루 22', '들판의 바람', W_ACC, '희귀', 0.15, 'pct', '들꽃 군락 재사용 대기 −{v}', { hero: 'druid', cap: 0.3, skillMod: { key: 'wildflower', kind: 'cooldown' } }],
    ['sproutWind', '드루 23', '퍼지는 새싹', HEAD, '희귀', 0.12, 'pct', '새싹을 걸면 {v} 확률로 새싹이 없는 옆 칸 1명에게도 새싹', { hero: 'druid', cap: 0.3 }],
    ['bloomBreath', '드루 24', '피어나는 숨', NECK, '영웅', 1, 'mana', '피워 내기를 쓰면 마나 {v} 회복', { hero: 'druid' }],
    ['beaconKeeper', '성기 17', '봉화지기', W_ACC, '고급', 0.08, 'pct', '봉화 대상에게 하는 직접 힐 +{v}', { hero: 'paladin', cap: 0.25 }],
    ['fullPower', '성기 18', '흘러넘친 빛', ALL, '고급', 0.1, 'pct', '신성한 힘이 가득 찬 채로 쓰는 빛의 손길 회복량 +{v}', { hero: 'paladin', cap: 0.3 }],
    ['risingPower', '성기 19', '차오르는 힘', W, '희귀', 0.25, 'pct', '빛의 손길이 {v} 확률로 신성한 힘 1칸 더', { hero: 'paladin', cap: 0.5 }],
    ['oathBreath', '성기 20', '서약의 숨', ACC, '희귀', 1.5, 'mana', '빛의 서약을 신성한 힘 3칸 이상으로 쓰면 마나 {v} 회복', { hero: 'paladin', cap: 3 }],
    ['cleansePower', '성기 21', '정화의 손길', HANDS, '고급', 1, 'n', '정화의 손으로 디버프를 지우면 신성한 힘 +{v}칸', { hero: 'paladin', fixed: true }],
    ['sacrificeLight', '성기 22', '희생의 빛', AR, '희귀', 0.15, 'pct', '희생 중인 아군에게 하는 힐 +{v}', { hero: 'paladin', cap: 0.3 }],
    ['strikeEcho', '성기 23', '손길의 메아리', HEAD, '희귀', 1, 'n', '빛의 손길이 치명타면 신성한 힘 1칸 더', { hero: 'paladin', fixed: true }],
    ['dawnResolve', '성기 24', '밝은 결의', CHEST, '영웅', 0.1, 'pct', '신성한 힘 3칸을 한 번에 쓰면 6초 동안 가속 +{v}', { hero: 'paladin' }],
    // 주술사 (79 2-8): 01~08 직업 효과 · 09~16 스킬 수치 · 17~24 토템 · 연쇄와 엮인 효과.
    // 깊은 샘 · 흐르는 물결 · 굵은 물방울 · 샘 긷기 · 토템 곁 · 대지의 울림은 전용장비 밸런스 (79 2-11)로 올림: 전용 특수능력 장비에서 세 직업 평균보다 던전 · 20인 악몽이 6%p 낮던 것
    ['deepSpring', '주술 01', '깊은 샘', ALL, '희귀', 0.15, 'pct', '샘 토템 회복량 +{v}', { cap: 0.4, hero: 'shaman' }],
    ['puddle', '주술 02', '물웅덩이', W, '전설', 0.1, 'pct', '물방울이 끝까지 가면 그 칸에 6초 웅덩이: 위에 선 아군 받는 피해 −{v}', { hero: 'shaman', fixed: true }],
    ['hastyDrop', '주술 03', '서두른 물방울', HANDS, '영웅', 1, 'sec', '물방울 재사용 −{v}', { hero: 'shaman', cap: 1.5 }], // 84: 2 → 1초 (재사용 4초의 절반이던 것)
    ['hardEarth', '주술 04', '굳은 대지', AR, '영웅', 0.1, 'pp', '대지 토템 받는 피해 감소 +{v}', { hero: 'shaman', cap: 0.2 }],
    ['tallSpring', '주술 05', '마르지 않는 샘', W, '전설', 6, 'sec', '샘 토템 시간 +{v}', { hero: 'shaman', fixed: true }],
    ['quickShower', '주술 06', '서두른 샘', HANDS, '영웅', 1.5, 'sec', '샘 토템 재사용 −{v}', { hero: 'shaman' }],
    ['longRain', '주술 07', '긴 비', ACC, '영웅', 2, 'sec', '비구름 토템 시간 +{v}', { hero: 'shaman', fixed: true }],
    ['deepLink', '주술 08', '깊은 이음', NECK, '영웅', 0.1, 'pp', '영혼 잇기 받는 피해 감소 +{v}', { hero: 'shaman' }],
    ['rippleFlow', '주술 09', '흐르는 물결', ALL, '고급', 0.15, 'pct', '잔물결 회복량 +{v}', { hero: 'shaman', cap: 0.4, skillMod: { key: 'ripple', kind: 'heal' } }],
    ['heavyShower', '주술 10', '잇기의 귀환', HANDS, '희귀', 0.16, 'pct', '영혼 잇기 재사용 대기 −{v}', { hero: 'shaman', cap: 0.4, skillMod: { key: 'spiritLink', kind: 'cooldown' } }],
    ['strongChain', '주술 11', '굵은 사슬', W_ACC, '희귀', 0.16, 'pct', '연쇄 치유 회복량 +{v}', { hero: 'shaman', cap: 0.4, skillMod: { key: 'chainHeal', kind: 'heal' } }],
    ['fatDrop', '주술 12', '굵은 물방울', AR_ACC, '희귀', 0.2, 'pct', '물방울 회복량 +{v}', { hero: 'shaman', cap: 0.4, skillMod: { key: 'droplet', kind: 'heal' } }],
    ['rainBless', '주술 13', '비의 축복', W_ACC, '영웅', 0.18, 'pct', '비구름 토템 회복량 +{v}', { hero: 'shaman', cap: 0.4, skillMod: { key: 'rainTotem', kind: 'heal' } }],
    ['thriftRipple', '주술 14', '아끼는 물결', AR_ACC, '고급', 0.15, 'pct', '잔물결 마나 소모 −{v}', { hero: 'shaman', cap: 0.4, skillMod: { key: 'ripple', kind: 'cost' } }],
    ['earthReturn', '주술 15', '대지의 귀환', AR, '희귀', 0.12, 'pct', '대지 토템 재사용 대기 −{v}', { hero: 'shaman', cap: 0.3, skillMod: { key: 'earthTotem', kind: 'cooldown' } }],
    ['rainReturn', '주술 16', '비의 귀환', NECK, '영웅', 0.1, 'pct', '비구름 토템 재사용 대기 −{v}', { hero: 'shaman', cap: 0.3, skillMod: { key: 'rainTotem', kind: 'cooldown' } }],
    ['springDraw', '주술 17', '샘 긷기', W_ACC, '고급', 0.5, 'mana', '샘 토템이 한 번에 3명 이상 회복하면 마나 {v} 회복', { hero: 'shaman', cap: 1 }],
    ['totemSide', '주술 18', '토템 곁', ALL, '고급', 0.12, 'pct', '토템 범위 안 아군에게 하는 직접 힐 +{v}', { hero: 'shaman', cap: 0.3 }],
    ['chainDrop', '주술 19', '사슬 끝 물방울', ACC, '희귀', 1, 'n', '연쇄 치유 마지막 대상에게 물방울이 없으면 절반 물방울', { hero: 'shaman', fixed: true }],
    ['washDrop', '주술 20', '씻김 물방울', HANDS, '고급', 1, 'n', '씻김으로 디버프를 지우면 대상에게 절반 물방울', { hero: 'shaman', fixed: true }],
    ['totemMend', '주술 21', '토템의 마지막 물', CHEST, '고급', 1, 'n', '샘 토템이 깨질 때 범위 안 아군에게 샘 회복 한 번', { hero: 'shaman', fixed: true }],
    ['chainBreath', '주술 22', '사슬의 숨', W_ACC, '희귀', 0.12, 'pct', '연쇄 치유 마나 소모 −{v}', { hero: 'shaman', cap: 0.3, skillMod: { key: 'chainHeal', kind: 'cost' } }],
    ['earthEcho', '주술 23', '대지의 울림', HEAD, '희귀', 0.3, 'pct', '대지 토템을 세우면 {v} 확률로 붙은 칸에 샘 토템도 (마나 없이)', { hero: 'shaman', cap: 0.6 }],
    ['rainHaste', '주술 24', '비의 서두름', NECK, '영웅', 0.1, 'pct', '비구름 토템 동안 가속 +{v}', { hero: 'shaman' }],
    // 수도사 (79 3-8). 깊은 박자 · 따뜻한 감싸기 · 짙은 안개 · 박자의 서두름은 전용 장비 밸런스로 낮춤 (79 3-11)
    ['deepBeat', '수도 01', '깊은 박자', ALL, '희귀', 0.01, 'pp', '기 리듬 1마다 손바닥 +{v}', { cap: 0.02, hero: 'monk' }],
    ['twinMist', '수도 02', '갈라지는 안개', W, '전설', 1, 'n', '떠도는 안개가 처음 옮겨 갈 때 둘로 나뉨 (남은 회복량 그대로 둘)', { hero: 'monk', fixed: true }],
    ['hastyMist', '수도 03', '서두른 안개', HANDS, '영웅', 2, 'sec', '떠도는 안개 재사용 −{v}', { hero: 'monk' }],
    ['deepSoothe', '수도 04', '깊은 누그러뜨림', AR, '영웅', 0.1, 'pp', '누그러뜨림 받는 피해 감소 +{v}', { hero: 'monk', cap: 0.2 }],
    ['wideBreath', '수도 05', '넓은 숨결', W, '전설', 1, 'n', '안개 숨결 범위 +{v}칸', { hero: 'monk', fixed: true }],
    ['quickWrap', '수도 06', '빠른 감싸기', HANDS, '영웅', 1.5, 'sec', '안개 감싸기 재사용 −{v}', { hero: 'monk' }], // 82: 시전 −0.3초 → 즉시가 되어 재사용 −1.5초
    ['strongTea', '수도 07', '진한 차', ACC, '영웅', 2, 'mana', '차 한 잔 마나 +{v}', { hero: 'monk', fixed: true }],
    ['clearWind', '수도 08', '맑은 바람', NECK, '영웅', 1, 'n', '되살림 바람이 한 명마다 디버프를 {v}개 더 지움', { hero: 'monk', fixed: true }],
    ['steadyPalm', '수도 09', '곧은 손바닥', ALL, '고급', 0.12, 'pct', '생기 손바닥 회복량 +{v}', { hero: 'monk', cap: 0.4, skillMod: { key: 'vitalPalm', kind: 'heal' } }],
    ['warmWrap', '수도 10', '따뜻한 감싸기', HANDS, '희귀', 0.1, 'pct', '안개 감싸기 회복량 +{v}', { hero: 'monk', cap: 0.4, skillMod: { key: 'mistWrap', kind: 'heal' } }],
    ['thickBreath', '수도 11', '짙은 숨결', W_ACC, '희귀', 0.16, 'pct', '안개 숨결 회복량 +{v}', { hero: 'monk', cap: 0.4, skillMod: { key: 'mistBreath', kind: 'heal' } }],
    ['denseMist', '수도 12', '짙은 안개', AR_ACC, '희귀', 0.1, 'pct', '떠도는 안개 회복량 +{v}', { hero: 'monk', cap: 0.4, skillMod: { key: 'wanderMist', kind: 'heal' } }],
    ['freshWind', '수도 13', '상쾌한 바람', W_ACC, '영웅', 0.18, 'pct', '되살림 바람 회복량 +{v}', { hero: 'monk', cap: 0.4, skillMod: { key: 'reviveWind', kind: 'heal' } }],
    ['thriftWrap', '수도 14', '아끼는 감싸기', AR_ACC, '고급', 0.15, 'pct', '안개 감싸기 마나 소모 −{v}', { hero: 'monk', cap: 0.4, skillMod: { key: 'mistWrap', kind: 'cost' } }],
    ['sootheReturn', '수도 15', '누그러짐의 귀환', AR, '희귀', 0.12, 'pct', '누그러뜨림 재사용 대기 −{v}', { hero: 'monk', cap: 0.3, skillMod: { key: 'soothe', kind: 'cooldown' } }],
    ['windReturn', '수도 16', '바람의 귀환', NECK, '영웅', 0.1, 'pct', '되살림 바람 재사용 대기 −{v}', { hero: 'monk', cap: 0.3, skillMod: { key: 'reviveWind', kind: 'cooldown' } }],
    ['beatMana', '수도 17', '박자의 마나', W_ACC, '고급', 0.2, 'mana', '기 리듬이 5가 되면 마나 {v} 회복', { hero: 'monk', cap: 0.5 }],
    ['mistTouch', '수도 18', '안개 손길', ALL, '고급', 0.08, 'pct', '안개가 걸린 아군에게 하는 직접 힐 +{v}', { hero: 'monk', cap: 0.3 }],
    ['hopHeal', '수도 19', '옮겨 가며 치유', ACC, '희귀', 1, 'n', '떠도는 안개가 옮겨 가면 새 대상이 한 틱을 바로 회복', { hero: 'monk', fixed: true }],
    ['chiCleanse', '수도 20', '기의 정화', HANDS, '고급', 1, 'n', '맑은 기운으로 디버프를 지우면 기 리듬 +{v}', { hero: 'monk', fixed: true }],
    ['teaTime', '수도 21', '차 마시는 때', CHEST, '고급', 0.15, 'pct', '차 한 잔 재사용 대기 −{v}', { hero: 'monk', cap: 0.3, skillMod: { key: 'tea', kind: 'cooldown' } }],
    ['breathCd', '수도 22', '숨결의 순환', W_ACC, '희귀', 0.15, 'pct', '안개 숨결 재사용 대기 −{v}', { hero: 'monk', cap: 0.3, skillMod: { key: 'mistBreath', kind: 'cooldown' } }],
    ['beatHaste', '수도 23', '박자의 서두름', HEAD, '희귀', 0.01, 'pct', '기 리듬 1마다 가속 +{v}', { hero: 'monk', cap: 0.02 }],
    ['palmMist', '수도 24', '손바닥 안개', NECK, '영웅', 0.15, 'pct', '생기 손바닥을 치면 {v} 확률로 안개가 없는 대상에게 6초 안개', { hero: 'monk', cap: 0.3 }],
    // 점성술사 (79 4-8). 전용 장비 밸런스로 희귀 등급 위 11종을 올림 (79 4-11)
    ['brightShard', '점성 01', '밝은 조각', ALL, '희귀', 0.05, 'pp', '별자리가 쓰는 별 조각 1개마다 회복 +{v}', { cap: 0.15, hero: 'astrologer' }], // 83: 모으기 시간 몫으로 올렸던 것 (79 4-11)을 첫 안으로
    ['twinPolaris', '점성 02', '쌍둥이 북극성', W, '전설', 0.3, 'pct', '북극성 회복량의 {v}가 붙어 있는 가장 다친 아군에게', { hero: 'astrologer', fixed: true }],
    ['hastyTwinkle', '점성 03', '서두른 반짝임', HANDS, '영웅', 4, 'sec', '반짝임 재사용 −{v}', { hero: 'astrologer', cap: 4.5 }],
    ['deepSleep', '점성 04', '깊은 잠', AR, '영웅', 1, 'sec', '별의 잠 시간 +{v}', { hero: 'astrologer', fixed: true }],
    ['wideFall', '점성 05', '쏟아지는 별', W, '전설', 3, 'mana', '별비가 5명 이상에게 닿으면 마나 {v} 회복', { hero: 'astrologer', fixed: true }],
    ['perfectWin', '점성 06', '빠른 별자리', HANDS, '영웅', 0.3, 'sec', '별비 · 북극성 · 별의 기억 시전 −{v}', { hero: 'astrologer' }], // 83: 완벽 구간 → 별자리 시전 (키는 저장 때문에 그대로)
    ['memoryShare', '점성 07', '나누는 기억', ACC, '영웅', 0.2, 'pp', '별의 기억 회복 비율 +{v}', { hero: 'astrologer' }],
    ['markSec', '점성 08', '오래 남는 표식', NECK, '영웅', 4, 'sec', '별자리 표식 시간 +{v}', { hero: 'astrologer', fixed: true }],
    ['steadyStar', '점성 09', '고른 별빛', ALL, '고급', 0.12, 'pct', '별빛 치유 회복량 +{v}', { hero: 'astrologer', cap: 0.4, skillMod: { key: 'starHeal', kind: 'heal' } }],
    ['sharpTwinkle', '점성 10', '날카로운 반짝임', HANDS, '희귀', 0.16, 'pct', '반짝임 회복량 +{v}', { hero: 'astrologer', cap: 0.4, skillMod: { key: 'twinkle', kind: 'heal' } }],
    ['heavyFall', '점성 11', '무거운 별비', W_ACC, '희귀', 0.16, 'pct', '별비 회복량 +{v}', { hero: 'astrologer', cap: 0.4, skillMod: { key: 'starfall', kind: 'heal' } }],
    ['bigPolaris', '점성 12', '큰 북극성', AR_ACC, '희귀', 0.16, 'pct', '북극성 회복량 +{v}', { hero: 'astrologer', cap: 0.4, skillMod: { key: 'polaris', kind: 'heal' } }],
    ['deepMemory', '점성 13', '깊은 기억', W_ACC, '영웅', 0.35, 'pct', '별의 기억 회복량 +{v}', { hero: 'astrologer', cap: 0.6, skillMod: { key: 'starMemory', kind: 'heal' } }],
    ['thriftStar', '점성 14', '아끼는 별빛', AR_ACC, '고급', 0.15, 'pct', '별빛 치유 마나 소모 −{v}', { hero: 'astrologer', cap: 0.4, skillMod: { key: 'starHeal', kind: 'cost' } }],
    ['sleepReturn', '점성 15', '잠의 귀환', AR, '희귀', 0.12, 'pct', '별의 잠 재사용 대기 −{v}', { hero: 'astrologer', cap: 0.3, skillMod: { key: 'starSleep', kind: 'cooldown' } }],
    ['memoryReturn', '점성 16', '기억의 귀환', NECK, '영웅', 0.2, 'pct', '별의 기억 재사용 대기 −{v}', { hero: 'astrologer', cap: 0.4, skillMod: { key: 'starMemory', kind: 'cooldown' } }],
    ['shardMana', '점성 17', '조각의 마나', W_ACC, '고급', 0.2, 'mana', '별 조각을 쓰면 조각마다 마나 {v} 회복', { hero: 'astrologer', cap: 0.5 }],
    ['readMore', '점성 18', '더 읽는 별', ALL, '고급', 0.08, 'pct', '보스 예고가 찍힌 아군에게 하는 힐 +{v}', { hero: 'astrologer', cap: 0.3 }],
    ['markEcho', '점성 19', '옮겨 가는 표식', ACC, '희귀', 1, 'n', '표식 보너스를 쓰면 표식이 옆 칸에서 표식이 없는 다친 아군 1명에게 옮겨 감', { hero: 'astrologer', fixed: true }],
    ['clearMark', '점성 20', '맑은 표식', HANDS, '고급', 1, 'n', '맑은 별빛으로 디버프를 지우면 대상에게 표식', { hero: 'astrologer', fixed: true }],
    ['polarisCd', '점성 21', '북극성의 순환', CHEST, '고급', 0.12, 'pct', '북극성 재사용 대기 −{v}', { hero: 'astrologer', cap: 0.3, skillMod: { key: 'polaris', kind: 'cooldown' } }],
    ['fallCd', '점성 22', '별비의 순환', W_ACC, '희귀', 0.3, 'pct', '별비 재사용 대기 −{v}', { hero: 'astrologer', cap: 0.45, skillMod: { key: 'starfall', kind: 'cooldown' } }],
    ['perfectHaste', '점성 23', '가득 찬 별의 서두름', HEAD, '희귀', 0.2, 'pct', '가득 찬 별자리 뒤 4초 동안 가속 +{v}', { hero: 'astrologer', cap: 0.4 }],
    ['shardStart', '점성 24', '품고 온 조각', NECK, '영웅', 2, 'n', '전투 시작에 별 조각 {v}개', { hero: 'astrologer', fixed: true }],
    // 결계사 (79 5-8). 전용 장비 밸런스로 21종을 낮추고 곧은 인장 하나만 올림 (79 5-11)
    ['deepSeal', '결계 01', '깊은 인장', ALL, '희귀', 0.03, 'pct', '심판 회복량 +{v}', { cap: 0.1, hero: 'warder' }],
    ['mirrorBarrier', '결계 02', '거울 막', W, '전설', 0.2, 'pct', '빛의 막이 다 깨지면 붙어 있는 가장 다친 아군에게 그 막 두께의 {v}만큼 막', { hero: 'warder', fixed: true }],
    ['hastySpear', '결계 03', '서두른 굳히기', HANDS, '영웅', 2, 'sec', '결계 굳히기 재사용 −{v}', { hero: 'warder' }],
    ['longGuard', '결계 04', '긴 수호', AR, '영웅', 1, 'sec', '수호 결계 보호막 시간 +{v}', { hero: 'warder' }],
    ['firmVeil', '결계 05', '굳은 장막', W, '전설', 0.3, 'pct', '빛의 장막 보호막 +{v}', { hero: 'warder', fixed: true }], // 82: 장막이 전원 보호막이 되어 피해 감소 +5%p → 보호막 +30%
    ['sealHaste', '결계 06', '서두른 인장', HANDS, '영웅', 0.2, 'sec', '인장 치유 시전 −{v}', { hero: 'warder' }],
    ['longVeil', '결계 07', '긴 장막', ACC, '영웅', 1, 'sec', '빛의 장막 보호막 시간 +{v}', { hero: 'warder', fixed: true }],
    ['spearJudge', '결계 08', '굳힌 뒤의 심판', NECK, '영웅', 0.3, 'sec', '결계 굳히기를 쓰면 다음 심판 시전 −{v}', { hero: 'warder' }],
    ['steadySeal', '결계 09', '곧은 인장', ALL, '고급', 0.15, 'pct', '인장 치유 회복량 +{v}', { hero: 'warder', cap: 0.4, skillMod: { key: 'sealHeal', kind: 'heal' } }],
    ['swiftSeal', '결계 10', '가벼운 심판', HANDS, '희귀', 0.06, 'pct', '심판 마나 소모 −{v}', { hero: 'warder', cap: 0.4, skillMod: { key: 'judgment', kind: 'cost' } }],
    ['thickCircle', '결계 11', '두꺼운 원', W_ACC, '희귀', 0.05, 'pct', '결계 원 보호막 +{v}', { hero: 'warder', cap: 0.4, skillMod: { key: 'wardCircle', kind: 'heal' } }],
    ['denseBarrier', '결계 12', '촘촘한 막', AR_ACC, '희귀', 0.05, 'pct', '빛의 막 보호막 +{v}', { hero: 'warder', cap: 0.4, skillMod: { key: 'lightBarrier', kind: 'heal' } }],
    ['sharpSpear', '결계 13', '두꺼운 굳히기', W_ACC, '영웅', 0.06, 'pct', '결계 굳히기로 더하는 두께 +{v}', { hero: 'warder', cap: 0.4, skillMod: { key: 'wardHold', kind: 'heal' } }],
    ['thriftBarrier', '결계 14', '아끼는 막', AR_ACC, '고급', 0.12, 'pct', '빛의 막 마나 소모 −{v}', { hero: 'warder', cap: 0.4, skillMod: { key: 'lightBarrier', kind: 'cost' } }],
    ['guardReturn', '결계 15', '수호의 귀환', AR, '희귀', 0.05, 'pct', '수호 결계 재사용 대기 −{v}', { hero: 'warder', cap: 0.3, skillMod: { key: 'guardWard', kind: 'cooldown' } }],
    ['veilReturn', '결계 16', '장막의 귀환', NECK, '영웅', 0.05, 'pct', '빛의 장막 재사용 대기 −{v}', { hero: 'warder', cap: 0.3, skillMod: { key: 'lightVeil', kind: 'cooldown' } }],
    ['judgeMana', '결계 17', '심판의 마나', W_ACC, '고급', 0.05, 'mana', '심판이 회복한 1명마다 마나 {v} 회복', { hero: 'warder', cap: 0.3 }],
    ['sealTouch', '결계 18', '인장 손길', ALL, '고급', 0.06, 'pct', '인장이 붙은 아군에게 쓰는 인장 치유 +{v}', { hero: 'warder', cap: 0.3 }],
    ['barrierSeal', '결계 19', '막의 인장', ACC, '희귀', 1, 'n', '보호막이 다 깨지면 그 아군 인장 시간이 처음으로', { hero: 'warder', fixed: true }],
    ['cleanSeal', '결계 20', '맑은 인장', HANDS, '고급', 1, 'n', '결계 정화로 디버프를 지우면 대상에게 인장', { hero: 'warder', fixed: true }],
    ['judgeHit', '결계 21', '심판의 막', CHEST, '고급', 0.1, 'pct', '심판이 회복한 아군에게 회복량의 {v}만큼 보호막 (6초)', { hero: 'warder', cap: 0.5 }],
    ['circleCd', '결계 22', '원의 순환', W_ACC, '희귀', 0.05, 'pct', '결계 원 재사용 대기 −{v}', { hero: 'warder', cap: 0.3, skillMod: { key: 'wardCircle', kind: 'cooldown' } }],
    ['shieldHaste', '결계 23', '막의 서두름', HEAD, '희귀', 0.03, 'pct', '나에게 보호막이 있으면 가속 +{v}', { hero: 'warder', cap: 0.1 }],
    ['brokenMore', '결계 24', '더 밝은 깨짐', NECK, '영웅', 0.3, 'pct', '깨진 막의 빛 회복량 +{v}', { hero: 'warder', cap: 1 }],
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
 * 직업마다 스킬 구조상 효과가 0인 공통 특수능력 (QA 2026-10-15 · 2026-10-16 Lim 「그 직업으로 돌 때 드롭 · 재설정에서 빼기」, 재설정은 2026-10-21 없앰).
 * 결계사는 지속 힐이 없고, 수도사는 시전 힐이 없고, 드루이드 광역은 지속 힐뿐, 주술사는 즉시 직접 힐이 없고, 점성술사 공대 쿨기 (별의 기억)는 즉시
 */
export const NO_EFFECT: Record<string, HeroKey[]> = {
  lingerLight: ['warder'], layer: ['warder'], fireflies: ['warder'], sturdyBack: ['warder'], leadOn: ['warder'],
  slowHand: ['monk'], windStep: ['monk'],
  goldEcho: ['druid'], holdTogether: ['druid'],
  quickAid: ['shaman'],
  longSong: ['astrologer'],
};
for (const [k, hs] of Object.entries(NO_EFFECT)) SPECS[k].noHero = hs;
/** 그 직업에 효과가 있는 특수능력 (직업을 모르면 true) */
export const specUseful = (key: string, hero?: HeroKey): boolean => !hero || !SPECS[key]?.noHero?.includes(hero);

/**
 * 이름 있는 장신구 (42 3장): 장소 고유 목걸이 · 반지. 전설만 (Lim 2026-10-11 「전설에만 고유 능력」), 고유 효과가 그 전설의 고유 능력.
 * place = 떨어지는 장소: 20인 레이드 31구역에 열림 레벨 순으로 고르게 (Lim 2026-10-11 「20인 악몽으로 모음」, 61 3-4), 그 구역 악몽 전설에서만.
 * 목걸이가 47개라 한 구역에 목걸이가 둘 · 셋인 곳이 있음 (namedsFor가 목록). 아래 묶음 주석은 처음 만든 곳. 같은 이름 있는 장신구는 하나만 낄 수 있음
 */
export interface NamedDef {
  key: string; name: string; slot: 'neck' | 'ring'; place: string; placeName: string; text: string; val: number; unit: SpecUnit; cd?: number;
  /** 예전 최소 등급 (지금은 전설만 나와서 쓰지 않음) */
  min?: ItemGrade;
}
export const NAMED: NamedDef[] = [
  { key: 'rustyCog', name: '녹슨 톱니', slot: 'neck', place: 'cathedral3', placeName: '가라앉은 대성당 오르간', text: '치유를 시전하면 10% 확률로 10초 동안 가속 +{v} (재사용 20초)', val: 0.15, unit: 'pct', cd: 20 },
  { key: 'plagueCenser', name: '역병 향로', slot: 'neck', place: 'cathedral4', placeName: '가라앉은 대성당 성소', text: '해제하면 대상에게 지능 {v} 보호막 (재사용 15초)', val: 0.6, unit: 'pct', cd: 15 },
  { key: 'toadCharm', name: '두꺼비 부적', slot: 'neck', place: 'abbey2', placeName: '물밑 수도원 서고', text: '마나 30% 아래로 내려가면 12초 동안 정신력 +{v} (전투당 1번)', val: 0.6, unit: 'pct' },
  { key: 'ladyPortrait', name: '귀부인의 초상', slot: 'neck', place: 'rootwood1', placeName: '빛뿌리 숲 입구', text: '체력 30% 아래 아군에게 하는 직접 힐 +{v}', val: 0.2, unit: 'pct' },
  { key: 'frozenHourglass', name: '얼어붙은 모래시계', slot: 'ring', place: 'abbey1', placeName: '물밑 수도원 연못', text: '공대 쿨기를 쓰면 15초 동안 마나 소모 −{v}', val: 0.3, unit: 'pct' },
  { key: 'templeVial', name: '신전 성수병', slot: 'neck', place: 'rootwood3', placeName: '빛뿌리 숲 심장뿌리', text: '광역 힐이 4명 이상 회복하면 6초 동안 치명타 +{v}', val: 0.1, unit: 'pct' },
  // 묶음 A (39 4장, 이름 임시 · 그림 44 G)
  { key: 'scrapWhistle', name: '고철 호루라기', slot: 'neck', place: 'cathedral1', placeName: '가라앉은 대성당 1구역', text: '탱커가 버스터를 맞으면 3초 동안 탱커에게 하는 힐 +{v}', val: 0.25, unit: 'pct', min: '고급' },
  { key: 'graveLantern', name: '묘지기 등불', slot: 'neck', place: 'cathedral2', placeName: '가라앉은 대성당 회랑', text: '지속 힐이 끝까지 가면 마나 {v} 돌려받음 (2초에 한 번)', val: 1, unit: 'mana', min: '고급' },
  { key: 'leechJar', name: '거머리 병', slot: 'ring', place: 'cathedral2', placeName: '가라앉은 대성당 회랑', text: '아군을 체력 100%까지 채우면 4초 동안 가속 +{v} (재사용 10초)', val: 0.1, unit: 'pct', cd: 10, min: '고급' },
  { key: 'lilyCorsage', name: '백합 코사지', slot: 'neck', place: 'abbey1', placeName: '물밑 수도원 연못', text: '4초 안에 서로 다른 3명에게 직접 힐하면 다음 직접 힐 마나 소모 −{v} (재사용 15초)', val: 1, unit: 'pct', cd: 15, min: '고급' },
  { key: 'snowCrystal', name: '눈꽃 결정', slot: 'neck', place: 'abbey3', placeName: '물밑 수도원 제단', text: '보스 기술에 시전이 끊기면 마나 {v} 돌려받음', val: 3, unit: 'mana', min: '고급' },
  { key: 'pilgrimCharm', name: '순례자 부적', slot: 'neck', place: 'cathedral4', placeName: '가라앉은 대성당 성소', text: '파티 전원이 체력 70% 이상이면 정신력 +{v}', val: 0.3, unit: 'pct', min: '고급' },
  { key: 'wornRosary', name: '닳은 묵주', slot: 'neck', place: 'rootwood2', placeName: '빛뿌리 숲 온실', text: '바로 앞에 해제한 것과 다른 유형을 해제하면 해제 재사용 대기 −{v}', val: 1, unit: 'sec', min: '고급' }, // 해제 4초 (2026-10-12)에 맞춰 2 → 1
  { key: 'blackStone', name: '검은 돌 부적', slot: 'neck', place: 'abbey2', placeName: '물밑 수도원 서고', text: '옆 칸에 아군이 없는 아군에게 하는 힐 +{v}', val: 0.15, unit: 'pct', min: '고급' },
  { key: 'ropeKnot', name: '밧줄 매듭', slot: 'ring', place: 'abbey3', placeName: '물밑 수도원 제단', text: '아군이 2초 안에 최대 체력의 30% 넘게 잃으면 그 아군에게 지능 {v} 보호막 (재사용 20초)', val: 0.5, unit: 'pct', cd: 20 },
  { key: 'lordIncense', name: '군주의 향 주머니', slot: 'neck', place: 'reservoir1', placeName: '별빛 저수지 수문', text: '디버프가 2개 이상 보이는 아군에게 하는 힐 +{v}', val: 0.15, unit: 'pct' },
  { key: 'brokenChain', name: '끊어진 사슬', slot: 'ring', place: 'rootwood1', placeName: '빛뿌리 숲 입구', text: '내 체력이 50% 아래가 되면 8초 동안 내게 하는 힐 +{v} (재사용 60초)', val: 0.3, unit: 'pct', cd: 60 },
  // 묶음 B 옛 세력 (46 6장, 이름 임시 · 그림 47)
  { key: 'silverBookmark', name: '은빛 책갈피', slot: 'ring', place: 'rootwood2', placeName: '빛뿌리 숲 온실', text: '마나 50% 아래에서 단일 힐 마나 소모 −{v}', val: 0.15, unit: 'pct', min: '고급' },
  { key: 'sluiceKey', name: '녹슨 수문 열쇠', slot: 'ring', place: 'rootwood3', placeName: '빛뿌리 숲 심장뿌리', text: '해제한 디버프가 이웃에게 옮겨붙으면 옮겨 간 아군에게 지능 {v} 회복', val: 0.4, unit: 'pct' },
  { key: 'frozenQuill', name: '얼어붙은 깃펜', slot: 'ring', place: 'reservoir2', placeName: '별빛 저수지 다리', text: '내게 디버프가 걸려 있는 동안 정신력 +{v}', val: 0.3, unit: 'pct' },
  { key: 'roseBrooch', name: '장미 브로치', slot: 'neck', place: 'well2', placeName: '숨결 우물 이끼벽', text: '넘친 치유가 그 힐의 절반을 넘으면 4초 동안 회복량 +{v} (재사용 8초)', val: 0.08, unit: 'pct', cd: 8, min: '고급' },
  { key: 'heirSeal', name: '가주의 인장', slot: 'ring', place: 'reservoir3', placeName: '별빛 저수지 거울호수', text: '사슬로 묶인 아군에게 하는 힐 +{v}', val: 0.15, unit: 'pct' },
  // 묶음 B 짠물 해적단 (46 6장): 탐험 ⑨ ⑪, 10인 ②~④ 마지막 칸
  { key: 'conchShell', name: '소라 껍데기', slot: 'neck', place: 'reservoir2', placeName: '별빛 저수지 다리', text: '터지는 디버프 (부풀기 · 함정 · 터지는 마력)를 지우면 대상과 이웃 칸 아군에게 지능 {v} 보호막 (재사용 15초)', val: 0.3, unit: 'pct', cd: 15, min: '고급' },
  { key: 'luckyCoin', name: '앞면 금화', slot: 'ring', place: 'reservoir1', placeName: '별빛 저수지 수문', text: '체력 40~60% 아군에게 하는 직접 힐 +{v}', val: 0.12, unit: 'pct', min: '고급' },
  { key: 'lighthouseEmber', name: '등대 불씨', slot: 'neck', place: 'rootwood1', placeName: '빛뿌리 숲 입구', text: '보스 큰 기술 예고가 떠 있는 동안 광역 힐 +{v}', val: 0.15, unit: 'pct' },
  { key: 'sailorCompass', name: '선원의 나침반', slot: 'neck', place: 'reservoir3', placeName: '별빛 저수지 거울호수', text: '치유 상한 · 받는 치유 감소가 걸린 아군에게 하는 힐 +{v}', val: 0.2, unit: 'pct' },
  { key: 'goldButton', name: '금빛수염 단추', slot: 'neck', place: 'well1', placeName: '숨결 우물 도르래', text: '디버프가 끝나거나 지워진 아군에게 하는 다음 직접 힐 +{v}', val: 0.25, unit: 'pct' },
  // 묶음 C (48 6장, 이름 임시 · 그림 49): 탐험 ⑬ ⑮ · 던전 ⑪ ⑫
  { key: 'lampGlass', name: '꼬마등 유리병', slot: 'ring', place: 'well1', placeName: '숨결 우물 도르래', text: '디버프를 지울 때 대상 체력이 50% 아래면 그 아군에게 지능 {v} 보호막 (재사용 12초)', val: 0.25, unit: 'pct', cd: 12, min: '고급' },
  { key: 'chippedCup', name: '이 빠진 찻잔', slot: 'ring', place: 'well2', placeName: '숨결 우물 이끼벽', text: '치유 흡수 막이 걸린 아군에게 하는 힐 +{v}', val: 0.2, unit: 'pct' },
  { key: 'dragonScale', name: '용 비늘 조각', slot: 'ring', place: 'well3', placeName: '숨결 우물 바닥', text: '독이 걸린 아군에게 하는 힐 +{v}', val: 0.12, unit: 'pct', min: '고급' },
  { key: 'turtleCharm', name: '거북 등딱지 부적', slot: 'neck', place: 'crystal3', placeName: '수정 뿌리굴 거울방', text: '내 마나 30% 아래에서 내가 받는 피해 −{v}', val: 0.15, unit: 'pct' },
  { key: 'festInvite', name: '축제 초대장', slot: 'neck', place: 'well3', placeName: '숨결 우물 바닥', text: '딜을 못 하는 아군 (춤바람 · 감옥 · 삼키기 · 침묵)에게 하는 직접 힐 +{v}', val: 0.2, unit: 'pct' },
  { key: 'rainbowSpore', name: '무지개 포자', slot: 'neck', place: 'crystal2', placeName: '수정 뿌리굴 수정밭', text: '사람 칸 (헤매는 영혼 · 등대지기 · 숲 할아버지)에게 하는 힐 +{v}', val: 0.25, unit: 'pct', min: '고급' },
  { key: 'mossBrooch', name: '이끼 브로치', slot: 'neck', place: 'crystal1', placeName: '수정 뿌리굴 갈림길', text: '무력화 게이지가 모이는 동안 광역 힐 +{v}', val: 0.12, unit: 'pct' },
  { key: 'amanitaShard', name: '광대버섯 왕관 조각', slot: 'neck', place: 'well1', placeName: '숨결 우물 도르래', text: '해제하면 {v} 확률로 이웃 칸 아군 1명의 같은 유형 디버프도 함께 지움', val: 0.3, unit: 'pct' },
  // 묶음 D1 (51 6장, 이름 임시 · 그림 52): 10인 ⑧ 마지막 칸 · 탐험 ⑯ · 던전 ⑬ ⑭
  { key: 'koboldWarrant', name: '코볼트 임명장', slot: 'neck', place: 'shadow1', placeName: '그림자 성벽 성문', text: '체력 90% 위인 아군에게 거는 보호막 +{v}', val: 0.2, unit: 'pct' },
  { key: 'warmPebble', name: '따끈한 조약돌', slot: 'ring', place: 'crystal1', placeName: '수정 뿌리굴 갈림길', text: '내가 건 보호막이 깨지거나 녹아 없어지면 그 아군에게 지능 {v} 회복 (재사용 6초)', val: 0.08, unit: 'pct', cd: 6, min: '고급' },
  { key: 'spaTowel', name: '온천 수건', slot: 'neck', place: 'shadow2', placeName: '그림자 성벽 성벽길', text: '큰 피해 예고가 2초 안에 맞을 때 거는 보호막 +{v}', val: 0.25, unit: 'pct' },
  { key: 'coldAnvil', name: '식은 모루 조각', slot: 'neck', place: 'shadow3', placeName: '그림자 성벽 망루', text: '무력화 게이지가 모이는 동안 파티원이 받는 피해 −{v}', val: 0.1, unit: 'pct' },
  // 묶음 D2 (51 6장, 이름 임시 · 그림 52): 10인 ⑨ 마지막 칸 · 탐험 ⑰ · 20인 ① 마지막 칸
  { key: 'rubinaPearl', name: '루비나의 진주', slot: 'neck', place: 'crystal1', placeName: '수정 뿌리굴 갈림길', text: '보물 욕심 · 사냥 대상이 된 아군에게 하는 직접 힐 +{v}', val: 0.15, unit: 'pct' },
  { key: 'lakePebble', name: '호숫가 조약돌', slot: 'ring', place: 'crystal2', placeName: '수정 뿌리굴 수정밭', text: '생명 사슬이 걸린 아군에게 하는 힐 +{v}', val: 0.15, unit: 'pct', min: '고급' },
  { key: 'threeShards', name: '세 조각 목걸이', slot: 'neck', place: 'crystal2', placeName: '수정 뿌리굴 수정밭', text: '사람 칸 (조각 · 영혼 · 나무)에게 하는 힐 +{v}', val: 0.25, unit: 'pct' },
  // 묶음 E1 (54 6장, 이름 임시 · 그림 55): 10인 ⑩ 마지막 칸 · 탐험 ⑱ · 20인 ② 마지막 칸 · 던전 ⑮
  { key: 'riddleNote', name: '냥크스의 수수께끼 쪽지', slot: 'neck', place: 'camp1', placeName: '그림자 진영 막사', text: '신기루가 걷힌 뒤 1초 안에 하는 직접 힐 +{v}', val: 0.2, unit: 'pct' },
  { key: 'jellyLight', name: '해파리 불빛', slot: 'ring', place: 'crystal3', placeName: '수정 뿌리굴 거울방', text: '고리 · 장판 안 아군에게 하는 힐 +{v}', val: 0.12, unit: 'pct', min: '고급' },
  { key: 'prayerKnot', name: '깊은잠의 기도 매듭', slot: 'neck', place: 'camp2', placeName: '그림자 진영 훈련장', text: '완치 표식 대상에게 하는 힐 +{v}', val: 0.2, unit: 'pct' },
  { key: 'backSand', name: '거꾸로 모래알', slot: 'ring', place: 'shadow1', placeName: '그림자 성벽 성문', text: '모래시계가 체력을 되돌릴 때 마나 {v} 회복', val: 3, unit: 'mana' },
  // 묶음 E2 (54 6장, 이름 임시 · 그림 55): 10인 ⑪ 마지막 칸 · 탐험 ⑲ · 20인 ③ 마지막 칸
  { key: 'featherBrooch', name: '사라샤의 깃털 브로치', slot: 'neck', place: 'camp3', placeName: '그림자 진영 지휘소', text: '모래시계를 뒤집기 전 3초 (예고) 동안 하는 힐 +{v}', val: 0.15, unit: 'pct' },
  { key: 'camelYarn', name: '낙타 털실 반지', slot: 'ring', place: 'shadow2', placeName: '그림자 성벽 성벽길', text: '진동 뒤 2초 동안 시전 시간 −{v}', val: 0.15, unit: 'pct', min: '고급' },
  { key: 'heartShard', name: '심장뿌리 조각', slot: 'neck', place: 'shadow2', placeName: '그림자 성벽 성벽길', text: '뒤집힘 저주가 걸린 아군이 체력 40~60%이면 받는 피해 −{v}', val: 0.15, unit: 'pct' },
  // 묶음 E3 (54 6장, 이름 임시 · 그림 55): 10인 ⑫ 마지막 칸 · 20인 ④ 마지막 칸 · 탐험 ⑳ · 던전 ⑯
  { key: 'nightcapTassel', name: '하품호텝의 수면 모자 술', slot: 'neck', place: 'coast1', placeName: '어둠물 해안 선착장', text: '피난처 예고 동안 아직 안전 칸에 못 들어간 아군에게 하는 힐 +{v}', val: 0.2, unit: 'pct' },
  { key: 'echoDrop', name: '되울림의 물방울', slot: 'neck', place: 'shadow3', placeName: '그림자 성벽 망루', text: '신기루가 걷히거나 모래시계가 되돌릴 때 가장 낮은 아군 2명 지능 {v} 회복', val: 0.5, unit: 'pct' },
  { key: 'pinwheelPin', name: '바람개비 핀', slot: 'ring', place: 'camp1', placeName: '그림자 진영 막사', text: '끌려온 아군에게 하는 힐 +{v}', val: 0.15, unit: 'pct', min: '고급' },
  { key: 'starMap', name: '별 지도 조각', slot: 'neck', place: 'coast2', placeName: '어둠물 해안 물길', text: '파티원이 보스 시전을 끊은 뒤 6초 동안 파티 받는 피해 −{v}', val: 0.08, unit: 'pct' },
  // 묶음 F1 (56 6장, 이름 임시 · 그림 57): 20인 ⑤ 마지막 칸 · 10인 ⑬ 마지막 칸 · 탐험 ㉑ · 던전 ⑰
  { key: 'breathFlask', name: '후우의 숨결 병', slot: 'neck', place: 'coast3', placeName: '어둠물 해안 소용돌이', text: '넘치는 빛 그릇에 모이는 넘친 치유 +{v}', val: 0.25, unit: 'pct' },
  { key: 'postStamp', name: '부리부리의 우표', slot: 'neck', place: 'camp2', placeName: '그림자 진영 훈련장', text: '띄워 올려진 아군이 내려올 때 지능 {v} 보호막 (6초)', val: 0.4, unit: 'pct' },
  { key: 'fleeceRing', name: '복슬 양털 반지', slot: 'ring', place: 'camp3', placeName: '그림자 진영 지휘소', text: '번개 구름이 뜬 아군의 이웃에게 하는 힐 +{v}', val: 0.12, unit: 'pct', min: '고급' },
  { key: 'millVane', name: '풍차 날개 조각', slot: 'ring', place: 'coast1', placeName: '어둠물 해안 선착장', text: '떠 있는 아군이 받는 지속 힐 +{v}', val: 0.2, unit: 'pct' },
  // 묶음 F2 (56 6장): 20인 ⑥ 거울방 · 10인 ⑭ 꼭대기
  { key: 'prism', name: '빛갈래의 프리즘', slot: 'neck', place: 'heart1', placeName: '심연의 심장 뿌리다리', text: '연쇄 번개가 피뢰침에서 멈추면 그 아군 지능 {v} 회복', val: 0.5, unit: 'pct' },
  // 묶음 F3 (56 6장): 탐험 ㉒ · 20인 ⑦ 망루 · 던전 ⑱
  { key: 'broomTicket', name: '빗자루 승차권', slot: 'ring', place: 'coast2', placeName: '어둠물 해안 물길', text: '넘치는 빛 그릇이 가득 차면 마나 {v} 회복', val: 2, unit: 'mana', min: '고급' },
  { key: 'shadowVeil', name: '어둑이의 그림자 휘장', slot: 'neck', place: 'heart3', placeName: '심연의 심장 심실', text: '신기루가 걷히거나 띄워진 아군이 내려올 때 가장 낮은 아군 1명에게 지능 {v} 보호막 (6초)', val: 0.5, unit: 'pct' },
  { key: 'diploma', name: '뒤죽박죽 졸업장', slot: 'neck', place: 'coast2', placeName: '어둠물 해안 물길', text: '뒤집힘 저주가 끝날 때 그 아군이 체력 40~60%이면 지능 {v} 보호막 (6초)', val: 0.5, unit: 'pct' },
  { key: 'stormWedge', name: '우르릉의 번개 쐐기', slot: 'neck', place: 'heart2', placeName: '심연의 심장 심장문', text: '다른 탱커가 띄워 올려진 동안 남은 탱커에게 하는 힐 +{v}', val: 0.25, unit: 'pct' },
  // 묶음 G1 (59 6장): 10인 ⑮ 중심 · 20인 ⑧ 지휘소 · 탐험 ㉓ · 던전 ⑲
  { key: 'mazeMap', name: '밤그늘의 미궁 지도', slot: 'neck', place: 'coast3', placeName: '어둠물 해안 소용돌이', text: '빚진 아군에게 하는 힐 +{v}', val: 0.2, unit: 'pct' },
  { key: 'knightBanner', name: '칠흑의 기사단 휘장', slot: 'neck', place: 'coast3', placeName: '어둠물 해안 소용돌이', text: '신기루가 걷히면 진짜 번개 구름 대상의 이웃 가운데 낮은 2명에게 지능 {v} 보호막 (6초)', val: 0.3, unit: 'pct' },
  { key: 'wetGlove', name: '마부의 젖은 장갑', slot: 'ring', place: 'coast3', placeName: '어둠물 해안 소용돌이', text: '어둠물에 잠긴 아군에게 하는 힐 +{v}', val: 0.12, unit: 'pct', min: '고급' },
  { key: 'wetScore', name: '세레나의 젖은 악보', slot: 'neck', place: 'heart1', placeName: '심연의 심장 뿌리다리', text: '어둠물이 빠지는 순간 잠겨 있던 아군 모두 지능 {v} 회복', val: 0.2, unit: 'pct' },
  // 묶음 G2 (59 6장): 20인 ⑨ 소용돌이 · 탐험 ㉔
  { key: 'moonBowl', name: '검은물결의 달빛 그릇', slot: 'neck', place: 'heart1', placeName: '심연의 심장 뿌리다리', text: '넘치는 빛 그릇에 모이는 넘친 치유 +{v}, 빚을 갚은 넘친 치유도 절반이 그릇에', val: 0.25, unit: 'pct' },
  { key: 'debtLantern', name: '꺼지지 않는 등불', slot: 'ring', place: 'heart2', placeName: '심연의 심장 심장문', text: '넘친 치유가 빚진 아군의 빚을 갚는 양 +{v}', val: 0.2, unit: 'pct', min: '고급' },
  // 묶음 G3 (59 6장): 20인 ⑩ 심실 · 탐험 ㉕ · 던전 ⑳
  { key: 'stillHeart', name: '멈춘 심장 조각', slot: 'neck', place: 'heart2', placeName: '심연의 심장 심장문', text: '크게 뛰기 (시전 불가)가 끝나면 2초 동안 가속 +{v}', val: 0.3, unit: 'pct' },
  { key: 'dawnPebble', name: '첫 햇살 조약돌', slot: 'ring', place: 'heart3', placeName: '심연의 심장 심실', text: '퍼지는 박동에 맞은 아군에게 하는 다음 직접 힐 +{v}', val: 0.15, unit: 'pct', min: '고급' },
  { key: 'shadowScale', name: '마지막 그림자의 저울', slot: 'neck', place: 'heart3', placeName: '심연의 심장 심실', text: '빌린 생명의 빚을 다 갚으면 그 아군에게 지능 {v} 보호막 (6초)', val: 0.4, unit: 'pct' },
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
/** 그 장소 · 부위에서 나오는 이름 있는 장신구 (20인 구역, 같은 부위가 여럿이면 그중 하나가 고르게 나옴) */
export const namedsFor = (place: string, slot: SlotKey) => NAMED.filter(n => n.place === place && n.slot === slot);

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
  // 묶음 B (46 6장): 책갈피 설원 = 마나 갈취 · 침묵 / 장미 울타리 미로 = 넘치는 빛
  bookfield: ['springSip', 'potionRegular', 'spellWard'],
  rosemaze: ['bubble', 'overflowKind', 'lightBreath'],
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
  // 역병 수로 (던전 ⑧): 질병 옮겨붙음 · 지속 피해 / 얼음 서고 (⑨): 역류 · 마나 갈취 · 차례 / 백합 납골당 (⑩): 뒤집힌 축복 · 저주 · 넘치는 빛
  sewer: ['coldMedicine', 'immuneIncense', 'warmCloak'],
  archive: ['stillMoment', 'cleanHands', 'numberSense'],
  ossuary: ['clearEye', 'curseBreak', 'bigBowl'],
  abyss1: ['coldMedicine', 'cleanHands', 'bounceLight'],
  // 심연의 탑 2층 ~ 꼭대기: 못 지우는 독 · 머리 파열 / 탱커 교대 · 저주 / 함정 · 마법 · 즉시 스킬 / 감옥 · 탱커 막 · 해제 4유형
  abyss2: ['antidote', 'warmCloak', 'eliteHunter'],
  abyss3: ['prop', 'holdingHand', 'curseBreak'],
  abyss4: ['trapSense', 'spellWard', 'pouch'],
  abyss5: ['cleanHands', 'chainBreaker', 'heartyMeal'],
  cathedral1: ['spellWard', 'strongChorus', 'goldEcho'],
  // 짠물 해적단 (46 6장): 조개껍데기 해변 (부풀기 · 독 · 저주) / 난파선 모래톱 (뒤집힘 · 저주)
  shellbeach: ['trapSense', 'antidote', 'thankHand'],
  wreck: ['curseBreak', 'kindCrit', 'wishStar'],
  // 갈매기 항구: 부두 (부풀기 · 탱커 교대) / 주방 (큰 쫄 · 두 탱커) / 등대 (피난처 · 부풀기)
  gull1: ['antidote', 'trapSense', 'prop'],
  gull2: ['eliteHunter', 'shieldFriend', 'wideEmbrace'],
  gull3: ['shelterMap', 'antidote', 'starVeil'],
  // 짠물 여왕호: 갑판 (폭탄 · 자폭 쫄 · 줄) / 창고 (감옥 · 치유 상한) / 뱃머리 (사슬 · 상한)
  queen1: ['bombSquad', 'eliteHunter', 'shelterMap'],
  queen2: ['chainBreaker', 'holdingHand', 'antidote'],
  queen3: ['holdingHand', 'curseBreak', 'evenly'],
  // 보물섬 요새: 동굴 (마나 갈취 · 삼키기) / 망루 (차례 · 느린 시전) / 꼭대기 (뒤집힘 · 낮은 사람)
  isle1: ['potionRegular', 'springSip', 'chainBreaker'],
  isle2: ['numberSense', 'quickAid', 'windStep'],
  isle3: ['sunrise', 'edgeTouch', 'curseBreak'],
  // 묶음 C (48 6장): 꼬마등 오솔길 (포자 · 질병) / 끝없는 다과회 (포자 · 모자 · 진동) / 불꽃 봉우리 기슭 (자폭 쫄 · 독) / 이끼 뿌리 사원 (고리 · 무력화 · 독)
  lampway: ['coldMedicine', 'cleanHands', 'restTea'],
  teaparty: ['firstCup', 'coldMedicine', 'holdingHand'],
  emberfoot: ['antidote', 'bombSquad', 'hardShell'],
  mossroot: ['antidote', 'holdTogether', 'numberSense'],
  // 묶음 C2 (48 6장): 무지개 버섯밭 (사람 칸 · 질병) / 10인 ⑤ 고리 · 춤 · 피난처 / ⑥ 무력화 · 사슬 · 치유하는 쫄 / ⑦ 쇠약 · 차례 · 수장
  rainbow: ['rainbow', 'coldMedicine', 'layer'],
  fest1: ['shelterMap', 'coldMedicine', 'prop'],
  fest2: ['cutBeat', 'eliteHunter', 'wideEmbrace'],
  fest3: ['shelterMap', 'bombSquad', 'starVeil'],
  cave1: ['coldMedicine', 'holdTogether', 'numberSense'],
  cave2: ['holdingHand', 'shieldFriend', 'twinShield'],
  cave3: ['eliteHunter', 'spellWard', 'evenly'],
  palace1: ['woundClean', 'evenly', 'coldMedicine'],
  palace2: ['numberSense', 'spellWard', 'quickAid'],
  palace3: ['sunrise', 'bigBowl', 'coldMedicine'],
  // 묶음 D1 (51 6장): 10인 ⑧ 갱도 (폭탄 · 독 · 탱커 교대) / 수레길 (보물 욕심 · 줄) / 보물방 (욕심 × 사냥 · 금화 더미),
  // 화산재 고갯길 (녹는 보호막 쉬움 · 독) / 용암 온천장 (녹는 보호막 · 욕심 · 불씨) / 용암 대장간 (무력화 · 진동 · 해제 없음)
  den1: ['bombSquad', 'antidote', 'shieldFriend'],
  den2: ['hardShell', 'evenly', 'quickAid'],
  den3: ['evenly', 'kindCrit', 'starVeil'],
  ashpass: ['antidote', 'layer', 'firstWord'],
  hotspring: ['hardShell', 'antidote', 'holdingHand'],
  forge: ['cutBeat', 'holdTogether', 'hardShell'],
  // 묶음 D2 (51 6장): 10인 ⑨ 알둥지 (알 · 독) / 다리 (탱커 교대 · 녹는 보호막) / 보물더미 (D 부품 모두), 잠긴 호숫가 (사슬 쉬움),
  // 20인 대성당 회랑 (사슬 3쌍 · 끌어당김) / 오르간 (무력화 · 진동 · 상한) / 성소 (욕심 · 사람 칸 · 녹는 보호막)
  nest1: ['eliteHunter', 'antidote', 'wideEmbrace'],
  nest2: ['shieldFriend', 'twinShield', 'layer'],
  nest3: ['sunrise', 'evenly', 'starClock'],
  lakeshore: ['holdTogether', 'constellation', 'evenly'],
  cathedral2: ['holdTogether', 'evenly', 'holdingHand'],
  cathedral3: ['numberSense', 'spellWard', 'bigBowl'],
  cathedral4: ['sunrise', 'starVeil', 'constellation'],
  // 묶음 E1 (54 6장): 10인 ⑩ 입구 (신기루 쉬운 판 · 질병) / 골목 (옮겨붙는 질병 · 저주) / 성문 (차례 × 신기루), 물밑 계단 (고리 쉬움),
  // 20인 ② 연못 (고리 · 마법) / 서고 (신기루 × 진동) / 제단 (완치 표식 · 페이즈), 모래시계 궁전 (붕대 · 질병)
  bazaar1: ['clearEye', 'coldMedicine', 'evenly'],
  bazaar2: ['coldMedicine', 'curseBreak', 'quickAid'],
  bazaar3: ['numberSense', 'clearEye', 'kindCrit'],
  deepstairs: ['wideEmbrace', 'calmRipple', 'cleanHands'],
  abbey1: ['wideEmbrace', 'evenly', 'spellWard'],
  abbey2: ['clearEye', 'quickAid', 'bigBowl'],
  abbey3: ['holdTogether', 'starClock', 'sunrise'],
  hourglass: ['woundClean', 'coldMedicine', 'thrifty'],
  // 묶음 E2 (54 6장): 10인 ⑪ 분수 (모래시계 × 사슬) / 보물고 (탱커 교대 × 신기루) / 옥좌 (페이즈 · 신기루), 낙타 대상로 (진동),
  // 20인 ③ 입구 (탱커 교대 · 끌어당김) / 온실 (자폭 쫄 · 쇠약) / 심장뿌리 (뒤집힘 · 부풀기)
  dusk1: ['stillMoment', 'evenly', 'starClock'],
  dusk2: ['hardShell', 'shieldFriend', 'twinShield'],
  dusk3: ['sunrise', 'clearEye', 'constellation'],
  caravan: ['cutBeat', 'windStep', 'thrifty'],
  rootwood1: ['sturdyBack', 'prop', 'holdTogether'],
  rootwood2: ['bombSquad', 'woundClean', 'evenly'],
  rootwood3: ['holdingHand', 'starVeil', 'bigBowl'],
  // 묶음 E3 (54 6장): 10인 ⑫ 복도 (무력화 × 신기루 · 진동) / 시계방 (모래시계 둘 · 사냥) / 침실 (신기루 피난처 · 페이즈),
  // 20인 ④ 수문 (감옥 × 행진) / 다리 (나눔 사슬 × 역류) / 거울호수 (신기루 × 모래시계), 바람개비 언덕 (끌어당김 · 저주 · 마법), 해시계 천문대 (가짜 반격 틈)
  pyramid1: ['cutBeat', 'sturdyBack', 'clearEye'],
  pyramid2: ['starClock', 'rewind', 'thrifty'],
  pyramid3: ['shelterMap', 'sunrise', 'constellation'],
  reservoir1: ['chainBreaker', 'holdingHand', 'evenly'],
  reservoir2: ['thrifty', 'insight', 'wideEmbrace'],
  reservoir3: ['clearEye', 'starVeil', 'constellation'],
  pinwheel: ['windStep', 'curseBreak', 'spellWard'],
  observatory: ['cutBeat', 'starClock', 'holdTogether'],
  // 묶음 F1 (56 6장): 20인 ⑤ 도르래 (차례 × 진동) / 이끼벽 (치유 상한 × 완치 표식 · 질병) / 바닥 (넘치는 빛 그릇 · 페이즈),
  // 10인 ⑬ 접수대 (띄워 올리기 · 저주) / 분류실 (띄워 올리기 × 나눔 사슬) / 옥상 (받침 × 띄워 올리기 · 페이즈), 구름 양 목장 (연쇄 번개 · 마법), 천둥 풍차 (연쇄 번개 × 띄워 올리기 · 저주)
  well1: ['numberSense', 'quickAid', 'pouch'],
  well2: ['cleanHands', 'holdingHand', 'brushOff'],
  well3: ['bubble', 'overflowKind', 'sunrise'],
  post1: ['lingerLight', 'curseBreak', 'drumbeat'],
  post2: ['layer', 'holdTogether', 'lingerLight'],
  post3: ['shelterMap', 'sunrise', 'guardFeather'],
  ranch: ['quickAid', 'spellWard', 'bubble'],
  windmill: ['curseBreak', 'lingerLight', 'quickAid'],
  crystal1: ['quickAid', 'hardShell', 'evenly'],
  crystal2: ['woundClean', 'lingerLight', 'wideEmbrace'],
  crystal3: ['edgeTouch', 'starVeil', 'constellation'],
  fort1: ['windStep', 'pouch', 'quickAid'],
  fort2: ['shieldFriend', 'prop', 'sturdyBack'],
  fort3: ['shelterMap', 'guardFeather', 'constellation'],
  station: ['bubble', 'lightBreath', 'spellWard'],
  shadow1: ['heavyFeet', 'holdingHand', 'evenly'],
  shadow2: ['layer', 'lingerLight', 'holdTogether'],
  shadow3: ['clearEye', 'starVeil', 'sunrise'],
  school: ['lingerLight', 'bubble', 'spellWard'],
  maze1: ['quickAid', 'pouch', 'numberSense'],
  maze2: ['layer', 'holdTogether', 'cleanHands'],
  maze3: ['sunrise', 'starVeil', 'overflowKind'],
  camp1: ['windStep', 'quickAid', 'evenly'],
  camp2: ['sturdyBack', 'prop', 'shieldFriend'],
  camp3: ['clearEye', 'constellation', 'guardFeather'],
  carriage: ['quickAid', 'curseBreak', 'lingerLight'],
  ballroom: ['curseBreak', 'lingerLight', 'kindCrit'],
  coast1: ['shelterMap', 'lingerLight', 'wideEmbrace'],
  coast2: ['woundClean', 'hardShell', 'holdingHand'],
  coast3: ['bubble', 'overflowKind', 'sunrise'],
  lantern: ['bubble', 'lightBreath', 'quickAid'],
  heart1: ['fadingMiasma', 'holdTogether', 'brushOff'],
  heart2: ['drumbeat', 'windStep', 'starVeil'],
  heart3: ['edgeTouch', 'sunrise', 'constellation'],
  dawn: ['sunrise', 'lightBreath', 'wideEmbrace'],
  heartcrack: ['layer', 'cleanHands', 'pouch'],
  // 묶음 H1 (62 2-1): 그 장소 해제 유형 · 기믹에 맞춘 3개
  scrapheap: ['shieldFriend', 'sturdyBack', 'firstWord'],
  mine: ['shieldFriend', 'shelterMap', 'pouch'],
  alley: ['coldMedicine', 'brushOff', 'warmTouch'],
  greenhouse: ['coldMedicine', 'immuneIncense', 'lingerLight'],
  frogpond: ['antidote', 'lingerLight', 'warmCloak'],
  reedvillage: ['antidote', 'fadingMiasma', 'trapSense'],
  fountain: ['curseBreak', 'firstCup', 'regular'],
  perfumery: ['curseBreak', 'hardShell', 'wideEmbrace'],
  icefish: ['spellWard', 'springSip', 'pouch'],
  snowlab: ['spellWard', 'crystalBreak', 'lightBreath'],
  harvest: ['cleanHands', 'cheerFlag', 'wideEmbrace'],
  // 묶음 H2 (62): 그 장소 해제 유형 · 기믹에 맞춘 3개
  granary: ['cleanHands', 'twiceBrush', 'prop'],
  scarefield: ['brushOff', 'shelterMap', 'cheerFlag'],
  smuggler: ['bombSquad', 'antidote', 'holdTogether'],
  reef: ['bombSquad', 'curseBreak', 'springSip'],
  frostgarden: ['spellWard', 'evenly', 'potionRegular'],
  dorm: ['spellWard', 'cutBeat', 'twinShield'],
  cultcamp: ['coldMedicine', 'bubble', 'woundClean'],
  apothecary: ['coldMedicine', 'chainBreaker', 'risingLight'],
  rooftop: ['chainBreaker', 'immuneIncense', 'busyHands'],
  bakery: ['clearEye', 'coldMedicine', 'brimming'],
  dewhill: ['clearEye', 'fireflies', 'rainbow'],
  mushmarsh: ['antidote', 'heavyFeet', 'windStep'],
  lilypalace: ['antidote', 'fadingMiasma', 'heavyFeet'],
  // 묶음 H3 (62): 그 장소 해제 유형 · 기믹에 맞춘 3개
  quarry: ['hardShell', 'spellWard', 'layer'],
  smithy: ['layer', 'antidote', 'eliteHunter'],
  ferry: ['hardShell', 'antidote', 'bigBowl'],
  turtlecave: ['cutBeat', 'spellWard', 'lastStand'],
  mistplaza: ['cleanHands', 'starVeil', 'evenly'],
  coralgarden: ['cleanHands', 'chainBreaker', 'calmRipple'],
  oasis: ['curseBreak', 'coldMedicine', 'dusk'],
  sandlibrary: ['rewind', 'curseBreak', 'starClock'],
  sundialroad: ['rewind', 'hurryStar', 'coldMedicine'],
  // 묶음 H4 (62): 그 장소 해제 유형 · 기믹에 맞춘 3개
  cloudbridge: ['featherQuilt', 'guardFeather', 'spellWard'],
  flightyard: ['featherQuilt', 'windStep', 'curseBreak'],
  stormmeadow: ['holdTogether', 'featherQuilt', 'numberSense'],
  cloudlibrary: ['spellWard', 'overflowKind', 'stillMoment'],
  broomrace: ['spellWard', 'bigBowl', 'quickAid'],
  sunkrose: ['curseBreak', 'layer', 'crisisSense'],
  lotusway: ['curseBreak', 'calmRipple', 'regular'],
  waterglow: ['goldEcho', 'rewind', 'starVeil'],
  barracks: ['cleanHands', 'march', 'twinShield'],
  outpost: ['trapSense', 'cleanHands', 'leadOn'],
  starcave: ['crystalBreak', 'goldEcho', 'constellation'],
  sunrisehill: ['sunrise', 'brightMorning', 'cleanHands'],
};

/** 값 글자: 6% · 10%p · 1.5초 · 0.6% · 1 */
export function fmtSpec(v: number, unit: SpecUnit): string {
  const r1 = (x: number) => String(Math.round(x * 10) / 10);
  switch (unit) {
    case 'pct': return `${r1(v * 100)}%`;
    case 'pp': return `${r1(v * 100)}%p`;
    case 'sec': return `${r1(v)}초`;
    case 'mana': return `${Math.round(v * 100) / 100}%`;
    case 'n': return r1(v);
  }
}
/** 효과 글 (값을 채움) */
export const specText = (d: { text: string; unit: SpecUnit }, v: number) => d.text.replace('{v}', fmtSpec(v, d.unit));

/** 장비 한 줄 (저장): 특수능력 키 + 굴림 (0.6~1, 값 고정이면 1) */
/** 장비 특수능력 한 줄. legend = 전설 고유 능력 (굴림 없이 1.5배, data/equipment legendValue) */
export interface SpecLine { key: string; roll: number; legend?: true }

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
