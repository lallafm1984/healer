/** 전투 판의 파티원 칸 표시 계산. 전투 상태는 변경하지 않는다. */
import { canDispel, type HeroKey } from '../data/heroes';
import type { Debuff } from '../engine/types';

export function cellTypography(scale: number): { compact: boolean; hp: number; nick: number; debuff: number } {
  const compact = scale < 36;
  return {
    compact,
    // 칸을 확대해 절대 HP 표시로 바뀌는 경계에서도 글자가 14→12px로 줄지 않는다.
    hp: compact ? Math.max(12, Math.min(14, scale * 0.4)) : Math.max(14, scale * 0.28),
    // 이름은 칸 크기를 따라 작아짐 (2026-10-10 Lim): 작은 칸 (10·20인)은 0.3배, 9px까지. 큰 칸은 예전처럼 0.24배 (11px 이상)
    nick: Math.min(Math.max(9, scale * 0.3), Math.max(11, scale * 0.24)),
    debuff: Math.max(11, scale * 0.2),
  };
}

/** 0%/100%가 살아 있는 극소 HP나 아직 덜 찬 HP를 오인시키지 않도록 안쪽으로 반올림한다. */
export function healthDisplay(hp: number, max: number): { ratio: number; percent: number; critical: boolean } {
  const ratio = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const percent = ratio === 0 ? 0 : ratio === 1 ? 100 : Math.max(1, Math.min(99, Math.round(ratio * 100)));
  return { ratio, percent, critical: ratio > 0 && ratio < 0.3 };
}

/** 글꼴 크기를 줄이지 않고 이름을 말줄임한다. 전체 이름은 길게 누르기 정보에서 제공한다. */
export function fitPartyName(name: string, maxWidth: number, measure: (text: string) => number): string {
  if (measure(name) <= maxWidth) return name;
  const chars = Array.from(name);
  while (chars.length > 1) {
    chars.pop();
    const candidate = `${chars.join('')}…`;
    if (measure(candidate) <= maxWidth) return candidate;
  }
  return measure(`${chars[0] ?? ''}…`) <= maxWidth ? `${chars[0] ?? ''}…` : '…';
}

export type DispelState = 'available' | 'unavailable' | 'dangerous';
const TYPE_SHORT: Record<string, string> = { 질병: '질', 독: '독', 마법: '마', 저주: '저' };

