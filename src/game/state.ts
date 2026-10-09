/** 게임 진행 상태 (기기 저장 한 덩어리) + 화면들이 같이 쓰는 규칙 */
import { contentOf, type ContentDef } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { HERO_KEYS, HERO_SWITCH_LV, HEROES, type HeroKey } from '../data/heroes';
import { TALENTS } from '../data/talents';
import { AWAKEN_AT, awakenValue, enhanceCost, itemName, itemScore, MAX_PLUS, REROLL_LEVEL, REROLL_PICK_LEVEL, rerollCost, rerollLine, rerollSpec, salvageOf, SLOTS, type GearItem, type GearLine, type SlotKey } from '../data/equipment';
import type { SpecLine } from '../data/specials';
import { ITEMS, type ItemKey } from '../data/items';
import { itemSlots } from '../data/progression';
import { heroLevelOf, heroSaveOf, load, newSave, noteSpecs, save, topLevel, type HeroSave, type SaveData } from '../platform/storage';
import { firstDungeonDue, TUT } from './tutorial';
import { isMember, onAct, rollover, type Rollover } from './economy';

export const G: { save: SaveData } = { save: load() };

export function commit(): void { save(G.save); }

/** 월정액이면 배너를 숨김 (15 5장) */
export function syncMember(now = Date.now()): void {
  if (typeof document !== 'undefined') document.body.classList.toggle('member', isMember(G.save, now));
}

/** 날·주가 바뀌었는지 보고 일일·주간을 새로 (13 1장). 접속·로비·임무·상점 화면에서 부름 */
export function refreshDay(now = Date.now()): Rollover {
  const r = rollover(G.save, now, Math.random);
  if (r.day || r.week || r.season || r.banked || r.fixed) commit();
  syncMember(now);
  return r;
}

export function resetSave(): void { G.save = newSave(); commit(); }

/** 전투에 넘길 힐러 레벨 (스킬 해금 기준). 개발 빌드 「스킬 전부 열기」면 100 */
export const healerLevel = () => (G.save.settings.allSkills ? 100 : G.save.player.level);

/** 잠금: 콘텐츠·난이도 해금 레벨 (지금 직업 레벨 기준, 34 4장 1번). dev = 개발 빌드 잠금 무시 */
export function lockOf(c: ContentDef, d?: DiffName): { lv: number; locked: boolean; dev: boolean } {
  const lv = Math.max(c.unlockLv, (d && c.diffUnlock?.[d]) || 0);
  const under = G.save.player.level < lv;
  const dev = under && G.save.settings.devUnlock && c.ready;
  return { lv, locked: under && !dev, dev };
}

/**
 * 첫 던전 안내 차례 (34 5-2): 튜토리얼 뒤 녹슨 요새 레벨(Lv 5)이 됐는데 아직 못 깸 → 로비 · 모험 · 편성 화면이 안내.
 * 다음 던전(역병 지하묘지 Lv 10)이 열리면 안내 끝. 개발 빌드 「전부 열기」와 상관없이 실제 레벨로
 */
export function firstDungeonNow(): boolean {
  const lv = G.save.player.level;
  return firstDungeonDue(G.save, lv >= contentOf('rustfort').unlockLv && lv < contentOf('crypt').unlockLv);
}

/** 지금 직업으론 잠겼지만 다른 직업으로는 들어갈 수 있으면 그 직업 (34 4장 1번: 「사제 Lv 42로 열림」). 레벨이 가장 높은 직업 */
export function otherHeroFor(lv: number): { hero: HeroKey; lv: number } | null {
  let best: { hero: HeroKey; lv: number } | null = null;
  for (const h of HERO_KEYS) {
    if (h === G.save.hero || heroStatus(h).state !== 'open') continue;
    const l = heroLevelOf(G.save, h);
    if (l >= lv && (!best || l > best.lv)) best = { hero: h, lv: l };
  }
  return best;
}

/** 지금 쓸 수 있는 단축칸 구성 (열린 칸 수만큼) */
export function itemsNow() {
  const n = itemSlots(G.save.player.level);
  return { slots: n, items: G.save.items.slice(0, n) };
}

/** 단축칸에 아이템 넣기/빼기 (편성·캐릭터 화면). 칸이 다 찼으면 안내 문구를 돌려줌 */
export function toggleItem(k: ItemKey): string {
  const { slots, items } = itemsNow();
  let msg = '';
  if (items.includes(k)) G.save.items = items.filter(x => x !== k);
  else if (items.length >= slots) msg = `단축칸 ${slots}칸이 가득 참. 뺄 아이템부터 누르기`;
  else G.save.items = (Object.keys(ITEMS) as ItemKey[]).filter(x => x === k || items.includes(x));
  commit();
  return msg;
}

