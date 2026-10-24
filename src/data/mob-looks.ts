/**
 * 구간 적 얼굴 · 이름 (2026-10-25 Lim 「이미지를 추가해서 적얼굴과 이름을 다양화하자」): 한 무리에 같은 종류 (MobDef 이름)가 여럿이면
 * 첫째는 그 이름 · 그림 그대로, 둘째부터 이 표 차례로 다른 이름 · 얼굴. 겉모습만 (공격 · 체력 · 엔진 이름 · 공략의 종류 이름은 그대로)
 */
export interface MobLook { name: string; art?: string }

export const MOB_LOOKS: Record<string, MobLook[]> = {
  '먼지 유령': [{ name: '거미줄 유령', art: 'mob-dust-ghost-web' }, { name: '백합 유령', art: 'mob-dust-ghost-lily' }, { name: '잿빛 유령', art: 'mob-dust-ghost-ash' }, { name: '은빛 유령', art: 'mob-dust-ghost-silver' }],
  '고철 졸개': [{ name: '톱니 졸개', art: 'mob-scrap-minion-saw' }, { name: '사슬 졸개', art: 'mob-scrap-minion-chain' }],
  '되살아난 뼈': [{ name: '방패 든 뼈', art: 'mob-risen-bones-shield' }, { name: '도끼 든 뼈', art: 'mob-risen-bones-axe' }],
  '늪 창병': [{ name: '갈대 창병', art: 'mob-swamp-spearman-reed' }, { name: '작살 창병', art: 'mob-swamp-spearman-harpoon' }],
  '빈 갑옷 시종': [{ name: '쟁반 갑옷 시종', art: 'mob-empty-armor-tray' }, { name: '도끼창 갑옷 시종', art: 'mob-empty-armor-halberd' }],
  '얼음 룬 인형': [{ name: '고드름 룬 인형', art: 'mob-rune-doll-icicle' }, { name: '수정 룬 인형', art: 'mob-rune-doll-crystal' }],
  '돌 수도사': [{ name: '이끼 수도사', art: 'mob-stone-monk-moss' }, { name: '청동 수도사', art: 'mob-stone-monk-bronze' }],
  '공허의 종복': [{ name: '별 망토 종복', art: 'mob-void-servant-star' }, { name: '수정 발톱 종복', art: 'mob-void-servant-claw' }],
  '갑판 청소부': [{ name: '솔 든 청소부', art: 'mob-deck-swab-brush' }, { name: '갈고리 청소부', art: 'mob-deck-swab-hook' }],
  '버섯 꼬마 경비': [{ name: '주황 갓 경비', art: 'mob-cap-guard-amber' }, { name: '찻잔 경비', art: 'mob-cap-guard-teacup' }],
  '코볼트 곡괭이꾼': [{ name: '코볼트 삽꾼', art: 'mob-kobold-miner-shovel' }, { name: '코볼트 쌍곡괭이꾼', art: 'mob-kobold-miner-twin' }],
  '용 비늘 경비병': [{ name: '용 비늘 창병', art: 'mob-dragon-scale-guard-glaive' }, { name: '용 비늘 방패병', art: 'mob-dragon-scale-guard-tower' }],
  '모래 병정': [{ name: '모래 방패병', art: 'mob-sand-soldier-shield' }, { name: '모래 도끼병', art: 'mob-sand-soldier-axe' }],
  '깃털 창병 하피': [{ name: '깃털 검 하피', art: 'mob-harpy-spear-sabre' }, { name: '번개 창 하피', art: 'mob-harpy-spear-bolt' }],
  '구름 룬 인형': [{ name: '먹구름 룬 인형', art: 'mob-cloud-rune-doll-storm' }, { name: '바람개비 룬 인형', art: 'mob-cloud-rune-doll-vane' }],
  '그림자 기사': [{ name: '그림자 창기사', art: 'mob-shadow-knight-lance' }, { name: '그림자 도끼기사', art: 'mob-shadow-knight-axe' }],
  '그림자 석궁수': [{ name: '그림자 장궁수', art: 'mob-shadow-crossbow-longbow' }],
  '물에 젖은 갑옷 시종': [{ name: '따개비 갑옷 시종', art: 'mob-wet-armor-barnacle' }, { name: '해초 갑옷 시종', art: 'mob-wet-armor-kelp' }],
  '교단 신도': [{ name: '향로 신도', art: 'mob-cult-acolyte-censer' }],
  '붕대 시종': [{ name: '부채 시종', art: 'mob-bandage-servant-fan' }],
  '바람 요정': [{ name: '회오리 요정', art: 'mob-wind-sprite-whirl' }],
  '빗자루 견습생': [{ name: '마법서 견습생', art: 'mob-broom-apprentice-tome' }],
};

/** 같은 종류 nth번째 (0부터)의 이름 · 그림 (art 없음 = 종류 그림) */
export function mobLookOf(kind: string, nth: number): MobLook {
  const all: MobLook[] = [{ name: kind }, ...(MOB_LOOKS[kind] ?? [])];
  return all[Math.max(0, nth) % all.length];
}
