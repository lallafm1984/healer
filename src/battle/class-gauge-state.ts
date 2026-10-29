import type { Fight } from '../engine';
import { t } from '../i18n';
import { HEROES } from '../data/heroes';
import { shardMax, starsNow } from '../engine/astro';
import { beatMax } from '../engine/monk';
import { springSec } from '../engine/shaman';
import { guardSec } from '../engine/specials';
import { LEAF, SHAMAN, WARDER } from '../data/heroConst';
import { wordCap } from '../engine/talents';
import { costOf } from '../engine/talents';
import { powerMax } from '../engine/heroes';
import { canTarget, knows } from '../engine/healer';
import { SKILLS } from '../data/skills';
import { judgeCount, sealTargets } from '../engine/warder';

export interface ClassGaugeState {
  count: number; max: number; percent: number; remaining: number;
  /** 주술사 대지 토템 남은 시간 · 처음 길이 (2026-10-18 Lim 「대지 토템도 샘 토템처럼 지속시간」, 재사용 시간은 스킬 버튼에 보여 자원 칸에서 뺌) */
  earthRemaining: number; earthMax: number;
  earth: boolean; targets: number; targetMax: number; description: string;
  priestAura: 'off' | 'gold' | 'blue';
  paladinWaveReady: boolean;
  beaconName: string | null;
  /** 드루이드 잎 · 결계사 결계력처럼 개수를 통째로 켜는 칸 수 (일부만 채우지 않음, 다른 직업은 null) */
  lit: number | null;
}
const nicknameSegments = new Intl.Segmenter('ko', { granularity: 'grapheme' });
/** 닉네임은 표시 글자 단위로 5자까지. 전체 이름은 접근성 설명에 보존한다. */
export function beaconLabel(name: string | null): string {
  return name ? Array.from(nicknameSegments.segment(name)).slice(0,5).map(s=>s.segment).join('') : t('미지정');
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
  const s: ClassGaugeState = { count: 0, max: 1, percent: 0, remaining: 0, earthRemaining: 0, earthMax: 1, earth: false, targets: 0, targetMax: 3, description: '', priestAura: 'off', paladinWaveReady:false, beaconName:null, lit:null };
  switch (f.hero) {
    case 'priest':
      s.count = Math.floor(f.g.p); s.max = 100; s.description = t('평온 {n}%', { n: s.count }); break;
    case 'druid': // 잎 (2026-10-28 Lim 「성기사처럼 모아서 터트려」 1안): 새싹으로 모으고 들꽃 군락이 씀
      s.count = f.leaves; s.max = LEAF.max; s.lit = f.leaves;
      { const per = f.enc.big ? LEAF.big.heal : LEAF.heal; s.description = `${t('잎 {a}/{b}', { a: s.count, b: s.max })}${per ? `, ${t('들꽃 군락 회복 +{p}%', { p: Math.round(per * s.count * 100) })}` : ''}${s.count >= s.max ? `, ${t('바로 시전')}` : ''}`; } break;
    case 'paladin':
      s.count = f.power3; s.max = powerMax(f); // 넘치는 신성한 힘 (성기 05)이면 4칸
      s.paladinWaveReady=paladinWaveReady(f);
      s.beaconName=f.party.find(u => u.id === f.beacon)?.nick ?? null;
      s.description = `${t('신성한 힘 {a}/{b}', { a: s.count, b: s.max })}, ${t('빛의 파도 {s}', { s: s.paladinWaveReady ? t('사용 가능') : t('대기') })}, ${t('봉화 {s}', { s: s.beaconName || t('미지정') })}, ${t('변경 대기 {n}초', { n: Math.ceil(f.beaconCd) })}`; break;
    case 'shaman':
      s.remaining = Math.max(0, ...f.totems.filter(t => t.kind === 'spring').map(t => t.until - f.t));
      s.count = s.remaining; s.max = springSec(f);
      s.earthRemaining = Math.max(0, ...f.totems.filter(t => t.kind === 'earth').map(t => t.until - f.t));
      s.earthMax = guardSec(f, SHAMAN.earth.sec); s.earth = s.earthRemaining > 0;
      s.description = t('샘 토템 {a}초, 대지 토템 {b}초', { a: s.remaining.toFixed(1), b: s.earthRemaining.toFixed(1) }); break;
    case 'monk':
      s.max = beatMax(f); s.count = f.level >= HEROES.monk.system.lv ? f.beat : 0;
      s.remaining = s.count > 0 ? Math.max(0, f.beatUntil - f.t) : 0;
      s.description = t('기 리듬 {a}/{b}, 유지 시간 {n}초', { a: s.count, b: s.max, n: s.remaining.toFixed(1) }); break;
    case 'astrologer':
      s.count = f.shards; s.max = shardMax(f);
      s.description = t('별 조각 {a}/{b}, 다음 별자리 별 {n}개', { a: s.count, b: s.max, n: starsNow(f) }); break;
    case 'warder':
      // 결계력 (2026-10-28 2안): 인장을 새로 붙이면 1칸, 심판이 씀. 아래 사람 그림 = 심판 회복 대상
      s.count = f.warder?.ward ?? 0; s.max = WARDER.ward.max; s.lit = s.count;
      s.targetMax = Math.min(judgeCount(f), f.party.filter(u => u.alive).length); s.targets = sealTargets(f, s.targetMax).length; // 3인 탐험은 심판 6명이어도 살아 있는 인원까지 (2026-10-28)
      s.description = t('결계력 {a}/{b}, 심판 회복 +{p}%, 심판 회복 대상 {c}/{d}명', { a: s.count, b: s.max, p: Math.round(WARDER.ward.heal * s.count * 100), c: s.targets, d: s.targetMax }); break;
  }
  s.percent = Math.max(0, Math.min(100, s.count / s.max * 100));
  // 같은 후광 레이어가 100% 금빛 → 저장 특성의 200% 청백색으로 전환된다.
  if (f.hero === 'priest') s.priestAura = f.g.p < 100 ? 'off' : wordCap(f) > 100 && f.g.p >= 200 ? 'blue' : 'gold';
  return s;
}
