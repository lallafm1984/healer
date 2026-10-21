/** 게임 진행 상태 (기기 저장 한 덩어리) + 화면들이 같이 쓰는 규칙 */
import { dexDue, type DexReward } from '../data/dex';
import { chainNeed, chainOpen, contentOf, type ContentDef } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { HERO_KEYS, HEROES, type HeroKey } from '../data/heroes';
import { TALENT_TREES, TALENTS } from '../data/talents';
import { sellGold, SLOTS, type GearItem } from '../data/equipment';
import { MAX_LEVEL, xpToNext } from '../data/progression';
import { heroSaveOf, load, loadChar, newSave, parkChar, save, shareAccount, topLevel, wipeChars, type HeroSave, type SaveData } from '../platform/storage';
import { firstDungeonDue, TUT } from './tutorial';
import { onAct, rollover, runGold, type Rollover } from './economy';
import { adsFree } from './stamina';
import { Flow } from './flow';
import { jobProductId } from '../data/economy';

export const G: { save: SaveData } = { save: load() };

export function commit(): void { save(G.save); }

/**
 * 새것 (빨간 점): seen보다 나중에 얻었고 아직 상세를 열어 보지 않은 장비 (2026-10-17 Lim 「장비 상세보기 후 없어지게」).
 * 화면을 나가도 그대로이고, 그 장비 상세를 열거나 장착하면 그 하나만 꺼짐. 성능 비교와 알림은 별개입니다.
 */
export const isNewGear = (it: GearItem): boolean => it.id > (G.save.gear.seen ?? 0) && !G.save.gear.opened?.includes(it.id);
export const newGearCount = (): number => G.save.gear.bag.filter(isNewGear).length;

/** 그 장비를 본 것으로 (상세 열기 · 장착). 바뀌었으면 true. 새것이 다 꺼지면 seen을 올리고 opened를 비움 */
export function markGearOpened(id: number): boolean {
  const g = G.save.gear;
  if (id <= (g.seen ?? 0) || g.opened?.includes(id)) return false;
  const own = [...g.bag.map(it => it.id), ...SLOTS.map(s => g.equipped[s.key]?.id ?? 0)];
  if (!own.includes(id)) return false;
  const opened = [...(g.opened ?? []), id].filter(x => own.includes(x));
  if (g.bag.some(it => it.id > (g.seen ?? 0) && !opened.includes(it.id))) g.opened = opened;
  else { g.seen = Math.max(g.seen ?? 0, ...own); delete g.opened; }
  commit();
  return true;
}

/** 광고 제거 패키지를 샀으면 배너를 숨김 (81 3장) */
export function syncAds(): void {
  if (typeof document !== 'undefined') document.body.classList.toggle('noads', adsFree(G.save));
}

/** 날·주가 바뀌었는지 보고 일일·주간을 새로 (13 1장). 접속·로비·임무·상점 화면에서 부름 */
export function refreshDay(now = Date.now()): Rollover {
  const r = rollover(G.save, now, Math.random);
  if (r.day || r.week || r.banked || r.fixed) commit();
  syncAds();
  return r;
}

/** 저장 지우고 처음부터: 쉬는 캐릭터까지 모두 (68) */
export function resetSave(): void { wipeChars(G.save); G.save = newSave(); commit(); }

/**
 * 개발 테스트: 현재 캐릭터의 공통 레벨만 올린다 (장비 · 재화 유지). 스킬 · 특성 · 콘텐츠 열림은 레벨에서 따라온다.
 * 경험치는 그대로 두되 새 레벨에서 넘치지 않게, 만렙이면 0. 전투 · 정산 중이거나 더 오를 레벨이 없으면 false
 */
function setTestLevel(level: number): boolean {
  const p = G.save.player, to = Math.min(MAX_LEVEL, level);
  if (Flow.running || to <= p.level) return false;
  p.level = to;
  p.xp = to >= MAX_LEVEL ? 0 : Math.min(p.xp, xpToNext(to) - 1);
  commit();
  return true;
}
export const setTestMaxLevel = (): boolean => setTestLevel(MAX_LEVEL);
/** 개발 테스트 「레벨 +10」 (2026-10-20 Lim): 누를 때마다 10씩, Lv 100에서 멈춤 */
export const TEST_LEVEL_STEP = 10;
export const setTestLevelUp = (): boolean => setTestLevel(G.save.player.level + TEST_LEVEL_STEP);