/** 가방의 장비를 착용. 원래 끼던 것은 가방으로 */
export function equip(id: number): GearItem | null {
  const g = G.save.gear;
  const i = g.bag.findIndex(x => x.id === id);
  if (i < 0) return null;
  const it = g.bag[i];
  const old = g.equipped[it.slot];
  g.bag.splice(i, 1);
  if (old) g.bag.push(old);
  g.equipped[it.slot] = it;
  commit();
  return old || null;
}

/** 장비 찾기 (착용 또는 가방) */
export function findItem(id: number): GearItem | null {
  const g = G.save.gear;
  return Object.values(g.equipped).find(x => x?.id === id) || g.bag.find(x => x.id === id) || null;
}

/**
 * 강화 한 번 (34 6-5: 확률, +2 이상에서 실패하면 1단계 떨어짐). 성공은 빈 문자열, 실패·모자람은 보여 줄 글.
 * 결과는 누른 순간 저장 (껐다 켜서 다시 굴리지 못하게). roll은 테스트에서 성공·실패를 고정할 때
 */
export function enhance(id: number, roll: () => number = Math.random): string {
  const o = enhanceTry(id, roll);
  return typeof o === 'string' ? o : enhanceMsg(o);
}
/** 강화 한 번의 결과 (연출용): 각성 = 옵션 각성한 줄 번호 (34 6-5) */
export interface EnhanceOutcome { id: number; ok: boolean; from: number; to: number; awaken: number | null }
export const enhanceMsg = (o: EnhanceOutcome) => (o.ok ? '' : o.to < o.from ? `강화 실패 · +${o.from} → +${o.to}` : `강화 실패 · +${o.from} 그대로`);
/** 모자란 재료 (없으면 '') */
export function enhanceLack(it: GearItem): string {
  const c = enhanceCost(it);
  if (!c) return `이미 +${MAX_PLUS}`;
  const p = G.save.player, m = G.save.mats;
  if (p.gold < c.gold) return `골드 부족 (${c.gold.toLocaleString()} 필요)`;
  if (m.stone < c.stone) return `강화석 부족 (${c.stone}개 필요)`;
  if (m.refined < c.refined) return `정제 강화석 부족 (${c.refined}개 필요)`;
  return '';
}
/**
 * 강화 한 번 (34 6-5): 누른 순간 굴려서 저장에 먼저 넣음 (연출은 보여 주기만, 7-4). 실패하면 +2 이상은 1단계 떨어짐.
 * +3 · +6 · +9에 처음 닿으면 추가 옵션 한 줄 각성. 못 하면 이유 글
 */
export function enhanceTry(id: number, roll: () => number = Math.random): EnhanceOutcome | string {
  const it = findItem(id);
  if (!it) return '장비 없음';
  const lack = enhanceLack(it);
  if (lack) return lack;
  const c = enhanceCost(it)!, p = G.save.player, m = G.save.mats;
  p.gold -= c.gold; m.stone -= c.stone; m.refined -= c.refined;
  const from = it.plus, ok = roll() < c.rate, top = it.top ?? it.plus;
  it.plus = ok ? c.to : c.fail;
  let awaken: number | null = null;
  if (ok && c.to > top && (AWAKEN_AT as readonly number[]).includes(c.to) && it.lines?.length) {
    awaken = Math.min(it.lines.length - 1, Math.floor(roll() * it.lines.length));
    const l = it.lines[awaken];
    l.up = (l.up ?? 0) + awakenValue(l);
  }
  it.top = Math.max(top, it.plus);
  if (G.save.tut >= TUT.done) onAct(G.save, 'enhance');
  commit();
  return { id, ok, from, to: it.plus, awaken };
}

/** 재설정할 줄: 추가 옵션 (line) · 특수능력 (spec, 이름 있는 장신구 고유 효과는 안 됨) */
export type RerollKind = 'line' | 'spec';
/** 재설정 결과: err = 못 한 이유, alt = Lv 60부터 둘째 후보 (pickReroll로 바꿀 수 있음, 시트를 닫으면 사라짐) */
export interface RerollResult { err: string; alt?: GearLine | SpecLine }
export const rerollOpen = () => topLevel(G.save) >= REROLL_LEVEL;
/**
 * 재설정 (34 6-8 · 42 1-6): 그 줄 하나를 다시 굴림. 비용 = 골드 + 정제 강화석 (특수능력 3배, 이 장비에서 할수록 비쌈).
 * Lv 60부터 후보 2개: 첫 후보를 바로 넣고 둘째를 돌려줌
 */
