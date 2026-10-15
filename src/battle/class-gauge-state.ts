import type { Fight } from '../engine';
import { HEROES } from '../data/heroes';
import { shardMax, starsNow } from '../engine/astro';
import { beatMax } from '../engine/monk';
import { springSec } from '../engine/shaman';
import { wordCap } from '../engine/talents';
import { costOf } from '../engine/talents';
import { canTarget, knows } from '../engine/healer';
import { SKILLS } from '../data/skills';
import { judgeCount, sealed, sealTargets } from '../engine/warder';

export interface ClassGaugeState {
  count: number; max: number; percent: number; remaining: number; cooldown: number;
  earth: boolean; targets: number; targetMax: number; description: string;
  priestAura: 'off' | 'gold' | 'blue';
  paladinWaveReady: boolean;
  beaconName: string | null;
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
  const s: ClassGaugeState = { count: 0, max: 1, percent: 0, remaining: 0, cooldown: 0, earth: false, targets: 0, targetMax: 3, description: '', priestAura: 'off', paladinWaveReady:false, beaconName:null };
  switch (f.hero) {
    case 'priest':
      s.count = Math.floor(f.g.p); s.max = 100; s.description = `평온 ${s.count}%`; break;
    case 'druid':
      s.count = live.filter(u => u.hots.some(h => h.key === 'sprout' && h.left > 0)).length;
      s.max = Math.max(1, live.length); s.description = `새싹 적용 ${s.count}/${live.length}명`; break;
    case 'paladin':
      s.count = f.power3; s.max = 3;
      s.paladinWaveReady=paladinWaveReady(f);
      s.beaconName=f.party.find(u => u.id === f.beacon)?.nick ?? null;
      s.description = `신성한 힘 ${s.count}/3, 빛의 파도 ${s.paladinWaveReady?'사용 가능':'대기'}, 봉화 ${s.beaconName || '미지정'}, 변경 대기 ${Math.ceil(f.beaconCd)}초`; break;
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
  // 같은 후광 레이어가 100% 금빛 → 저장 특성의 200% 청백색으로 전환된다.
  if (f.hero === 'priest') s.priestAura = f.g.p < 100 ? 'off' : wordCap(f) > 100 && f.g.p >= 200 ? 'blue' : 'gold';
  return s;
}
