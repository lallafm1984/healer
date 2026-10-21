/**
 * 내 힐러 요약 (27 2장 로비 힐러 카드 · 4-1 캐릭터 머리 · 4-2 능력치 판).
 * 장비 점수 = 장착 장비 itemScore 합 × 10 (편성 화면 권장 장비 경고와 같은 기준). 「전투력」이라는 말은 쓰지 않는다.
 */
import { gearStatsOf, itemScore, itemSpecs, KINDS, specLineValue, LOOK_WORD, lookOf, PLACE_KINDS, SLOTS, slotName, STATS, type GearItem, type KindDef, type SlotKey } from '../data/equipment';
import { dexKeys, type DexTab } from '../data/dex';
import { FACTIONS, type FactionKey } from '../data/places';
import { uniqueOf, uniqueValue } from '../data/uniques';
import { HEROES } from '../data/heroes';
import { codexKeys, FEATURED, namedOf, SPEC_GROUPS, SPECS, specText, specValue, type CodexGroup, type SpecGroup } from '../data/specials';
import { contentOf, type ContentKey } from '../data/content';
import { lvPower } from '../data/progression';
import { INT_BASE, RULES } from '../data/rules';
import { TALENTS } from '../data/talents';
import { TUT } from './tutorial';
import { G, healerLevel, heroNow, heroSave } from './state';

/** 힐러 기본 체력 (06 2장). 레벨 배율(lvPower)을 곱하기 전 값이라 Lv 1은 220 (34 1-2) */
export const HEALER_HP = 550;

/** 장비 한 개 점수 (보여 주는 값, 지금 레벨 기준: 아이템 레벨이 낮으면 줄어듦) */
export const scoreOf = (it?: GearItem | null) => Math.round(itemScore(it ?? undefined, G.save.player.level) * 10);

/** 특수능력 · 이름 있는 장신구 이름 (도감 키 → 이름) */
export const specName = (key: string) => SPECS[key]?.name ?? namedOf(key)?.name ?? key;

/** 장비 상세 특수능력 한 줄: 묶음 (이름 있는 장신구 고유 효과는 'named') · 효과 글 · 꺼진 이유. 고유 장비 고정 특수능력은 badge 「고유」 (굴림 막대 · 줄 번호는 재설정과 함께 2026-10-21 없앰) */
export interface SpecRow { key: string; name: string; group: SpecGroup | 'named'; badge: string; text: string; off: string }
/** 같은 특수능력을 여러 장비에 껴도 하나만 켜지는 것 (재사용 대기 · 고정 값 · 고유 효과, 42 1-3) */
const single = (key: string) => !SPECS[key] || !!SPECS[key].cd || !!SPECS[key].fixed;

/**
 * 장비 상세의 특수능력 줄 (42 1-3 · 1-5): 고유 효과 → 굴린 줄. 다른 직업 전용이면 「사제 전용」,
 * 낀 장비 중 같은 겹치지 않는 효과가 더 좋은 게 있으면 「겹치지 않음」 (끼고 있는 장비만). 전설 고유 능력은 「(고유)」 · 굴림 없음
 */
export function specRows(it: GearItem): SpecRow[] {
  const hero = heroNow(), eq = G.save.gear.equipped, worn = eq[it.slot]?.id === it.id;
  const best: Record<string, { id: number; v: number }> = {};
  for (const s of SLOTS) {
    const e = eq[s.key];
    if (e) for (const o of itemSpecs(e)) if (single(o.key) && (!best[o.key] || o.v > best[o.key].v)) best[o.key] = { id: e.id, v: o.v };
  }
  const dup = (key: string) => (worn && single(key) && best[key] && best[key].id !== it.id ? '겹치지 않음' : '');
  const out: SpecRow[] = [];
  const nm = namedOf(it.named);
  if (nm) out.push({ key: nm.key, name: nm.name, group: 'named', badge: '고유', text: specText(nm, nm.val), off: dup(nm.key) });
  const un = uniqueOf(it.unique), ud = un && SPECS[un.spec];
  if (un && ud) out.push({ key: ud.key, name: `${ud.name} (고유)`, group: ud.group, badge: '고유', text: specText(ud, uniqueValue(un, it.grade, it.uniqueMult)), off: dup(ud.key) });
  for (const l of it.specs ?? []) {
    const d = SPECS[l.key];
    if (!d) continue;
    const off = d.hero && d.hero !== hero ? `${HEROES[d.hero].name} 전용` : dup(d.key);
    out.push({ key: d.key, name: l.legend ? `${d.name} (고유)` : d.name, group: d.group, badge: l.legend ? '고유' : SPEC_GROUPS[d.group].name, text: specText(d, specLineValue(it, l)), off });
  }
  return out;
}