/** 전투에 넘길 힐러 레벨 (스킬 해금 기준). 개발 빌드 「스킬 전부 열기」면 100 */
export const healerLevel = () => (G.save.settings.allSkills ? 100 : G.save.player.level);

/**
 * 잠금: 콘텐츠·난이도 해금 레벨 (지금 직업 레벨 기준, 34 4장 1번) + 탐험 · 던전 난이도 사슬 (앞 난이도를 깨야 열림, 61 1-1.
 * 적 레벨이 내 레벨 이하인 난이도는 사슬 없이 열림, 86).
 * dev = 개발 빌드 레벨 잠금 무시. 사슬은 레벨 잠금이 아니라 개발 빌드에서도 그대로 (플레이 테스트에서 보이게). need = 사슬로 잠겼을 때 먼저 깰 난이도
 */
export function lockOf(c: ContentDef, d?: DiffName): { lv: number; locked: boolean; dev: boolean; need: DiffName | null } {
  const lv = Math.max(c.unlockLv, (d && c.diffUnlock?.[d]) || 0);
  const under = G.save.player.level < lv;
  const dev = under && G.save.settings.devUnlock && c.ready;
  const chain = !!d && !chainOpen(c, d, G.save.clears[c.key], G.save.player.level);
  return { lv, locked: (under && !dev) || chain, dev, need: chain ? chainNeed(c, d!) : null };
}

/**
 * 첫 던전 안내 차례 (34 5-2): 튜토리얼 뒤 녹슨 요새 레벨(Lv 5)이 됐는데 아직 못 깸 → 로비 · 모험 · 편성 화면이 안내.
 * 다음 던전(역병 지하묘지 Lv 10)이 열리면 안내 끝. 개발 빌드 「전부 열기」와 상관없이 실제 레벨로
 */
export function firstDungeonNow(): boolean {
  const lv = G.save.player.level;
  return firstDungeonDue(G.save, lv >= contentOf('rustfort').unlockLv && lv < contentOf('crypt').unlockLv);
}

/** v12 공통 레벨: 직업을 바꿔 콘텐츠 레벨 제한을 우회할 수 없음. 기존 화면 호출 호환 */
export function otherHeroFor(_lv: number): { hero: HeroKey; lv: number } | null { return null; }

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
  // 고른 장비는 본 것으로 (나중에 벗어도 새것 점이 다시 켜지지 않게)
  if (!markGearOpened(it.id)) commit();
  return old || null;
}

/** 장비 찾기 (착용 또는 가방) */
export function findItem(id: number): GearItem | null {
  const g = G.save.gear;
  return Object.values(g.equipped).find(x => x?.id === id) || g.bag.find(x => x.id === id) || null;
}


/** 가방 장비 판매 (91, 예전 분해 자리. 착용 중인 것·잠긴 것은 안 됨). 받은 골드 합. 한 개마다 일일 임무 「장비 판매」 1 */
export function sell(ids: number[]): { n: number; gold: number } {
  const g = G.save.gear, got = { n: 0, gold: 0 };
  for (const id of ids) {
    const i = g.bag.findIndex(x => x.id === id);
    if (i < 0 || g.bag[i].lock) continue;
    const v = sellGold(g.bag[i]);
    g.bag.splice(i, 1);
    for (const h of HERO_KEYS) {
      const refs = G.save.heroes[h]?.loadout;
      if (refs) for (const { key } of SLOTS) if (refs[key] === id) delete refs[key];
    }
    got.n++; got.gold += v;
    if (G.save.tut >= TUT.done) onAct(G.save, 'sell');
  }
  G.save.player.gold += got.gold;
  if (got.n) commit();
  return got;
}

/** 장비 도감 보상 받기 (34 6-10 ④): 채운 칸 DEX_STEP마다 쌓인 보상을 한 번에. 받을 게 없으면 steps 0 */
export function claimDex(): DexReward & { steps: number } {
  const g = G.save.gear, due = dexDue(g.dex.length, g.dexPaid, runGold(topLevel(G.save)));
  if (!due.steps) return due;
  g.dexPaid += due.steps;
  G.save.player.gold += due.gold;
  commit();
  return due;
}