export function debuffDisplay(debuff: Debuff, hero: HeroKey, compact = false): {
  text: string; detail: string; state: DispelState; seconds: number;
} {
  const seconds = Math.max(0, Math.ceil(debuff.left));
  // 함정은 실제로 해제되며 폭발한다. 해제불가와 혼동하지 않는다.
  const state: DispelState = debuff.lock || !canDispel(hero, debuff.type) ? 'unavailable' : debuff.trap ? 'dangerous' : 'available';
  const marker = state === 'unavailable' ? '×' : state === 'dangerous' ? '!' : '';
  const kind = compact ? TYPE_SHORT[debuff.type] ?? '?' : debuff.type;
  // 마력 역류 (P-RECOIL): 배지에 중첩 수 (내 칸의 숫자)
  if (debuff.count) return { text: `${marker}${compact ? '' : '역류 '}${debuff.stack ?? 0}중`, detail: `${debuff.name} · ${debuff.type} · ${seconds}초, ${debuff.stack ?? 0}중첩 · 스킬을 쓸 때마다 1중첩, 끝나거나 지우면 중첩만큼 피해 · ${state === 'unavailable' ? '이 직업으로 해제 불가' : '해제 가능 (일찍 지울수록 덜 아픔)'}`, state, seconds };
  if (debuff.link) return { // 생명 사슬 (P-LINK)
    text: `${marker}${compact ? '사슬' : debuff.name} ${seconds}`,
    detail: `${debuff.name} · ${seconds}초 · ${debuff.link.kind === 'share' ? '이어진 두 사람이 받는 피해·치유를 반씩 나눔' : '이어진 두 사람 체력 차이가 크게 벌어지면 끊어지며 둘 다 피해'} · 해제 불가`,
    state, seconds,
  };
  // 부풀기 (P-SWELL, 46 5장): 배지에 중첩 수. 지우면 이웃만, 두면 본인 + 이웃이 터짐
  if (debuff.swell) return { text: `${marker}${compact ? '' : '거품 '}${debuff.stack ?? 1}중`, detail: `${debuff.name} · ${debuff.type} · ${seconds}초, ${debuff.stack ?? 1}중첩 · ${debuff.swell.every}초마다 1중첩 (최대 ${debuff.swell.max}) · 지우면 이웃 칸이 중첩만큼, 두면 끝날 때 본인과 이웃 칸이 더 크게 터짐 · ${state === 'unavailable' ? '이 직업으로 해제 불가' : '해제 가능 (적을 때 · 옆에 사람이 적을 때)'}`, state, seconds };
  // 뒤집힘 저주 (P-FLIP): 끝날 때 체력 비율이 뒤집힘
  if (debuff.end?.p === 'flip') return { text: `${marker}${compact ? '' : '뒤집 '}${seconds}`, detail: `${debuff.name} · ${debuff.type} · ${seconds}초 · 끝날 때 체력 비율이 뒤집힘 (80% → 20%, 30% → 70%) · 높으면 힐을 멈추고 낮으면 둠 · ${state === 'unavailable' ? '이 직업으로 해제 불가' : '해제 가능 (지우면 그냥 사라짐)'}`, state, seconds };
  // 빌린 생명 (P-DEBT, 59 5장): 배지에 남은 빚 (불어날수록 커짐)
  if (debuff.debt) { const amt = Math.round(debuff.debtLeft ?? 0); return { text: `빚 ${compact && amt >= 1000 ? `${(amt / 1000).toFixed(amt >= 10000 ? 0 : 1)}k` : amt}`, detail: `${debuff.name} · ${seconds}초 · 남은 빚 ${amt} (초마다 +${Math.round(debuff.debt.grow * 100)}%, 어둠물에 잠기면 2배) · 이 사람에게 넘친 치유가 빚을 갚음 · 시간이 다 되면 남은 빚만큼 피해 · 해제 불가`, state, seconds }; }
  if (debuff.jail) return { text: `${marker}${compact ? '감옥' : debuff.name}`, detail: `${debuff.name} · 딜 0 · 못 움직임 · 딜러가 감옥을 깨면 풀림 · 해제 불가`, state, seconds: 0 };
  const action = debuff.lock ? (debuff.cureAt != null ? `해제 불가, 체력 ${Math.round(debuff.cureAt * 100)}% 이상이면 사라짐`
    : debuff.untilBossLoss != null ? `해제 불가, 보스 체력 ${Math.round(debuff.untilBossLoss * 100)}% 깎으면 풀림` : '해제 불가')
    : state === 'unavailable' ? '이 직업으로 해제 불가' : state === 'dangerous' ? '해제 시 전염 폭발' : '해제 가능';
  const stack = (debuff.stack ?? 0) > 1 ? `, ${debuff.stack}중첩` : '';
  // 받는 치유가 바뀌는 디버프 (35 4-3): 뒤집힌 축복 · 얼룩진 장갑 · 먼지 범벅
  const heal = debuff.invert ? ' · 받는 치유가 피해로' : debuff.healCut ? ` · 받는 치유 -${Math.round(debuff.healCut * (debuff.stack ?? 1) * 100)}%`
    : debuff.over ? ' · 넘친 치유만큼 옆 칸 아군 피해' : debuff.cap != null ? ` · 체력이 ${Math.round(debuff.cap * 100)}%까지만 참` : '';
  // 매혹 · 옮겨붙음 · 마나 갈취 (35 3장): 길게 눌렀을 때 판단 근거
  const more = debuff.charm ? ` · 이웃을 때림, 힐하면 길어짐, 체력 ${Math.round(debuff.charm.free * 100)}% 아래면 풀림`
    : debuff.end?.p === 'jump' ? ' · 지우면 옆 사람에게 옮겨붙음 (혼자면 사라짐), 두면 보스가 강해짐'
    : debuff.drain ? ` · 마나 초당 -${debuff.drain}`
    : debuff.end?.p === 'pass' ? ` · 치유 흡수 막 ${Math.round(debuff.absorbLeft ?? 0)}, 지우면 가장 건강한 아군에게 넘어감, 두면 끝날 때 남은 막만큼 피해` : '';
  return {
    text: `${marker}${kind}${compact ? '' : ' '}${seconds}`,
    detail: `${debuff.name} · ${debuff.type} · ${seconds}초${stack}${heal}${more} · ${action}`,
    state,
    seconds,
  };
}

/** 기존 판의 함정 → 독 이외의 알려진 종류 → 나머지 순서를 보존한다. */
export function primaryDebuff(debuffs: readonly Debuff[]): Debuff | undefined {
  const priority = (d: Debuff) => d.jail ? 3 : d.trap || d.swell || d.debt || d.end?.p === 'flip' || d.end?.p === 'pass' ? 2 : TYPE_SHORT[d.type] && d.type !== '독' ? 1 : 0;
  return debuffs.reduce<Debuff | undefined>((best, d) => !best || priority(d) > priority(best) ? d : best, undefined);
}