/** 도감 한 칸 (42 1-6): 얻은 것은 이름 · 효과 (영웅 최대값), 못 얻은 것은 「?」 + 나오는 곳 힌트 */
export interface CodexRow { key: string; got: boolean; name: string; text: string; hint: string }
export function codexRows(g: CodexGroup): CodexRow[] {
  const have = G.save.gear.codex;
  return codexKeys(g).map(key => {
    const got = have.includes(key), nm = namedOf(key);
    if (nm) return { key, got, name: nm.name, text: specText(nm, nm.val), hint: `Lv 100 · ${nm.placeName} 어려움 · 악몽에서 · ${slotName(nm.slot)} 전설` };
    const d = SPECS[key];
    const where = d.slots.length === SLOTS.length ? '모든 부위' : d.slots.map(slotName).join(' · ');
    const feat = Object.keys(FEATURED).filter(p => FEATURED[p].includes(key)).map(p => contentOf(p as ContentKey).name);
    const hint = [where, `${d.min} 이상`, d.hero ? `${HEROES[d.hero].name}로 돌 때` : '', feat.length ? `${feat.join(' · ')}에서 자주` : ''].filter(Boolean).join(' · ');
    return { key, got, name: d.name, text: specText(d, d.fixed ? d.val : specValue(key, '영웅', 1)), hint };
  });
}

/** 장비 도감 한 칸 (34 6-10 ④): 얻은 것은 이름 · 설명, 못 얻은 것은 「?」 + 나오는 곳 */
/** 도감 한 칸. kind · named · unique는 칸 그림 (gearIcon)용 */
export interface DexRow { key: string; got: boolean; name: string; text: string; hint: string; slot: SlotKey; kind?: string; look?: FactionKey; named?: string; unique?: string }
/** 그 종류가 잘 나오는 장소 이름 (세력을 주면 그 세력 장소만) */
function kindPlaces(kind: string, f?: FactionKey): string[] {
  return Object.keys(PLACE_KINDS).filter(p => PLACE_KINDS[p].includes(kind) && (!f || lookOf(p) === f)).map(p => contentOf(p as ContentKey)?.name).filter(Boolean) as string[];
}
const fixedTxt = (k: KindDef) => k.fixed.map(x => STATS[x].name).join(' + ');
export function dexRows(tab: DexTab): DexRow[] {
  const have = G.save.gear.dex;
  return dexKeys(tab).map(key => {
    const got = have.includes(key), [, a, b] = key.split(':');
    if (tab === 'kind') {
      const k = KINDS.find(x => x.key === a)!, ps = kindPlaces(a);
      return { key, got, slot: k.slot, kind: a, name: k.name, text: `${slotName(k.slot)} · 고정 ${fixedTxt(k)}`, hint: `${slotName(k.slot)} · ${ps.length ? `${ps.slice(0, 3).join(' · ')}에서 잘 나옴` : '어디서나'}` };
    }
    if (tab === 'look') {
      const f = a as FactionKey, k = KINDS.find(x => x.key === b)!;
      return { key, got, slot: k.slot, kind: b, look: f, name: `${LOOK_WORD[f]} ${k.name}`, text: `${FACTIONS[f].name} 생김새 · 고정 ${fixedTxt(k)}`, hint: `${FACTIONS[f].name} ${k.name} · ${kindPlaces(b, f).slice(0, 3).join(' · ')}에서` };
    }
    if (tab === 'named') {
      const n = namedOf(a)!;
      return { key, got, slot: n.slot, named: a, name: n.name, text: specText(n, n.val), hint: `Lv 100 · ${n.placeName} 어려움 · 악몽에서 · ${slotName(n.slot)} 전설` };
    }
    const u = uniqueOf(a)!, d = SPECS[u.spec];
    return { key, got, slot: u.slot, kind: u.kind, unique: a, name: u.name, text: `${d.name} (고유): ${specText(d, uniqueValue(u, '전설'))}`, hint: `Lv 100 · ${u.placeName} 어려움 · 악몽에서 · ${slotName(u.slot)} 전설` };
  });
}


