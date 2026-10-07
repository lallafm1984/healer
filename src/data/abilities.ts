/**
 * 파티원 특수 능력 (17 3~5장): 직업마다 후보 10개 (일반 6 · 고급 3 · 희귀 1), 파티원은 1개만 갖고 들어옴.
 * 능력은 파티원이 알아서 씀 (명령 없음). 언제 쓰는지(trig)와 무엇을 하는지(fx)는 engine/abilities.ts가 읽는다.
 * 지금은 코드에 있는 공개모집 직업 8종의 80개. 나머지 12종은 직업을 넣을 때 같은 틀로.
 * 회복 능력은 균형 기준(17 4장): 전투당 1회, 자기 20% · 남 15% 상한, ★로 +25%까지.
 */
import type { ClassKey } from './classes';

export type AbKind = 'def' | 'heal' | 'sup' | 'ctl' | 'atk';
export type AbGrade = 'common' | 'rare' | 'epic';

/** 능력 종류 (아이콘 모서리 표시, 17 3장) */
export const AB_KIND: Record<AbKind, { icon: string; name: string }> = {
  def: { icon: '🛡', name: '방어' }, heal: { icon: '✚', name: '회복' }, sup: { icon: '⚑', name: '지원' }, ctl: { icon: '✋', name: '방해' }, atk: { icon: '⚔', name: '공격' },
};
/** 능력 등급: 색은 장비 등급과 같은 색 (일반 흰색 · 고급 초록 · 희귀 파랑) */
export const AB_GRADE: Record<AbGrade, { name: string; color: string; mult: number }> = {
  common: { name: '일반', color: '#E8E4D8', mult: 1 }, rare: { name: '고급', color: '#6CCB6A', mult: 1.03 }, epic: { name: '희귀', color: '#4C9BFF', mult: 1.06 },
};

/**
 * 쓰는 때. 목록 중 하나라도 맞으면 씀. hpBelow = 내 체력이 이 비율 아래일 때만.
 * low 나 체력 · buster 나를 노리는 버스터 예고 · targeted 나를 노리는 지정 피해 예고(버스터 포함) · aoe 광역 예고(마법 기술)
 * zone 내 칸 장판 예고 · zoneAny 장판 예고 · zone3 장판 예고가 3명 이상 · zoneNear 나나 옆 아군 칸 장판 예고
 * start 전투 시작 · boss30 보스 체력 30% 이하 · ready 준비되면 바로 · adds 보스 아닌 적 n마리 이상 · addsHit 보스 아닌 적이 탱커 아닌 아군을 때림
 * cast 끊기 가능 기술 시전 시작 · castAny 버스터·광폭화가 아닌 광역·장판 시전 시작 · lethal 죽을 피해 · always 상시
 * allyLow 반경 r 아군 체력 · allyTargeted 반경 r 아군이 지정 피해 대상 · allyDebuff 반경 r 아군에게 지울 수 있는 독·질병 · fear 성격 위기 행동(도망) 시작 · moved 이동을 마친 뒤
 */
export type Trig =
  | { t: 'low'; hp: number; noZone?: boolean }
  | { t: 'buster' | 'targeted' | 'aoe' | 'zone' | 'zoneAny' | 'zone3' | 'zoneNear' | 'start' | 'boss30' | 'ready' | 'addsHit' | 'cast' | 'castAny' | 'lethal' | 'always' | 'fear' | 'moved'; hpBelow?: number }
  | { t: 'adds'; n: number }
  | { t: 'allyLow'; hp: number; r: number; nonTank?: boolean }
  | { t: 'allyTargeted'; r: number; hp?: number }
  | { t: 'allyDebuff'; r: number };