/** 장비 잠금 켜기·끄기 (27 4-3). 바뀐 뒤 잠김 여부 */
export function toggleLock(id: number): boolean {
  const it = findItem(id);
  if (!it) return false;
  if (it.lock) delete it.lock; else it.lock = true;
  commit();
  return !!it.lock;
}

// ---------- 힐러 직업 (25) ----------
/** 그 직업의 저장 (없으면 기본: 기본 배치, 칸 탭 = 기본 힐 칸) */
export const heroSave = (h: HeroKey): HeroSave => heroSaveOf(G.save, h);

/** 전투에 쓸 직업: 튜토리얼은 사제로만 (25 4-1) */
export const heroNow = (): HeroKey => (G.save.tut < TUT.done ? 'priest' : G.save.hero);

// ---------- 특성 (06 6장 사제, 77 드루이드 · 성기사) ----------
/** 전투에 넣을 특성: 지금 직업의 트리 (튜토리얼은 없음) */
export const talentsNow = (): (number | null)[] | undefined =>
  G.save.tut >= TUT.done ? heroSave(heroNow()).talents : undefined;

/** 특성 고르기. 같은 걸 다시 누르면 풀림. 지금 직업 트리의 열린 단만, 언제든 무료 */
export function pickTalent(tier: number, pick: number): boolean {
  const t = TALENT_TREES[G.save.hero][tier];
  if (!t || !t.picks[pick] || t.lv > healerLevel()) return false;
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

// ---------- 캐릭터 (68): 타이틀 → 캐릭터 선택 → 게임 시작. 캐릭터마다 따로 계정처럼 ----------

/** 캐릭터 선택에 보일 칸 하나 (cur = 지금 캐릭터) */
export interface CharCard { id: number; hero: HeroKey; name: string; level: number; at: number; cur: boolean }

/** 만든 캐릭터들 (만든 순서). 산 칸 수 · 값은 economy slotOffer */
export function charList(): CharCard[] {
  const r = G.save.roster;
  return r.chars.map(c => ({ id: c.id, hero: c.hero, name: c.name, level: c.id === r.cur ? G.save.player.level : c.level, at: c.at, cur: c.id === r.cur }));
}

/** 이름 (최대 8자). 안 적으면 직업 이름, 같은 이름이 있으면 「사제 2」 */
export const CHAR_NAME_MAX = 8;
function charName(h: HeroKey, name: string): string {
  const names = G.save.roster.chars.map(c => c.name);
  const want = name.trim().slice(0, CHAR_NAME_MAX);
  if (want) return want;
  const base = HEROES[h].name;
  if (!names.includes(base)) return base;
  let n = 2;
  while (names.includes(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** 지금 캐릭터를 쉬게 두고 next로: 둘 다 날 · 주를 넘기고, 계정 것 (설정 · 산 것 · 휴식 · 목록)을 옮김 (캐릭터를 바꿔 휴식을 두 번 쓰지 않게) */
function swapTo(next: SaveData, id: number, now: number): void {
  const cur = G.save;
  rollover(cur, now, Math.random);
  rollover(next, now, Math.random);
  shareAccount(cur, next);
  parkChar(cur);
  const r = next.roster, c = r.chars.find(x => x.id === id)!;
  r.cur = id; c.at = now; delete c.park;
  G.save = next;
  commit();
  syncAds();
}

/** 캐릭터 고르기 (캐릭터 선택). 지금 캐릭터거나 없으면 false */
export function pickChar(id: number, now = Date.now()): boolean {
  if (Flow.running) return false;
  const next = loadChar(G.save, id);
  if (!next) return false;
  swapTo(next, id, now);
  return true;
}

/**
 * 빈 칸에 새 캐릭터 만들기 (68 2장): Lv 1 · 맨몸 · 빈 도감, 튜토리얼은 계정에 한 번이라 건너뜀.
 * 만들면 그 캐릭터로 바뀜. 성공 = 빈 문자열, 아니면 이유
 */
export function makeChar(h: HeroKey, name = '', now = Date.now()): string {
  if (Flow.running) return '정산 후 생성 가능';
  const r = G.save.roster;
  if (G.save.tut < TUT.done) return '튜토리얼을 마치면 만들 수 있음';
  if (!HEROES[h]) return '없는 직업';
  if (r.chars.length >= r.slots) return '빈 칸이 없음 (상점에서 캐릭터 칸 사기)';
  const d = newSave(now);
  d.hero = h; d.tut = TUT.done;
  heroSaveOf(d, h).unlocked = true;
  const id = r.next++;
  r.chars.push({ id, hero: h, name: charName(h, name), level: 1, at: now });
  swapTo(d, id, now);
  return '';
}

/** v12: 튜토리얼 뒤, 출발 전이나 정산 후 무료 직업 전환 */
export function switchOpen(): { ok: boolean; dev: boolean; why: string } {
  if (Flow.running) return { ok: false, dev: false, why: '정산 후 변경 가능' };
  if (G.save.tut < TUT.done) return { ok: false, dev: false, why: '튜토리얼을 마치면 열림' };
  return { ok: true, dev: false, why: '' };
}

/**
 * 직업 해금 (81): 드루이드 · 성기사는 지금 캐릭터 레벨 (Lv 20 · 30), 상점 직업 (unlock.buy)은 산 계정이면 레벨 조건 없이.
 * 이전에 해금한 직업 (그 직업으로 바꾼 적 있음)은 레벨 · 구매와 관계없이 보존. buy = 잠겼고 상점에서 사야 열림.
 * 개발 빌드 「전 직업 선택」 (`devJobs`)이 켜져 있으면 잠긴 직업도 open (dev), 그 직업으로 바꿔도 해금 기록은 남기지 않음
 */
export function heroStatus(h: HeroKey): { state: 'now' | 'open' | 'locked'; dev: boolean; buy: boolean } {
  const info = { dev: false, buy: false };
  if (h === G.save.hero) return { state: 'now', ...info };
  if (heroEarned(h)) return { state: 'open', ...info };
  // 개발 빌드 「전 직업 선택」: 잠긴 직업도 열림 (dev = 이 설정 덕에 열림, 상점으로 보내지 않음)
  if (G.save.settings.devJobs) return { state: 'open', ...info, dev: true };
  return { state: 'locked', ...info, buy: !!HEROES[h].unlock.buy };
}

/** 개발 설정 없이 열린 직업: 예전에 해금 · 산 직업 · 레벨 조건 */
function heroEarned(h: HeroKey): boolean {
  const u = HEROES[h].unlock;
  return !!G.save.heroes[h]?.unlocked || (u.buy ? G.save.bought.includes(jobProductId(h)) : G.save.player.level >= u.lv);
}

/** v12: 같은 캐릭터에서 직업·스킬·착용 조합만 전환. 보상·성장·실물 장비는 공유 */
export function switchHero(h: HeroKey, now = Date.now()): boolean {
  if (!HEROES[h] || h === G.save.hero || !switchOpen().ok || heroStatus(h).state !== 'open') return false;
  const d = G.save, old = heroSaveOf(d, d.hero), next = heroSaveOf(d, h);
  old.layout = d.settings.layout ? { ...d.settings.layout } : null;
  old.tapKey = d.settings.tapKey;
  // 「전 직업 선택」으로만 들어간 직업은 해금으로 남기지 않음 (설정을 끄면 다시 잠김)
  if (heroEarned(d.hero)) old.unlocked = true;
  old.loadout = Object.fromEntries(Object.entries(d.gear.equipped).filter(([, it]) => !!it).map(([slot, it]) => [slot, it!.id]));
  if (next.loadout) {
    const owned = new Map([...d.gear.bag, ...Object.values(d.gear.equipped).filter((it): it is GearItem => !!it)].map(it => [it.id, it]));
    d.gear.equipped = {};
    for (const { key } of SLOTS) {
      const it = owned.get(next.loadout[key]!);
      if (it?.slot === key) { d.gear.equipped[key] = it; owned.delete(it.id); }
    }
    d.gear.bag = [...owned.values()];
  }
  if (heroEarned(h)) next.unlocked = true;
  d.hero = h;
  d.settings.layout = next.layout ? { ...next.layout } : null;
  d.settings.tapKey = next.tapKey;
  const me = d.roster.chars.find(c => c.id === d.roster.cur);
  if (me) { me.hero = h; me.at = now; }
  commit();
  return true;
}