/** 열렸는데 아직 안 고른 특성 단 수 (지금 직업 트리, 튜토리얼 중엔 0) */
export function talentsLeft(): number {
  if (G.save.tut < TUT.done) return 0;
  const picks = heroSave(heroNow()).talents || [];
  return TALENTS.filter((t, i) => t.lv <= healerLevel() && picks[i] == null).length;
}

/** 능력치 (레벨 배율 포함): 체력 · 지능 · 치명타 · 가속 · 정신력(마나 재생 배율) · 인내(받는 피해 감소) */
export function heroStats(): { hp: number; int: number; crit: number; haste: number; regen: number; endure: number } {
  const p = statParts();
  return { hp: p.hp.total, int: p.int.total, crit: p.crit.total, haste: p.haste.total, regen: 1 + p.spirit.total, endure: p.endure.total };
}

/**
 * 능력치 판 6칸과 출처 (34 1-2 · 10장, 27 4-2 능력치 판을 누르면): 기본 · 레벨 (정점 수련 포함) · 장비 몫. 더하면 total.
 * 지능 = 치유 회복량 (스킬 회복량은 지능의 비율), 정신력 = 마나 재생에 더하는 비율, 인내 = 받는 피해 감소 (장비 옵션, 34 6-4).
 * 특성은 상시 능력치를 바꾸지 않음 (전투 중 조건으로 켜짐) → 몫 없음. 체력은 방어구 주 능력치 · 체력 옵션으로 오름.
 */
export function statParts() {
  const lv = G.save.player.level, apex = RULES.apex(lv);
  const eq = G.save.gear.equipped, st = gearStatsOf(eq, lv), lp = lvPower(lv) * apex, l1 = lvPower(1);
  const hpLv = Math.round(HEALER_HP * lp), hp = Math.round(HEALER_HP * lp * (1 + (st.hp ?? 0))), hp1 = Math.round(HEALER_HP * l1);
  const ib = INT_BASE * RULES.heal; // 치유 배율 (34 1-6)
  const int = Math.round(ib * lp * st.heal), intLv = Math.round(ib * lp), int1 = Math.round(ib * l1);
  return {
    lp,
    /** 정점 수련 몫 (34 2-2, Lv 51부터 레벨마다 +0.3%). 레벨 몫에 들어 있음 */
    apex: apex - 1,
    hp: { total: hp, base: hp1, level: hpLv - hp1, gear: hp - hpLv },
    int: { total: int, base: int1, level: intLv - int1, gear: int - intLv },
    crit: { total: RULES.baseCrit + st.crit, base: RULES.baseCrit, gear: st.crit },
    haste: { total: Math.min(RULES.hasteCap, st.haste), gear: Math.min(RULES.hasteCap, st.haste), cap: RULES.hasteCap },
    /** 마나 재생 = 초당 regen% × (1 + 정신력) */
    spirit: { total: st.regen - 1, gear: st.regen - 1, regen: RULES.regen },
    endure: { total: st.endure ?? 0, gear: st.endure ?? 0 },
  };
}

