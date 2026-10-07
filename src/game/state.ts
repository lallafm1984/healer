/** 게임 진행 상태 (기기 저장 한 덩어리) + 화면들이 같이 쓰는 규칙 */
import type { ContentDef } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { HERO_SWITCH_LV, HEROES, type HeroKey } from '../data/heroes';
import { TALENTS } from '../data/talents';
import { enhanceCost, MAX_PLUS, salvageOf, SLOTS, type GearItem } from '../data/equipment';
import { ITEMS, type ItemKey } from '../data/items';
import { itemSlots } from '../data/progression';
import { heroSaveOf, load, newSave, save, type HeroSave, type SaveData } from '../platform/storage';
import { TUT } from './tutorial';

export const G: { save: SaveData } = { save: load() };

export function commit(): void { save(G.save); }

export function resetSave(): void { G.save = newSave(); commit(); }

/** 전투에 넘길 힐러 레벨 (스킬 해금 기준). 개발 빌드 「스킬 전부 열기」면 100 */
export const healerLevel = () => (G.save.settings.allSkills ? 100 : G.save.player.level);

/** 잠금: 콘텐츠·난이도 해금 레벨. dev = 개발 빌드 잠금 무시 */
export function lockOf(c: ContentDef, d?: DiffName): { lv: number; locked: boolean; dev: boolean } {
  const lv = Math.max(c.unlockLv, (d && c.diffUnlock?.[d]) || 0);
  const under = G.save.player.level < lv;
  const dev = under && G.save.settings.devUnlock && c.ready;
  return { lv, locked: under && !dev, dev };
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

/** 강화 한 단계 (12 3-2, 실패 없음). 모자라면 이유를 돌려줌 */
export function enhance(id: number): string {
  const it = findItem(id);
  if (!it) return '장비 없음';
  const c = enhanceCost(it);
  if (!c) return `이미 +${MAX_PLUS}`;
  const p = G.save.player, m = G.save.mats;
  if (p.gold < c.gold) return `골드 부족 (${c.gold.toLocaleString()} 필요)`;
  if (m.stone < c.stone) return `강화석 부족 (${c.stone}개 필요)`;
  if (m.refined < c.refined) return `정제 강화석 부족 (${c.refined}개 필요)`;
  p.gold -= c.gold; m.stone -= c.stone; m.refined -= c.refined;
  it.plus = c.to;
  commit();
  return '';
}

/** 가방 장비 분해 (착용 중인 건 안 됨). 받은 골드·재료 합 */
export function salvage(ids: number[]): { n: number; gold: number; stone: number; refined: number } {
  const g = G.save.gear, got = { n: 0, gold: 0, stone: 0, refined: 0 };
  for (const id of ids) {
    const i = g.bag.findIndex(x => x.id === id);
    if (i < 0) continue;
    const v = salvageOf(g.bag[i]);
    g.bag.splice(i, 1);
    got.n++; got.gold += v.gold; got.stone += v.stone; got.refined += v.refined;
  }
  G.save.player.gold += got.gold; G.save.mats.stone += got.stone; G.save.mats.refined += got.refined;
  if (got.n) commit();
  return got;
}

export const emptySlots = () => SLOTS.filter(s => !G.save.gear.equipped[s.key]).length;

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
  commit();
  return true;
}

/** 직업 바꾸기가 열렸는지 (Lv 10, 튜토리얼 뒤). dev = 개발 빌드 잠금 무시로 열림 */
export function switchOpen(): { ok: boolean; dev: boolean; why: string } {
  if (G.save.tut < TUT.done) return { ok: false, dev: false, why: '튜토리얼을 마치면 열림' };
  const under = G.save.player.level < HERO_SWITCH_LV;
  if (under && !G.save.settings.devUnlock) return { ok: false, dev: false, why: `Lv ${HERO_SWITCH_LV}에 열림` };
  return { ok: true, dev: under, why: '' };
}

/**
 * 직업 상태: now = 지금 직업 · open = 해금 · quest = 직업 퀘스트 중 (그 직업으로 해야 해서 고를 수 있음) · locked = 레벨 미달.
 * 개발 빌드 「레벨 잠금 무시」면 레벨 미달 직업도 퀘스트 상태로 열림 (dev)
 */
export function heroStatus(h: HeroKey): { state: 'now' | 'open' | 'quest' | 'locked'; dev: boolean; quest: number; need: number } {
  const def = HEROES[h], hs = heroSave(h), q = def.unlock.quest;
  const info = { quest: hs.quest, need: q ? q.need : 0 };
  const under = G.save.player.level < def.unlock.lv;
  const unlocked = hs.unlocked || !q;
  const dev = !unlocked && under && G.save.settings.devUnlock;
  if (h === G.save.hero) return { state: 'now', dev, ...info };
  if (unlocked && !under) return { state: 'open', dev: false, ...info };
  if (!under || dev) return { state: unlocked ? 'open' : 'quest', dev, ...info };
  return { state: 'locked', dev: false, ...info };
}

/** 직업 바꾸기: 지금 직업의 휠 배치·칸 탭을 넣어 두고 새 직업 것을 꺼냄 */
export function switchHero(h: HeroKey): boolean {
  if (h === G.save.hero || !switchOpen().ok) return false;
  const st = heroStatus(h).state;
  if (st === 'locked') return false;
  const cur = heroSave(G.save.hero), next = heroSave(h), set = G.save.settings;
  cur.layout = set.layout; cur.tapKey = set.tapKey;
  set.layout = next.layout; set.tapKey = next.tapKey;
  G.save.hero = h;
  commit();
  return true;
}
