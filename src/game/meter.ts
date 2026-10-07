/**
 * 딜미터기 (2026-10-07 Lim: 전투 끝나고 보여 줌). 휴식 화면(이번 구간)과 정산 화면(던전 전체)이 같이 씀.
 * 파티원 이름으로 모음: 던전 구간마다 전투를 새로 만들어도 같은 파티라 이름이 같음
 */
import { ABILITIES } from '../data/abilities';
import { CLASSES, type ClassKey } from '../data/classes';
import type { Role } from '../engine/types';

export interface MeterRow {
  nick: string;
  role: Role;
  cls: ClassKey | null;
  /** 넣은 피해 합 */
  dmg: number;
  /** 특수 능력과 쓴 횟수 (17 11장: 정산 미터기에 능력 사용) */
  ab?: string;
  abN?: number;
}

const ROLE_COLOR: Record<Role, string> = { tank: '#8A97AD', melee: '#C9875E', ranged: '#6FA8A2', healer: '#E9E1C6' };
const ROLE_NAME: Record<Role, string> = { tank: '탱커', melee: '근접', ranged: '원거리', healer: '힐러' };

/** 전투 하나의 파티원 딜을 합침 (힐러 제외) */
export function addMeter(rows: MeterRow[], party: { nick: string; role: Role; cls: ClassKey | null; dealt: number; me: boolean; ab?: { key: string; uses: number } | null }[]): MeterRow[] {
  for (const u of party) {
    if (u.me) continue;
    const r = rows.find(x => x.nick === u.nick);
    if (r) { r.dmg += u.dealt; if (u.ab) r.abN = (r.abN || 0) + u.ab.uses; }
    else rows.push({ nick: u.nick, role: u.role, cls: u.cls, dmg: u.dealt, ...(u.ab ? { ab: u.ab.key, abN: u.ab.uses } : {}) });
  }
  return rows;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const num = (n: number) => Math.round(n).toLocaleString('ko-KR');

/** 피해량 순 막대. sec = 전투 시간 합 (초당 피해 계산), heal = 내 치유량 (맨 아래 한 줄) */
export function meterHtml(rows: MeterRow[], sec: number, o: { title?: string; heal?: number } = {}): string {
  const list = rows.filter(r => r.dmg > 0 || rows.length < 8).slice().sort((a, b) => b.dmg - a.dmg);
  if (!list.length) return '';
  const top = Math.max(1, list[0].dmg), total = list.reduce((s, r) => s + r.dmg, 0) || 1, t = Math.max(1, sec);
  const li = list.map((r, i) => {
    const ab = r.ab && ABILITIES[r.ab];
    const sub = `${r.cls ? CLASSES[r.cls].name : ROLE_NAME[r.role]}${ab && r.abN ? ` · ${esc(ab.name)} ${r.abN}회` : ''}`;
    return `<li style="--w:${((r.dmg / top) * 100).toFixed(1)}%;--c:${ROLE_COLOR[r.role]}"><i class="rk">${i + 1}</i><b>${esc(r.nick)}</b><small>${sub}</small><span class="v">${num(r.dmg)}<small>${num(r.dmg / t)}/초 · ${Math.round((r.dmg / total) * 100)}%</small></span></li>`;
  }).join('');
  const heal = o.heal != null ? `<p class="mheal"><b>내 치유</b><span>${num(o.heal)}<small>${num(o.heal / t)}/초</small></span></p>` : '';
  return `<section class="meter"><h3>${o.title || '딜미터기'}<small>피해량 · 초당 · 비율</small></h3><ol>${li}</ol>${heal}</section>`;
}
