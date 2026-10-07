/** 전투 소비 아이템 (19 2부). 물약 = 나에게, 공용 재사용 대기 / 두루마리·깃털 = 전투당 횟수만. GCD와 무관 */
export type ItemKey = 'mana' | 'medit' | 'life' | 'cleanse' | 'shield' | 'feather';

export interface ItemDef {
  name: string;
  short: string;
  kind: 'potion' | 'scroll';
  /** 전투당 사용 횟수 */
  uses: number;
  target: 'self' | 'none' | 'ally' | 'dead';
  desc: string;
  tip: string;
}

export const ITEMS: Record<ItemKey, ItemDef> = {
  mana: { name: '마나 물약', short: '마나', kind: 'potion', uses: 1, target: 'self', desc: '마나를 즉시 30% 회복합니다.', tip: '급할 때 바로 마나를 채웁니다.' },
  medit: { name: '명상의 물약', short: '명상', kind: 'potion', uses: 1, target: 'self', desc: '20초 동안 마나 재생이 2.5배가 됩니다.', tip: '느리지만 마나 물약보다 총량이 많습니다.' },
  life: { name: '생명 물약', short: '생명', kind: 'potion', uses: 2, target: 'self', desc: '내 체력을 40% 회복합니다.', tip: '내가 쓰러지면 바로 패배합니다.' },
  cleanse: { name: '해제 두루마리', short: '해제', kind: 'scroll', uses: 1, target: 'none', desc: '모든 파티원의 디버프를 1개씩 제거합니다. 독도 제거하지만 함정은 제거하지 못합니다.', tip: '지금 직업이 못 지우는 종류도 지웁니다.' },
  shield: { name: '보호 두루마리', short: '보호', kind: 'scroll', uses: 1, target: 'ally', desc: '칸 1개의 파티원이 8초 동안 받는 피해를 40% 줄입니다.', tip: '누른 뒤 칸을 탭합니다. 버스터 직전 탱커에게 좋습니다.' },
  feather: { name: '부활 깃털', short: '깃털', kind: 'scroll', uses: 1, target: 'dead', desc: '쓰러진 파티원 1명을 체력 30%로 일으킵니다. 탱커가 먼저이고, 그다음은 가장 최근에 쓰러진 파티원입니다.', tip: '딜러를 살려 광폭화를 피하거나 레이드 탱커를 다시 세웁니다.' },
};

/** 물약 공용 재사용 대기 (초) */
export const POTION_CD = 60;