/**
 * 효과. v = 주된 수치 (★로 커지는 값), sec = 지속.
 * cut 받는 피해 감소 (hit = 그 예고가 맞을 때까지, magic = 마법 피해만) · immune 모든 피해 무시 · vanish 지정 대상에서 빠지고 피해 무시(또는 감소)
 * untarget 지정 대상에서만 빠짐 · selfHeal 자기 회복 (stop = 멈추는 초, over = 나눠 회복하는 초) · lastStand 최대 체력 늘리고 그만큼 회복
 * rewind 6초 전 체력으로 · absorb 흡수막 · spell 다음 마법 기술 1회 막기 · iceBlock 죽을 피해 막고 얼음 · dps 자기 딜 · allyDps 주변 아군 딜
 * weaken 보스 피해 감소 · taunt 보스 아닌 적을 끌어옴 · handoff 적을 탱커에게 · stunAdd 적 1마리 기절 · stunAdds 모두 얼림 · hitAdds 적 모두 피해 (최대 체력 비율)
 * interrupt 끊기 · delay 늦추기 · dodgeNow 장판에서 즉시 빠짐 · smoke 주변 회피 100% · fast 이동 시간 감소 · react 주변 반응 시간 감소
 * cleanse 독·질병 1개 제거 · share 아군 피해 일부를 대신 · protect 물리 피해 무시 · intercept 지정 피해를 대신 · guardAlly 아군 받는 피해 감소
 * auraMagic 옆 아군 마법 피해 감소(상시) · auraDps 옆 원거리 아군 딜(상시) · healTaken 받는 치유 · maxHp 주변 최대 체력 · nofear 겁먹지 않음
 * aimMax 조준 최대 · counter 맞으면 반격 · mark 보스 30%부터 딜 · wish 체력 30% 아래 딜 · pet 동물 동료 (간이: 딜 + 광역 피해 감소) · unzone 장판 하나 없앰
 */
export type Fx =
  | { e: 'cut'; v: number; sec?: number; hit?: boolean; magic?: boolean; nodps?: boolean }
  | { e: 'immune'; sec: number }
  | { e: 'vanish'; sec: number; cut?: number }
  | { e: 'untarget' }
  | { e: 'selfHeal'; v: number; stop?: number; over?: number }
  | { e: 'lastStand'; v: number; sec: number }
  | { e: 'rewind'; v: number }
  | { e: 'absorb'; v: number; sec: number }
  | { e: 'spell' }
  | { e: 'iceBlock'; sec: number }
  | { e: 'dps'; v: number; sec: number; vuln?: number }
  | { e: 'allyDps'; v: number; sec: number; r: number; self?: boolean }
  | { e: 'weaken'; v: number; sec: number }
  | { e: 'taunt'; sec: number; vuln?: number }
  | { e: 'handoff'; sec: number }
  | { e: 'stunAdd'; sec: number }
  | { e: 'stunAdds'; sec: number }
  | { e: 'hitAdds'; v: number; sec?: number }
  | { e: 'interrupt'; v: number }
  | { e: 'delay'; sec: number }
  | { e: 'dodgeNow'; keepAim?: boolean }
  | { e: 'smoke'; sec: number; r: number }
  | { e: 'fast'; v: number; sec: number }
  | { e: 'react'; v: number; sec: number; r: number }
  | { e: 'cleanse' }
  | { e: 'share'; v: number; sec: number }
  | { e: 'protect'; sec: number }
  | { e: 'intercept' }
  | { e: 'guardAlly'; v: number; sec: number }
  | { e: 'auraMagic'; v: number; r: number }
  | { e: 'auraDps'; v: number; r: number }
  | { e: 'healTaken'; v: number; sec: number }
  | { e: 'maxHp'; v: number; sec: number; r: number }
  | { e: 'nofear'; sec: number }
  | { e: 'aimMax' }
  | { e: 'counter'; v: number }
  | { e: 'mark'; v: number; party: number }
  | { e: 'wish'; v: number; vuln: number }
  | { e: 'pet'; v: number; cut: number }
  | { e: 'unzone' };

export interface AbilityDef {
  key: string;
  cls: ClassKey;
  name: string;
  kind: AbKind;
  grade: AbGrade;
  /** 재사용 대기시간 (초). 0 = 상시, -1 = 전투당 1회 */
  cd: number;
  /** 목록의 쓰는 때마다 전투당 한 번씩만 (쿨 없음, 예: 발도 = 시작 1번 + 보스 30% 1번) */
  each?: boolean;
  trig: Trig[];
  fx: Fx;
  /** 효과 (수치·효과만, 14 문서 말투) */
  desc: string;
  /** 쓰는 때 (짧게) */
  when: string;
}

