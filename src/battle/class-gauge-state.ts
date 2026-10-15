import type { Fight } from '../engine';
import { HEROES } from '../data/heroes';
import { shardMax, starsNow } from '../engine/astro';
import { beatMax } from '../engine/monk';
import { springSec } from '../engine/shaman';
import { judgeCount, sealed, sealTargets } from '../engine/warder';

export interface ClassGaugeState {
  count: number; max: number; percent: number; remaining: number; cooldown: number;
  earth: boolean; targets: number; targetMax: number; description: string;
}
export function classGaugeState(f: Fight): ClassGaugeState {
  const live = f.party.filter(u => u.alive);
  const s: ClassGaugeState = { count: 0, max: 1, percent: 0, remaining: 0, cooldown: 0, earth: false, targets: 0, targetMax: 3, description: '' };
  switch (f.hero) {
    case 'priest':
      s.count = Math.floor(f.g.p); s.max = 100; s.description = `평온 ${s.count}%`; break;
    case 'druid':
      s.count = live.filter(u => u.hots.some(h => h.key === 'sprout' && h.left > 0)).length;
      s.max = Math.max(1, live.length); s.description = `새싹 적용 ${s.count}/${live.length}명`; break;
    case 'paladin':
      s.count = f.power3; s.max = 3;
      s.description = `신성한 힘 ${s.count}/3, 봉화 ${f.party.find(u => u.id === f.beacon)?.nick ?? '없음'}, 변경 대기 ${Math.ceil(f.beaconCd)}초`; break;
    case 'shaman':
      s.remaining = Math.max(0, ...f.totems.filter(t => t.kind === 'spring').map(t => t.until - f.t));
      s.count = s.remaining; s.max = springSec(f); s.cooldown = Math.max(0, f.cd.springTotem ?? 0);
      s.earth = f.totems.some(t => t.kind === 'earth' && t.until > f.t);
      s.description = `샘 토템 ${s.remaining.toFixed(1)}초, 재사용 대기 ${s.cooldown.toFixed(1)}초, 대지 토템 ${s.earth ? '활성' : '비활성'}`; break;
    case 'monk':
      s.max = beatMax(f); s.count = f.level >= HEROES.monk.system.lv ? f.beat : 0;
      s.remaining = s.count > 0 ? Math.max(0, f.beatUntil - f.t) : 0;
      s.description = `기 리듬 ${s.count}/${s.max}, 유지 시간 ${s.remaining.toFixed(1)}초`; break;
    case 'astrologer':
      s.count = f.shards; s.max = shardMax(f);
      s.description = `별 조각 ${s.count}/${s.max}, 다음 별자리 별 ${starsNow(f)}개`; break;
    case 'warder':
      s.count = live.filter(u => sealed(f, u)).length; s.max = Math.max(1, live.length);
      s.targetMax = judgeCount(f); s.targets = sealTargets(f, s.targetMax).length;
      s.description = `인장 ${s.count}/${live.length}명, 심판 회복 대상 ${s.targets}/${s.targetMax}명`; break;
  }
  s.percent = Math.max(0, Math.min(100, s.count / s.max * 100));
  return s;
}
