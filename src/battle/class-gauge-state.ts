import type { Fight } from '../engine';
import { HEROES } from '../data/heroes';
import { shardMax, starsNow } from '../engine/astro';
import { beatMax } from '../engine/monk';
import { springSec } from '../engine/shaman';
import { guardSec } from '../engine/specials';
import { SHAMAN } from '../data/heroConst';
import { wordCap } from '../engine/talents';
import { costOf } from '../engine/talents';
import { canTarget, knows } from '../engine/healer';
import { SKILLS } from '../data/skills';
import { judgeCount, sealed, sealTargets } from '../engine/warder';

export interface ClassGaugeState {
  count: number; max: number; percent: number; remaining: number;
  /** 주술사 대지 토템 남은 시간 · 처음 길이 (2026-10-18 Lim 「대지 토템도 샘 토템처럼 지속시간」, 재사용 시간은 스킬 버튼에 보여 자원 칸에서 뺌) */
  earthRemaining: number; earthMax: number;
  earth: boolean; targets: number; targetMax: number; description: string;
  priestAura: 'off' | 'gold' | 'blue';
  paladinWaveReady: boolean;
  beaconName: string | null;
  /** 드루이드 잎 · 결계사 인장처럼 사람을 세는 다섯 칸에서 켜는 칸 수 (통째로만, 다른 직업은 null) */
  lit: number | null;
}
/**
 * 사람을 세는 다섯 칸 (2026-10-28 Lim 「인장 둘째 칸이 제대로 안 차는」): 칸을 일부만 채우지 않는다.
 * 살아 있는 사람이 칸 수 이하면 칸 하나 = 한 명. 레이드처럼 더 많으면 비율대로 반올림하되, 한 명이라도 있으면 1칸 · 다 차야 마지막 칸
 */
export function wholeCells(count: number, live: number, slots = 5): number {
  if (count <= 0 || live <= 0) return 0;
  if (count >= live) return Math.min(slots, live);
  if (live <= slots) return count;
  return Math.max(1, Math.min(slots - 1, Math.round(count / live * slots)));
}
const nicknameSegments = new Intl.Segmenter('ko', { granularity: 'grapheme' });
/** 닉네임은 표시 글자 단위로 5자까지. 전체 이름은 접근성 설명에 보존한다. */
export function beaconLabel(name: string | null): string {
  return name ? Array.from(nicknameSegments.segment(name)).slice(0,5).map(s=>s.segment).join('') : '미지정';
}
/** 즉시 시전 가능 표시. use()와 같은 대상·비용·잠금을 읽고 전투 상태는 바꾸지 않는다.
 * 파도는 자체 쿨다운이 없다. GCD만 남으면 예약이므로 끄고, 기존 시전은 취소 후 즉시 사용 가능하다. */
export function paladinWaveReady(f: Fight): boolean {
  const key='lightWave',sk=SKILLS[key];
  if(f.hero!=='paladin'||f.over||!knows(f,key)||f.lock[key]||(sk.cd&&(f.cd[key]??0)>0)||(!f.cast&&f.gcd>0))return false;
  return f.party.some(u=>{
    const target=canTarget(f,key,u.cell);
    return target.ok&&f.mana>=costOf(f,key,target.u);
  });
}
export function classGaugeState(f: Fight): ClassGaugeState {
  const live = f.party.filter(u => u.alive);
  const s: ClassGaugeState = { count: 0, max: 1, percent: 0, remaining: 0, earthRemaining: 0, earthMax: 1, earth: false, targets: 0, targetMax: 3, description: '', priestAura: 'off', paladinWaveReady:false, beaconName:null, lit:null };
  switch (f.hero) {
    case 'priest':
      s.count = Math.floor(f.g.p); s.max = 100; s.description = `평온 ${s.count}%`; break;
    case 'druid':
      s.count = live.filter(u => u.hots.some(h => h.key === 'sprout' && h.left > 0)).length;
      s.max = Math.max(1, live.length); s.lit = wholeCells(s.count, live.length); s.description = `새싹 적용 ${s.count}/${live.length}명`; break;
    case 'paladin':
      s.count = f.power3; s.max = 3;
      s.paladinWaveReady=paladinWaveReady(f);
      s.beaconName=f.party.find(u => u.id === f.beacon)?.nick ?? null;
      s.description = `신성한 힘 ${s.count}/3, 빛의 파도 ${s.paladinWaveReady?'사용 가능':'대기'}, 봉화 ${s.beaconName || '미지정'}, 변경 대기 ${Math.ceil(f.beaconCd)}초`; break;
    case 'shaman':
      s.remaining = Math.max(0, ...f.totems.filter(t => t.kind === 'spring').map(t => t.until - f.t));
      s.count = s.remaining; s.max = springSec(f);
      s.earthRemaining = Math.max(0, ...f.totems.filter(t => t.kind === 'earth').map(t => t.until - f.t));
      s.earthMax = guardSec(f, SHAMAN.earth.sec); s.earth = s.earthRemaining > 0;
      s.description = `샘 토템 ${s.remaining.toFixed(1)}초, 대지 토템 ${s.earthRemaining.toFixed(1)}초`; break;
    case 'monk':
      s.max = beatMax(f); s.count = f.level >= HEROES.monk.system.lv ? f.beat : 0;
      s.remaining = s.count > 0 ? Math.max(0, f.beatUntil - f.t) : 0;
      s.description = `기 리듬 ${s.count}/${s.max}, 유지 시간 ${s.remaining.toFixed(1)}초`; break;
    case 'astrologer':
      s.count = f.shards; s.max = shardMax(f);
      s.description = `별 조각 ${s.count}/${s.max}, 다음 별자리 별 ${starsNow(f)}개`; break;
    case 'warder':
      s.count = live.filter(u => sealed(f, u)).length; s.max = Math.max(1, live.length); s.lit = wholeCells(s.count, live.length);
      s.targetMax = judgeCount(f); s.targets = sealTargets(f, s.targetMax).length;
      s.description = `인장 ${s.count}/${live.length}명, 심판 회복 대상 ${s.targets}/${s.targetMax}명`; break;
  }
  s.percent = Math.max(0, Math.min(100, s.count / s.max * 100));
  // 같은 후광 레이어가 100% 금빛 → 저장 특성의 200% 청백색으로 전환된다.
  if (f.hero === 'priest') s.priestAura = f.g.p < 100 ? 'off' : wordCap(f) > 100 && f.g.p >= 200 ? 'blue' : 'gold';
  return s;
}