type Row = [key: string, name: string, kind: AbKind, cd: number, trig: Trig[], fx: Fx, desc: string, when: string, each?: boolean];

const LOW = (hp: number, noZone?: boolean): Trig => ({ t: 'low', hp, noZone });
const T = (t: Exclude<Trig['t'], 'low' | 'adds' | 'allyLow' | 'allyTargeted' | 'allyDebuff'>, hpBelow?: number): Trig => ({ t, hpBelow } as Trig);
const ONCE = -1, ALWAYS = 0;

/** 직업마다 [일반 6, 고급 3, 희귀 1] 순서 */
const TABLE: Record<ClassKey, Row[]> = {
  warrior: [
    ['shieldBlock', '방패 막기', 'def', 40, [T('buster')], { e: 'cut', v: 0.4, hit: true }, '버스터 피해를 40% 줄입니다.', '버스터 예고'],
    ['taunt', '도발', 'ctl', 30, [T('addsHit')], { e: 'taunt', sec: 10, vuln: 0.3 }, '보스가 아닌 적의 공격을 10초 동안 모두 끌어옵니다. 그동안 받는 피해가 30% 늘어납니다.', '보스 아닌 적이 아군을 때림'],
    ['battleShout', '전투의 외침', 'sup', 45, [T('start'), T('boss30')], { e: 'allyDps', v: 0.08, sec: 10, r: 1 }, '옆 아군의 딜이 10초 동안 8% 늘어납니다.', '전투 시작 · 보스 30%'],
    ['demoShout', '위협의 외침', 'sup', 90, [T('aoe')], { e: 'weaken', v: 0.1, sec: 8 }, '8초 동안 보스가 주는 피해가 10% 줄어듭니다.', '광역 예고'],
    ['defStance', '방어 태세', 'def', 60, [LOW(0.4)], { e: 'cut', v: 0.3, sec: 5 }, '5초 동안 받는 피해가 30% 줄어듭니다.', '체력 40% 아래'],
    ['bandage', '붕대 감기', 'heal', ONCE, [LOW(0.35, true)], { e: 'selfHeal', v: 0.15, stop: 3 }, '3초 동안 멈춰서 자기 체력을 15% 회복합니다.', '체력 35% 아래, 장판 밖'],
    ['shieldWall', '방패의 벽', 'def', 120, [LOW(0.3), T('buster')], { e: 'cut', v: 0.5, sec: 8 }, '8초 동안 받는 모든 피해가 50% 줄어듭니다.', '체력 30% 아래 · 버스터 예고'],
    ['lastStand', '최후의 저항', 'heal', ONCE, [LOW(0.2)], { e: 'lastStand', v: 0.2, sec: 8 }, '8초 동안 최대 체력이 20% 늘고 그만큼 회복합니다. 끝나면 최대 체력만 원래대로 돌아갑니다.', '체력 20% 아래'],
    ['intervene', '가로막기', 'sup', 45, [{ t: 'allyTargeted', r: 2, hp: 0.5 }], { e: 'intercept' }, '반경 2 아군 1명이 받을 다음 지정 피해를 대신 맞습니다.', '지정 피해 대상 아군 체력 50% 아래'],
    ['spellReflect', '주문 반사', 'def', 60, [T('aoe')], { e: 'spell' }, '다음 마법 기술 1회를 막고, 그때 걸리는 디버프도 받지 않습니다.', '마법 기술 예고'],
  ],
  paladin: [
    ['vow', '수호의 맹세', 'def', 60, [LOW(0.35)], { e: 'cut', v: 0.35, sec: 8 }, '8초 동안 받는 피해가 35% 줄어듭니다.', '체력 35% 아래'],
    ['devotion', '헌신의 오라', 'sup', ALWAYS, [T('always')], { e: 'auraMagic', v: 0.08, r: 1 }, '옆 아군이 받는 광역 피해가 8% 줄어듭니다.', '상시'],
    ['wrath', '정의의 분노', 'ctl', 30, [T('addsHit')], { e: 'taunt', sec: 10 }, '보스가 아닌 적의 공격을 10초 동안 모두 끌어옵니다.', '보스 아닌 적이 아군을 때림'],
    ['hammer', '심판의 망치', 'ctl', 30, [T('addsHit')], { e: 'stunAdd', sec: 6 }, '보스가 아닌 적 1마리를 6초 동안 기절시킵니다.', '보스 아닌 적이 딜러를 때림'],
    ['avenger', '응징의 방패', 'ctl', 40, [T('cast')], { e: 'interrupt', v: 0.6 }, '끊기 가능 기술을 60% 확률로 끊습니다.', '끊기 가능 기술 시전 시작'],
    ['oath', '영광의 서약', 'heal', ONCE, [LOW(0.35)], { e: 'selfHeal', v: 0.15 }, '자기 체력을 15% 회복합니다.', '체력 35% 아래'],
    ['sacrifice', '희생의 축복', 'sup', 60, [{ t: 'allyLow', hp: 0.4, r: 2 }], { e: 'share', v: 0.3, sec: 8 }, '아군 1명이 받는 피해의 30%를 8초 동안 대신 받습니다.', '반경 2 아군 체력 40% 아래'],
    ['cleanse', '독소 정화', 'sup', 40, [{ t: 'allyDebuff', r: 2 }], { e: 'cleanse' }, '반경 2 아군 1명의 독·질병 디버프 1개를 지웁니다. 함정 디버프는 지우지 않습니다.', '독·질병 걸린 아군'],
    ['protection', '보호의 축복', 'sup', 120, [{ t: 'allyLow', hp: 0.25, r: 99, nonTank: true }], { e: 'protect', sec: 4 }, '탱커가 아닌 아군 1명이 4초 동안 물리 피해를 받지 않습니다. 그동안 딜을 하지 않습니다.', '탱커 아닌 아군 체력 25% 아래'],
    ['divineShield', '천상의 보호막', 'def', ONCE, [LOW(0.2)], { e: 'immune', sec: 6 }, '6초 동안 모든 피해를 받지 않습니다. 그동안 딜을 하지 않습니다.', '체력 20% 아래'],
  ],
  rogue: [
    ['cloak', '그림자 망토', 'def', 60, [T('aoe')], { e: 'spell' }, '다음 마법 기술 1회의 피해와 디버프를 받지 않습니다.', '마법 기술 예고'],
    ['evasion', '회피', 'def', 60, [T('targeted', 0.6), T('zone', 0.6)], { e: 'cut', v: 0.5, sec: 6 }, '6초 동안 받는 피해가 50% 줄어듭니다.', '체력 60% 아래 + 피해 예고'],
    ['kick', '발차기', 'ctl', 30, [T('cast')], { e: 'interrupt', v: 0.7 }, '끊기 가능 기술을 70% 확률로 끊습니다.', '끊기 가능 기술 시전 시작'],
    ['sprint', '전력 질주', 'def', 30, [T('zone')], { e: 'dodgeNow' }, '장판 예고에서 바로 빠져나옵니다.', '장판 예고'],
    ['kidney', '급소 가격', 'ctl', 30, [T('addsHit')], { e: 'stunAdd', sec: 6 }, '보스가 아닌 적 1마리를 6초 동안 기절시킵니다.', '보스 아닌 적이 딜러를 때림'],
    ['tricks', '속임수 거래', 'sup', 30, [T('addsHit')], { e: 'handoff', sec: 10 }, '보스가 아닌 적의 공격을 10초 동안 탱커에게 넘깁니다.', '보스 아닌 적이 아군을 때림'],
    ['smoke', '연막탄', 'sup', 90, [T('zone3')], { e: 'smoke', sec: 3, r: 1 }, '3초 동안 반경 1 아군이 장판을 100% 피합니다.', '장판이 3명 이상 덮을 때'],
    ['vanish', '소멸', 'def', 90, [LOW(0.25), T('targeted')], { e: 'vanish', sec: 3 }, '3초 동안 모든 피해를 받지 않고 지정 대상에서 빠집니다. 그동안 딜을 하지 않습니다.', '체력 25% 아래 · 지정 피해'],
    ['vial', '진홍의 약병', 'heal', ONCE, [LOW(0.35)], { e: 'selfHeal', v: 0.15, over: 6 }, '6초에 걸쳐 자기 체력을 15% 회복합니다.', '체력 35% 아래'],
    ['deathMark', '죽음의 표적', 'atk', ALWAYS, [T('always')], { e: 'mark', v: 0.35, party: 0.03 }, '보스 체력 30% 이하에서 딜이 35% 늘고, 파티 전체 딜이 3% 늘어납니다.', '보스 30%'],
  ],
  berserker: [
    ['frenzy', '광란', 'def', 60, [LOW(0.3)], { e: 'healTaken', v: 0.3, sec: 6 }, '6초 동안 받는 치유가 30% 늘어납니다.', '체력 30% 아래'],
    ['reckless', '무모한 희생', 'atk', 60, [T('boss30')], { e: 'dps', v: 0.3, sec: 10, vuln: 0.2 }, '10초 동안 딜이 30% 늘고, 받는 피해가 20% 늘어납니다.', '보스 30%'],
    ['rage', '광폭화', 'def', 45, [T('fear')], { e: 'nofear', sec: 10 }, '10초 동안 겁먹지 않습니다. 도망 같은 성격 위기 행동을 하지 않습니다.', '성격 위기 행동 시작'],
    ['charge', '돌진', 'def', 20, [T('zone')], { e: 'fast', v: 0.5, sec: 6 }, '6초 동안 이동 시간이 50% 줄어듭니다.', '장판 예고'],
    ['whirl', '소용돌이', 'atk', 20, [{ t: 'adds', n: 1 }], { e: 'hitAdds', v: 0.08 }, '보스가 아닌 적 모두에게 최대 체력 8%의 피해를 줍니다.', '보스 아닌 적 등장'],
    ['bShout', '위협의 외침', 'sup', 90, [T('aoe')], { e: 'weaken', v: 0.1, sec: 8 }, '8초 동안 보스가 주는 피해가 10% 줄어듭니다.', '광역 예고'],
    ['regen', '재생의 격노', 'heal', ONCE, [LOW(0.3)], { e: 'selfHeal', v: 0.2, over: 6 }, '6초에 걸쳐 자기 체력을 20% 회복합니다.', '체력 30% 아래'],
    ['rally', '재집결의 함성', 'sup', 120, [T('aoe')], { e: 'maxHp', v: 0.1, sec: 10, r: 2 }, '10초 동안 반경 2 아군의 최대 체력이 10% 늘어납니다. 회복은 하지 않습니다.', '광역 예고'],
    ['bladestorm', '칼날폭풍', 'atk', 60, [{ t: 'adds', n: 2 }], { e: 'hitAdds', v: 0.25, sec: 6 }, '6초 동안 보스가 아닌 적 모두에게 최대 체력 25%의 피해를 나눠 줍니다.', '보스 아닌 적 2마리 이상'],
    ['deathWish', '죽음의 소원', 'atk', ALWAYS, [T('always')], { e: 'wish', v: 0.5, vuln: 0.1 }, '체력 30% 아래에서 딜이 50% 더 늘고, 받는 피해가 10% 늘어납니다.', '상시'],
  ],
  swordsman: [
    ['parry', '받아넘기기', 'def', 30, [T('targeted')], { e: 'cut', v: 0.5, hit: true }, '지정 피해 1회를 50% 줄입니다.', '지정 피해 대상'],
    ['draw', '발도', 'atk', ALWAYS, [T('start'), T('boss30')], { e: 'dps', v: 0.4, sec: 5 }, '5초 동안 딜이 40% 늘어납니다. 전투 시작과 보스 30%에 한 번씩 씁니다.', '전투 시작 · 보스 30%', true],
    ['wave', '검기', 'atk', 30, [{ t: 'adds', n: 1 }], { e: 'hitAdds', v: 0.08 }, '보스가 아닌 적 모두에게 최대 체력 8%의 피해를 줍니다.', '보스 아닌 적 등장'],
    ['bladeGuard', '칼날 막기', 'def', 45, [T('aoe')], { e: 'cut', v: 0.3, hit: true, magic: true }, '이번 광역 피해를 30% 줄입니다.', '광역 예고'],
    ['kiai', '기합', 'sup', 40, [T('zoneAny')], { e: 'react', v: 0.2, sec: 8, r: 1 }, '8초 동안 옆 아군의 반응 시간이 20% 줄어듭니다.', '장판 예고'],
    ['meditate', '명상', 'heal', ONCE, [LOW(0.35, true)], { e: 'selfHeal', v: 0.2, stop: 3 }, '3초 동안 멈춰서 자기 체력을 20% 회복합니다.', '체력 35% 아래, 장판 밖'],
    ['flash', '일섬', 'ctl', 60, [T('cast')], { e: 'delay', sec: 1.5 }, '끊기 가능 기술의 시전을 1.5초 늦춥니다.', '끊기 가능 기술 시전 시작'],
    ['guardForm', '수호 검진', 'sup', 45, [{ t: 'allyTargeted', r: 1 }], { e: 'guardAlly', v: 0.2, sec: 6 }, '옆 아군 1명이 6초 동안 받는 피해가 20% 줄어듭니다.', '옆 아군이 지정 피해 대상'],
    ['counter', '거합 반격', 'atk', ALWAYS, [T('always')], { e: 'counter', v: 0.3 }, '피해를 받으면 30% 확률로 반격해 1초 치 딜을 더 넣습니다.', '상시'],
    ['mushin', '무념무상', 'def', ONCE, [LOW(0.15)], { e: 'immune', sec: 5 }, '5초 동안 모든 피해를 받지 않습니다. 그동안 딜을 하지 않습니다.', '체력 15% 아래'],
  ],
  mage: [
    ['blink', '점멸', 'def', 20, [T('zone')], { e: 'dodgeNow' }, '장판 예고에서 바로 빠져나옵니다.', '장판 예고'],
    ['counterspell', '주문 차단', 'ctl', 30, [T('cast')], { e: 'interrupt', v: 0.6 }, '끊기 가능 기술을 60% 확률로 끊습니다.', '끊기 가능 기술 시전 시작'],
    ['frostNova', '냉기 회오리', 'ctl', 45, [{ t: 'adds', n: 2 }], { e: 'stunAdds', sec: 4 }, '보스가 아닌 적 모두를 4초 동안 얼립니다.', '보스 아닌 적 2마리 이상'],
    ['iceBarrier', '얼음 보호막', 'def', 45, [T('targeted'), T('aoe')], { e: 'absorb', v: 0.12, sec: 6 }, '6초 동안 최대 체력 12%만큼 피해를 흡수합니다.', '피해 예고'],
    ['invis', '투명화', 'def', 90, [T('targeted')], { e: 'vanish', sec: 3, cut: 0.6 }, '지정 대상에서 빠지고 3초 동안 받는 피해가 60% 줄어듭니다.', '지정 피해'],
    ['poly', '변이', 'ctl', 60, [T('addsHit')], { e: 'stunAdd', sec: 10 }, '보스가 아닌 적 1마리를 10초 동안 양으로 만듭니다.', '보스 아닌 적이 아군을 때림'],
    ['iceBlock', '얼음 방패', 'def', 120, [T('lethal')], { e: 'iceBlock', sec: 3 }, '죽을 피해 1회를 막고 3초 동안 얼음이 됩니다. 그동안 행동·피해·치유가 없습니다.', '죽을 피해'],
    ['iceWard', '얼음 결계', 'sup', 60, [T('zoneNear')], { e: 'unzone' }, '자기나 옆 아군이 든 장판 예고 1개를 얼려서 없앱니다.', '자기·옆 아군이 든 장판 예고'],
    ['timeWarp', '시간 왜곡', 'sup', ONCE, [T('boss30')], { e: 'allyDps', v: 0.15, sec: 10, r: 2, self: true }, '10초 동안 반경 2 아군의 딜이 15% 늘어납니다.', '보스 30%'],
    ['rewind', '시간 되돌리기', 'heal', ONCE, [LOW(0.25)], { e: 'rewind', v: 0.2 }, '6초 전 체력으로 되돌립니다. 회복은 최대 체력 20%까지입니다.', '체력 25% 아래'],
  ],
  archer: [
    ['multiShot', '산탄 사격', 'ctl', 30, [{ t: 'adds', n: 1 }], { e: 'hitAdds', v: 0.08 }, '보스가 아닌 적 모두에게 최대 체력 8%의 피해를 줍니다.', '보스 아닌 적 등장'],
    ['disengage', '철수', 'def', 20, [T('zone')], { e: 'dodgeNow', keepAim: true }, '장판 예고에서 바로 빠져나옵니다. 조준은 그대로 둡니다.', '장판 예고'],
    ['harass', '견제 사격', 'ctl', 30, [T('cast')], { e: 'interrupt', v: 0.6 }, '끊기 가능 기술을 60% 확률로 끊습니다.', '끊기 가능 기술 시전 시작'],
    ['aimedShot', '정조준', 'atk', 60, [T('ready')], { e: 'dps', v: 0.25, sec: 10 }, '10초 동안 딜이 25% 늘어납니다.', '쿨마다'],
    ['rapid', '연발 사격', 'atk', 45, [T('moved')], { e: 'aimMax' }, '조준을 바로 최대로 채웁니다.', '이동한 뒤'],
    ['camo', '위장', 'def', 60, [T('targeted')], { e: 'untarget' }, '지정 공격 대상에서 빠집니다.', '지정 피해'],
    ['hawkEye', '매의 눈', 'sup', 60, [T('zoneAny')], { e: 'react', v: 0.2, sec: 10, r: 2 }, '10초 동안 반경 2 아군의 반응 시간이 20% 줄어듭니다.', '장판 예고'],
    ['trueshot', '정조준의 오라', 'sup', ALWAYS, [T('always')], { e: 'auraDps', v: 0.08, r: 1 }, '옆 원거리 아군의 딜이 8% 늘어납니다.', '상시'],
    ['survivor', '생존자의 활력', 'heal', ONCE, [LOW(0.3)], { e: 'selfHeal', v: 0.15 }, '자기 체력을 15% 회복합니다.', '체력 30% 아래'],
    ['snipe', '저격', 'ctl', ONCE, [T('castAny')], { e: 'interrupt', v: 1 }, '버스터·광폭화가 아닌 보스 기술 1개를 끊습니다. 끊기 가능 기술이 아니어도 됩니다.', '광역·장판 시전 시작'],
  ],
  hunter: [
    ['feign', '죽은 척하기', 'def', 60, [T('targeted'), LOW(0.25)], { e: 'vanish', sec: 3 }, '3초 동안 피해를 받지 않고 지정 대상에서 빠집니다. 그동안 딜을 하지 않습니다.', '지정 피해 · 체력 25% 아래'],
    ['pet', '동물 동료', 'sup', ALWAYS, [T('always')], { e: 'pet', v: 0.1, cut: 0.15 }, '동료가 함께 싸워 딜이 10% 늘고, 광역 피해 15%를 동료가 대신 맞습니다.', '상시'],
    ['cheetah', '치타의 상', 'def', 60, [T('zone')], { e: 'fast', v: 0.5, sec: 10 }, '10초 동안 이동 시간이 50% 줄어듭니다.', '장판 예고'],
    ['misdirect', '눈속임', 'sup', 30, [T('addsHit')], { e: 'handoff', sec: 10 }, '보스가 아닌 적의 공격을 10초 동안 탱커에게 넘깁니다.', '보스 아닌 적이 아군을 때림'],
    ['trap', '얼음 덫', 'ctl', 30, [T('addsHit')], { e: 'stunAdd', sec: 8 }, '보스가 아닌 적 1마리를 8초 동안 얼립니다.', '보스 아닌 적이 아군을 때림'],
    ['firstAid', '응급 붕대', 'heal', ONCE, [LOW(0.35)], { e: 'selfHeal', v: 0.15 }, '자기 체력을 15% 회복합니다.', '체력 35% 아래'],
    ['turtle', '거북의 상', 'def', 120, [LOW(0.3)], { e: 'cut', v: 0.3, sec: 8, nodps: true }, '8초 동안 받는 피해가 30% 줄어듭니다. 그동안 딜을 하지 않습니다.', '체력 30% 아래'],
    ['bestial', '야수의 격노', 'atk', 60, [T('ready')], { e: 'dps', v: 0.25, sec: 10 }, '10초 동안 동료와 함께 딜이 25% 늘어납니다.', '쿨마다'],
    ['callWild', '야생의 부름', 'sup', ALWAYS, [T('always')], { e: 'pet', v: 0.15, cut: 0.25 }, '동료 2마리가 함께 싸워 딜이 15% 늘고, 광역 피해 25%를 동료가 대신 맞습니다.', '상시'],
    ['primal', '원초적 격노', 'sup', ONCE, [T('boss30')], { e: 'allyDps', v: 0.15, sec: 10, r: 2, self: true }, '10초 동안 반경 2 아군의 딜이 15% 늘어납니다.', '보스 30%'],
  ],
};