export function reroll(id: number, kind: RerollKind, i: number, r: () => number = Math.random): RerollResult {
  const it = findItem(id);
  if (!it) return { err: '장비 없음' };
  if (!rerollOpen()) return { err: `재설정은 Lv ${REROLL_LEVEL}부터` };
  if (kind === 'line' ? !it.lines?.[i] : !it.specs?.[i]) return { err: '없는 줄' };
  const c = rerollCost(it, kind === 'spec'), p = G.save.player, m = G.save.mats;
  if (p.gold < c.gold) return { err: `골드 부족 (${c.gold.toLocaleString()} 필요)` };
  if (m.refined < c.refined) return { err: `정제 강화석 부족 (${c.refined}개 필요)` };
  p.gold -= c.gold; m.refined -= c.refined; it.rr = (it.rr ?? 0) + 1;
  const pick = topLevel(G.save) >= REROLL_PICK_LEVEL;
  let alt: GearLine | SpecLine | undefined;
  if (kind === 'line') {
    it.lines[i] = rerollLine(r, it, i);
    if (pick) alt = rerollLine(r, it, i);
  } else {
    it.specs![i] = rerollSpec(r, it, i);
    if (pick) alt = rerollSpec(r, it, i);
    noteSpecs(G.save, [it]);
  }
  it.name = itemName(it);
  commit();
  return { err: '', alt };
}
/** Lv 60 재설정의 둘째 후보로 바꿈 (비용 없음) */
export function pickReroll(id: number, kind: RerollKind, i: number, alt: GearLine | SpecLine): boolean {
  const it = findItem(id);
  if (!it) return false;
  if (kind === 'line' && it.lines?.[i]) it.lines[i] = alt as GearLine;
  else if (kind === 'spec' && it.specs?.[i]) { it.specs[i] = alt as SpecLine; noteSpecs(G.save, [it]); }
  else return false;
  commit();
  return true;
}

/** 가방 장비 분해 (착용 중인 것·잠긴 것은 안 됨). 받은 골드·재료 합 */
export function salvage(ids: number[]): { n: number; gold: number; stone: number; refined: number } {
  const g = G.save.gear, got = { n: 0, gold: 0, stone: 0, refined: 0 };
  for (const id of ids) {
    const i = g.bag.findIndex(x => x.id === id);
    if (i < 0 || g.bag[i].lock) continue;
    const v = salvageOf(g.bag[i]);
    g.bag.splice(i, 1);
    got.n++; got.gold += v.gold; got.stone += v.stone; got.refined += v.refined;
  }
  G.save.player.gold += got.gold; G.save.mats.stone += got.stone; G.save.mats.refined += got.refined;
  if (got.n) commit();
  return got;
}

export const emptySlots = () => SLOTS.filter(s => !G.save.gear.equipped[s.key]).length;

/** 장비 잠금 켜기·끄기 (27 4-3). 바뀐 뒤 잠김 여부 */
export function toggleLock(id: number): boolean {
  const it = findItem(id);
  if (!it) return false;
  if (it.lock) delete it.lock; else it.lock = true;
  commit();
  return !!it.lock;
}

/** 「일반·고급 모두」로 고를 가방 장비 (잠긴 것 빼고) */
export const lowGradeIds = () => G.save.gear.bag.filter(it => !it.lock && (it.grade === '일반' || it.grade === '고급')).map(it => it.id);

/**
 * 추천 장착 (27 4-2): 부위마다 착용·가방 중 점수(itemScore)가 가장 높은 장비. 바뀌는 부위만 돌려줌.
 * 점수가 같으면 지금 것을 그대로 둠
 */
export function bestGearPlan(): { slot: SlotKey; now: GearItem | null; next: GearItem }[] {
  const eq = G.save.gear.equipped, out: { slot: SlotKey; now: GearItem | null; next: GearItem }[] = [];
  for (const s of SLOTS) {
    const now = eq[s.key] ?? null;
    let best: GearItem | null = null;
    for (const it of G.save.gear.bag) {
      if (it.slot !== s.key) continue;
      const top = itemScore(best ?? now ?? undefined);
      if (itemScore(it) > top) best = it;
    }
    if (best) out.push({ slot: s.key, now, next: best });
  }
  return out;
}

/** 추천 장착 한 번에. 바꾼 부위 수 */
export function equipBest(): number {
  const plan = bestGearPlan();
  for (const p of plan) equip(p.next.id);
  return plan.length;
}

// ---------- 힐러 직업 (25) ----------
/** 그 직업의 저장 (없으면 기본: 기본 배치, 칸 탭 = 기본 힐 칸) */
export const heroSave = (h: HeroKey): HeroSave => heroSaveOf(G.save, h);

/** 전투에 쓸 직업: 튜토리얼은 사제로만 (25 4-1) */
export const heroNow = (): HeroKey => (G.save.tut < TUT.done ? 'priest' : G.save.hero);

