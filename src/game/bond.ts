/**
 * 인연 기록 (길드 v2 `93` 3-2, 사슬 3번): 판마다 함께한 파티원과 점수를 쌓는다. 화면은 길드 v2 핵심 PR (4번째)에서.
 * 튜토리얼 판은 안 셈, 자동 전투도 셈, 진 판 · 포기한 판은 만남만 (점수는 그대로). 길드가 꺼져 있어도 기록 (결성 때 씀).
 * 점수 규칙 · 역할 차이 보정은 data/bond.ts
 */
import { bondPoints, type BondUnit } from '../data/bond';
import type { BattleResult } from './settle';
import type { BondRec, SaveData } from '../platform/storage';

/** 이 판에서 사람마다 오른 점수 (결과 화면 · 길드 v2가 씀) */
export interface BondGain { nick: string; pt: number; helped: boolean; saved: boolean }

export const newBondRec = (): BondRec => ({ pt: 0, met: 0, wins: 0, saved: 0, mvp: 0 });

/** 판 하나를 인연에 적음. s = S 등급. 이긴 판의 오른 점수를 돌려줌 */
export function recordBond(save: SaveData, r: BattleResult, s: boolean): BondGain[] {
  const party = r.party.filter(p => p.role === 'tank' || p.role === 'melee' || p.role === 'ranged');
  if (!party.length) return [];
  for (const p of party) (save.users[p.nick] ??= newBondRec()).met++;
  if (!r.win || r.quit) return [];
  const units: BondUnit[] = party.map(p => ({ nick: p.nick, role: p.role as BondUnit['role'], alive: p.alive, got: p.got ?? 0, low: p.low ?? 1, rescued: !!p.rescued }));
  const { pts, helped, saved } = bondPoints(units, party.length + 1, s);
  const top = r.meter?.filter(m => m.role !== 'healer').reduce<{ nick: string; dmg: number } | null>((a, m) => (!a || m.dmg > a.dmg ? m : a), null);
  const out: BondGain[] = [];
  for (const p of party) {
    const rec = save.users[p.nick]!, pt = pts.get(p.nick) ?? 0;
    rec.pt += pt; rec.wins++;
    if (saved.includes(p.nick)) rec.saved++;
    if (top && top.nick === p.nick) rec.mvp++;
    out.push({ nick: p.nick, pt, helped: helped.includes(p.nick), saved: saved.includes(p.nick) });
  }
  return out;
}