const GRADES: AbGrade[] = ['common', 'common', 'common', 'common', 'common', 'common', 'rare', 'rare', 'rare', 'epic'];

export const ABILITIES: Record<string, AbilityDef> = {};
for (const [cls, rows] of Object.entries(TABLE) as [ClassKey, Row[]][]) {
  rows.forEach(([k, name, kind, cd, trig, fx, desc, when, each], i) => {
    const key = `${cls}.${k}`;
    ABILITIES[key] = { key, cls, name, kind, grade: GRADES[i], cd, trig, fx, desc, when, each };
  });
}

/** 그 직업의 능력 후보 10개 (일반 6 · 고급 3 · 희귀 1 순서) */
export const abilitiesOf = (cls: ClassKey): AbilityDef[] => Object.values(ABILITIES).filter(a => a.cls === cls);

/** 능력 하나가 나올 확률 (17 3장): 등급 합계 일반 66% · 고급 27% · 희귀 7%. 명문 공고 42 · 45 · 13 */
export const AB_ODDS: Record<'normal' | 'better' | 'best', Record<AbGrade, number>> = {
  normal: { common: 0.66, rare: 0.27, epic: 0.07 },
  better: { common: 0.54, rare: 0.36, epic: 0.10 },
  best: { common: 0.42, rare: 0.45, epic: 0.13 },
};

