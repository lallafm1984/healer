/**
 * 장비 도감 (34 6-10 ④): 종류 30 · 세력 생김새 · 이름 있는 장신구 · 고유 무기 · 방어구. 처음 얻을 때 칸이 채워짐 (등급 상관없이).
 * 보상: DEX_STEP칸마다 골드 · 강화석 (다섯 번째마다 정제 강화석도), 묶음을 다 채우면 칭호. 능력치 보너스는 없음 (세트처럼 되지 않게).
 * 칸 키: k:<종류> · l:<세력>:<종류> · n:<이름 있는 장신구> · u:<고유 장비>
 */
import { hasLookArt, KINDS, LOOKS, type GearItem } from './equipment';
import { FACTIONS, type FactionKey } from './places';
import { NAMED, SPEC_TITLES } from './specials';
import { UNIQUES } from './uniques';

export type DexTab = 'kind' | 'look' | 'named' | 'unique';
/** 묶음 이름 · 다 채우면 받는 칭호 (이름 있는 장신구는 특수능력 도감 칭호와 같음) */
export const DEX_TABS: { key: DexTab; name: string; title: string }[] = [
  { key: 'kind', name: '종류', title: '장비 감정사' },
  { key: 'look', name: '세력', title: '세력 수집가' },
  { key: 'named', name: '장신구', title: SPEC_TITLES.named },
  { key: 'unique', name: '고유', title: '고유 장비 사냥꾼' },
];

export function dexKeys(tab: DexTab): string[] {
  switch (tab) {
    case 'kind': return KINDS.map(k => `k:${k.key}`);
    case 'look': return (Object.keys(FACTIONS) as FactionKey[]).flatMap(f => LOOKS[f].map(k => `l:${f}:${k}`));
    case 'named': return NAMED.map(n => `n:${n.key}`);
    case 'unique': return UNIQUES.map(u => `u:${u.key}`);
  }
}
export const DEX_ALL = (): string[] => DEX_TABS.flatMap(t => dexKeys(t.key));

/** 장비 한 개가 채우는 칸: 종류 (늘) · 세력 생김새 (그림이 따로 있는 것) · 이름 있는 장신구 · 고유 장비 */
export function dexKeysOf(it: GearItem): string[] {
  const out = [`k:${it.kind}`];
  if (it.look && hasLookArt(it)) out.push(`l:${it.look}:${it.kind}`);
  if (it.named) out.push(`n:${it.named}`);
  if (it.unique) out.push(`u:${it.unique}`);
  return out;
}
export const dexTabOf = (key: string): DexTab | undefined => ({ k: 'kind', l: 'look', n: 'named', u: 'unique' } as const)[key[0] as 'k' | 'l' | 'n' | 'u'];

/** 보상 단계: DEX_STEP칸마다 한 번 */
export const DEX_STEP = 10;
export interface DexReward { gold: number; stone: number; refined: number }
/** n번째 보상 (1부터): 골드 600 · 강화석 5, 다섯 번째마다 정제 강화석 2 */
export const dexReward = (n: number): DexReward => ({ gold: 600, stone: 5, refined: n % 5 === 0 ? 2 : 0 });
/** 받을 수 있는 보상 (채운 칸 수 · 이미 받은 단계 수) */
export function dexDue(have: number, paid: number): DexReward & { steps: number } {
  const out = { gold: 0, stone: 0, refined: 0, steps: 0 };
  for (let n = paid + 1; n <= Math.floor(have / DEX_STEP); n++) {
    const r = dexReward(n);
    out.gold += r.gold; out.stone += r.stone; out.refined += r.refined; out.steps++;
  }
  return out;
}