// ---------- 특성 (06 6장) ----------
/** 전투에 넣을 특성: 사제만 (다른 직업 트리는 준비 중), 튜토리얼은 없음 */
export const talentsNow = (): (number | null)[] | undefined =>
  heroNow() === 'priest' && G.save.tut >= TUT.done ? heroSave('priest').talents : undefined;

/** 특성 고르기. 같은 걸 다시 누르면 풀림. 열린 단만, 언제든 무료 */
export function pickTalent(tier: number, pick: number): boolean {
  const t = TALENTS[tier];
  if (G.save.hero !== 'priest' || !t || !t.picks[pick] || t.lv > healerLevel()) return false;
  const hs = heroSave(G.save.hero);
  const a = (hs.talents ||= []);
  while (a.length < TALENTS.length) a.push(null);
  a[tier] = a[tier] === pick ? null : pick;
  if (hs.presets) hs.presets[hs.preset ?? 0] = [...a];
  commit();
  return true;
}

/** 특성 프리셋 수 (27 4-5) */
export const TALENT_PRESETS = 3;
/** 지금 특성 프리셋 (0~2) */
export const talentPreset = (h: HeroKey = G.save.hero): number => heroSave(h).preset ?? 0;

/**
 * 특성 프리셋 바꾸기 (27 4-5, 언제든 무료). 지금 고름은 지금 프리셋 칸에 넣어 두고, 고른 칸을 꺼냄.
 * 옛 저장은 지금 고름이 프리셋 1. 직업마다 따로
 */
export function setTalentPreset(i: number, h: HeroKey = G.save.hero): boolean {
  if (!Number.isInteger(i) || i < 0 || i >= TALENT_PRESETS) return false;
  const hs = heroSave(h), cur = hs.preset ?? 0;
  if (i === cur) return false;
  const ps = (hs.presets ||= []);
  while (ps.length < TALENT_PRESETS) ps.push([]);
  ps[cur] = [...(hs.talents || [])];
  hs.talents = [...ps[i]];
  hs.preset = i;
  commit();
  return true;
}

/** 직업 바꾸기가 열렸는지 (가장 높은 직업 Lv 10, 튜토리얼 뒤). dev = 개발 빌드 잠금 무시로 열림 */
export function switchOpen(): { ok: boolean; dev: boolean; why: string } {
  if (G.save.tut < TUT.done) return { ok: false, dev: false, why: '튜토리얼을 마치면 열림' };
  const under = topLevel(G.save) < HERO_SWITCH_LV;
  if (under && !G.save.settings.devUnlock) return { ok: false, dev: false, why: `Lv ${HERO_SWITCH_LV}에 열림` };
  return { ok: true, dev: under, why: '' };
}

/**
 * 직업 상태: now = 지금 직업 · open = 해금 · quest = 직업 퀘스트 중 (그 직업으로 해야 해서 고를 수 있음) · locked = 레벨 미달 (가장 높은 직업 레벨, 34 3-2).
 * 개발 빌드 「레벨 잠금 무시」면 레벨 미달 직업도 퀘스트 상태로 열림 (dev)
 */
export function heroStatus(h: HeroKey): { state: 'now' | 'open' | 'quest' | 'locked'; dev: boolean; quest: number; need: number } {
  const def = HEROES[h], hs = heroSave(h), q = def.unlock.quest;
  const info = { quest: hs.quest, need: q ? q.need : 0 };
  const under = topLevel(G.save) < def.unlock.lv;
  const unlocked = hs.unlocked || !q;
  const dev = !unlocked && under && G.save.settings.devUnlock;
  if (h === G.save.hero) return { state: 'now', dev, ...info };
  if (unlocked && !under) return { state: 'open', dev: false, ...info };
  if (!under || dev) return { state: unlocked ? 'open' : 'quest', dev, ...info };
  return { state: 'locked', dev: false, ...info };
}

/** 직업 바꾸기: 지금 직업의 휠 배치·칸 탭·레벨을 넣어 두고 새 직업 것을 꺼냄 (처음 하는 직업은 Lv 1, 34 3-2) */
export function switchHero(h: HeroKey): boolean {
  if (h === G.save.hero || !switchOpen().ok) return false;
  const st = heroStatus(h).state;
  if (st === 'locked') return false;
  const cur = heroSave(G.save.hero), next = heroSave(h), set = G.save.settings, p = G.save.player;
  cur.layout = set.layout; cur.tapKey = set.tapKey;
  set.layout = next.layout; set.tapKey = next.tapKey;
  cur.level = p.level; cur.xp = p.xp;
  p.level = next.level ?? 1; p.xp = next.xp ?? 0;
  G.save.hero = h;
  commit();
  return true;
}