/** 능력 뽑기: 등급을 고르고 그 등급 안에서 같은 확률 */
export function rollAbility(cls: ClassKey, r: () => number, odds: Record<AbGrade, number> = AB_ODDS.normal): string {
  const x = r();
  const g: AbGrade = x < odds.epic ? 'epic' : x < odds.epic + odds.rare ? 'rare' : 'common';
  const pool = abilitiesOf(cls).filter(a => a.grade === g);
  return pool[Math.floor(r() * pool.length)].key;
}

/** ★ 강화 (17 8-2): 쿨 능력은 ★1·★3 쿨 -10%씩, 효과는 ★2 +10% · ★4 +20%. 1회·상시 능력은 효과 +5·10·15·20·25% (1회는 ★3 대신 조건 +5%p) */
export function starFx(a: AbilityDef, star: number): { eff: number; cd: number; early: number } {
  const s = Math.max(0, Math.min(5, star | 0));
  if (a.cd > 0) return { eff: s >= 4 ? 1.2 : s >= 2 ? 1.1 : 1, cd: 1 - (s >= 1 ? 0.1 : 0) - (s >= 3 ? 0.1 : 0), early: 0 };
  if (a.cd === ONCE) return { eff: [1, 1.05, 1.1, 1.1, 1.2, 1.25][s], cd: 1, early: s >= 3 ? 0.05 : 0 };
  return { eff: 1 + 0.05 * s, cd: 1, early: 0 };
}

/** ★5 종류 보너스 (17 8-2): 🛡 옆 아군 1명에게도 절반 · ⚑ 범위 +1 · ✋ 성공률 +15%p · ⚔ 지속 +50% */
export const STAR5: Record<AbKind, string> = {
  def: '옆 아군 1명에게도 절반 효과', heal: '회복량 +25% (상한)', sup: '범위 +1', ctl: '성공률 +15%p', atk: '지속 시간 +50%',
};
